import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initStateDir, stateDir } from "../plugin/paths.js";
import { ensureEditorDirs, handleEditorRequest, MIME_TYPES } from "../plugin/editor-serve.js";
import { startTownWsServer, broadcastAgentEvent } from "../plugin/ws-server.js";
import { CustomAssetManager } from "../plugin/custom-asset-manager.js";
import { appendChatItems } from "../plugin/longterm-log.js";
import { sanitizeTownSessionId } from "../plugin/town-session.js";
import { chat } from "../plugin/llm-agent-proxy.js";

process.env.AGENTSHIRE_STANDALONE = "1";

const here = fileURLToPath(import.meta.url);
const pluginDir = resolve(here, "..", "..", "..");
const distDir = join(pluginDir, "town-frontend", "dist");
const publicPort = Number(process.env.PORT ?? process.env.AGENTSHIRE_HTTP_PORT ?? 7860);

initStateDir({
  agents: {
    defaults: {
      workspace: join(process.env.AGENTSHIRE_STATE_DIR || join(process.cwd(), ".agentshire-state"), "workspace-town-steward"),
    },
  },
});

try {
  mkdirSync(stateDir(), { recursive: true });
  ensureEditorDirs(pluginDir);
} catch (err) {
  console.warn("[agentshire-standalone] init dirs failed:", (err as Error).message);
}

function sendText(res: ServerResponse, status: number, text: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(text);
}

function safeStaticPath(urlPath: string): string | null {
  const cleanPath = urlPath === "/" ? "/town.html" : decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(distDir, normalized);
  return candidate.startsWith(distDir) ? candidate : null;
}

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = new URL(req.url ?? "/", `http://localhost:${publicPort}`).pathname;
  const filePath = safeStaticPath(urlPath);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  const cache = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": cache,
    "Access-Control-Allow-Origin": "*",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  res.end(readFileSync(filePath));
  return true;
}

async function stewardReply(townSessionId: string, body: string): Promise<void> {
  const sessionId = sanitizeTownSessionId(townSessionId);
  const now = Date.now();
  appendChatItems({
    townSessionId: sessionId,
    agentId: "steward",
    items: [{
      id: `steward-user:${sessionId}:${now}`,
      agentId: "steward",
      timestamp: now,
      kind: "text",
      role: "user",
      text: body,
      source: "user_input",
    }],
  });
  broadcastAgentEvent({ type: "system", subtype: "init", message: "Steward is thinking." }, sessionId);
  broadcastAgentEvent({ type: "thinking_delta", content: "Đang suy nghĩ..." }, sessionId);

  const result = await chat({
    system: [
      "Bạn là quản gia của thị trấn mô phỏng Agentshire.",
      "Trả lời bằng tiếng Việt đời thường, ngắn gọn, và giữ vai trò người hướng dẫn trong xã hội thu nhỏ.",
      "Không tự nhận là AI. Nếu người chơi muốn tác động vào xã hội, hãy trả lời như một quản gia đang điều phối thị trấn.",
    ].join("\n"),
    user: body,
    maxTokens: 420,
    temperature: 0.75,
    stop: [],
    priority: "user",
    timeoutMs: 45_000,
  });

  const reply = result.error
    ? `LLM lỗi: ${result.error}`
    : result.text.trim() || "Mình đang nghe, nhưng chưa nghĩ ra câu trả lời rõ ràng.";
  appendChatItems({
    townSessionId: sessionId,
    agentId: "steward",
    items: [{
      id: `steward-assistant:${sessionId}:${Date.now()}`,
      agentId: "steward",
      timestamp: Date.now(),
      kind: "text",
      role: "assistant",
      text: reply,
      source: result.error ? "system" : "llm",
    }],
  });
  broadcastAgentEvent({ type: "text", content: reply }, sessionId);
  broadcastAgentEvent({ type: "system", subtype: "done", message: "Steward replied." }, sessionId);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      res.end();
      return;
    }
    const urlPath = new URL(req.url ?? "/", `http://localhost:${publicPort}`).pathname;
    if (urlPath === "/healthz") {
      sendText(res, 200, JSON.stringify({ ok: true, mode: "standalone" }), "application/json; charset=utf-8");
      return;
    }
    if (await handleEditorRequest(req, res, pluginDir)) return;
    if (serveStatic(req, res)) return;
    sendText(res, 404, "Not Found");
  } catch (err) {
    console.error("[agentshire-standalone] request error:", err);
    sendText(res, 500, "Internal Server Error");
  }
});

startTownWsServer({
  port: publicPort,
  server,
  path: "/ws",
  customAssetManager: new CustomAssetManager(pluginDir),
  onImplicitChat: async (payload) => chat({
    system: payload.system,
    user: payload.user,
    maxTokens: payload.maxTokens,
    temperature: payload.temperature,
    stop: payload.stop,
    priority: "background",
    timeoutMs: 12_000,
  }),
  onChat: async ({ message, townSessionId }) => {
    if (message.trim()) await stewardReply(townSessionId, message);
  },
  onCitizenChat: async ({ npcId, message, townSessionId }) => {
    const { routeCitizenMessage } = await import("../plugin/citizen-chat-router.js");
    await routeCitizenMessage({
      npcId,
      label: npcId,
      message,
      townSessionId,
      accountId: "standalone",
      cfg: {},
    });
  },
  onTopicStart: async ({ npcIds, townSessionId }) => {
    const { startDiscussion } = await import("../plugin/group-discussion.js");
    startDiscussion({
      participants: npcIds.map((npcId) => ({ npcId, name: npcId })),
      townSessionId,
      accountId: "standalone",
      cfg: {},
    });
  },
  onTopicMessage: async ({ message }) => {
    const { hasActiveDiscussion, onUserMessage } = await import("../plugin/group-discussion.js");
    if (hasActiveDiscussion()) onUserMessage(message);
  },
  onTopicEnd: async () => {
    const { endDiscussion } = await import("../plugin/group-discussion.js");
    endDiscussion();
  },
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`[agentshire-standalone] HTTP ready on http://0.0.0.0:${publicPort}`);
  console.log(`[agentshire-standalone] WS ready on /ws`);
});
