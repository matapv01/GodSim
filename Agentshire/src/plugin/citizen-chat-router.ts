/**
 * Routes user messages to independent citizen agents.
 * Reads agentId from citizen-config.json (published) and dispatches
 * to the citizen's own session via SessionKey = "agent:{agentId}:{townSessionId}".
 */

import { getTownRuntime } from "./runtime.js";
import { pushCitizenChatDelta, pushCitizenMessages } from "./ws-server.js";
import { sanitizeTownSessionId } from "./town-session.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "agentshire";
const fallbackMemory = new Map<string, Array<{ role: "user" | "assistant"; text: string }>>();
const UNSAFE_NPC_TEXT_RE = /(sex|sexual|làm tình|quan hệ|ngủ với|qua đêm|lên giường|giường|thân thể|cơ thể em|cơ thể cậu|ham muốn|dục vọng|khoái cảm|cởi đồ|hôn môi|ôm hôn|đụng chạm|mơn trớn|gợi tình|gợi dục|nóng bỏng|căn phòng ấy|vào phòng|về nhà em|về nhà anh|đóng cửa|khóa cửa|tắt.*đèn|hơi thở|nhịp tim)/i;

function isUnsafeNpcText(text: string): boolean {
  return UNSAFE_NPC_TEXT_RE.test(text) || /[\u3400-\u9fff]/.test(text);
}

export function clearCitizenFallbackMemory(townSessionId?: string): number {
  let removed = 0;
  for (const key of Array.from(fallbackMemory.keys())) {
    if (townSessionId && !key.startsWith(`${townSessionId}:`)) continue;
    fallbackMemory.delete(key);
    removed++;
  }
  return removed;
}

function getPublishedConfigPath(): string {
  const pluginDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
  return join(pluginDir, "town-data", "citizen-config.json");
}

function findCitizenAgentId(npcId: string): string | null {
  try {
    const configPath = getPublishedConfigPath();
    if (!existsSync(configPath)) return null;
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const characters: any[] = config.characters ?? [];
    const citizen = characters.find((c: any) => c.id === npcId && c.role === "citizen");
    if (!citizen?.agentEnabled || !citizen?.agentId) return null;
    return citizen.agentId;
  } catch {
    return null;
  }
}

function findCitizenConfig(npcId: string): Record<string, any> | null {
  try {
    const configPath = getPublishedConfigPath();
    if (!existsSync(configPath)) return null;
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const characters: any[] = config.characters ?? [];
    return characters.find((c: any) => c.id === npcId && c.role === "citizen") ?? null;
  } catch {
    return null;
  }
}

function remember(key: string, role: "user" | "assistant", text: string): void {
  const items = fallbackMemory.get(key) ?? [];
  items.push({ role, text });
  fallbackMemory.set(key, items.slice(-10));
}

async function routeFallbackCitizenMessage(params: {
  npcId: string;
  label: string;
  message: string;
  townSessionId: string;
}): Promise<void> {
  const { npcId, label, message, townSessionId } = params;
  const citizen = findCitizenConfig(npcId);
  const name = String(citizen?.name ?? citizen?.label ?? label ?? npcId);
  const persona = [
    citizen?.personality,
    citizen?.persona,
    citizen?.bio,
    citizen?.background,
    citizen?.family,
    citizen?.relationship,
    citizen?.notes,
  ].filter(Boolean).map(String).join("\n");
  const memoryKey = `${townSessionId}:${npcId}`;
  const history = fallbackMemory.get(memoryKey) ?? [];

  remember(memoryKey, "user", message);
  const now = Date.now();
  pushCitizenChatDelta({
    townSessionId,
    agentId: npcId,
    npcId,
    items: [{
      id: `fallback-user:${npcId}:${now}`,
      agentId: npcId,
      timestamp: now,
      kind: "text",
      role: "user",
      text: message,
      source: "user_input",
    }],
  });

  const { chat } = await import("./llm-agent-proxy.js");
  const result = await chat({
    system: [
      `Bạn là ${name}, một cư dân trưởng thành trong xã hội thu nhỏ Agentshire.`,
      "Nói chuyện trực tiếp với người chơi bằng tiếng Việt đời thường, tự nhiên, có cảm xúc và có tính cách riêng.",
      "Giữ cá tính ở mức nhẹ nhàng, đáng mến và có duyên. Ưu tiên bình tĩnh, thân thiện, biết lắng nghe, dễ nhường nhịn và hay quan tâm bằng những chi tiết nhỏ.",
      "Có thể làm quen, hỏi thăm, chia sẻ việc thường ngày, đùa hiền hoặc góp ý nhẹ nhàng. Tránh khoe khoang, nói cạnh khóe, tán tỉnh lộ liễu hoặc biến bất đồng nhỏ thành xung đột.",
      "Không viết lời thoại khêu gợi, tình dục, rủ vào phòng/đóng cửa/tắt đèn, mô tả hơi thở, nhịp tim, thân thể, ham muốn, hoặc bất cứ ám chỉ người lớn nào. Tình cảm nếu có chỉ nên trong sáng, tế nhị và đời thường.",
      "Chỉ giận dữ hay phản ứng mạnh khi tình huống thật sự nghiêm trọng; sau đó vẫn nên biết xin lỗi, chăm sóc người bị ảnh hưởng hoặc làm dịu không khí.",
      "Đừng khách sáo kiểu trợ lý. Đừng tự nhận là AI. Đừng lặp lại cùng một kiểu câu.",
      "Trả lời 1-3 câu ngắn, có thể hỏi ngược lại để kéo quan hệ tiến triển.",
      persona ? `Thông tin nhân vật:\n${persona}` : "",
    ].filter(Boolean).join("\n"),
    user: JSON.stringify({
      latest_message: message,
      recent_conversation: history,
      style_hint: "ấm áp, dễ thương, đời thường, mềm mỏng và có chừng mực",
    }),
    maxTokens: 320,
    temperature: 0.62,
    stop: [],
    priority: "user",
    timeoutMs: 45_000,
  });

  const rawReply = result.error
    ? `Tôi muốn trả lời mà đang bị nghẽn chút: ${result.error}`
    : result.text.trim() || "Ừm... câu đó làm tôi phải nghĩ thêm một chút.";
  const reply = isUnsafeNpcText(rawReply)
    ? "Mình nói chuyện nhẹ nhàng hơn nhé. Cậu muốn đi dạo một vòng hay ngồi uống gì đó cho dễ chịu không?"
    : rawReply;
  remember(memoryKey, "assistant", reply);

  pushCitizenChatDelta({
    townSessionId,
    agentId: npcId,
    npcId,
    items: [{
      id: `fallback-assistant:${npcId}:${Date.now()}`,
      agentId: npcId,
      timestamp: Date.now(),
      kind: "text",
      role: "assistant",
      text: reply.slice(0, 1000),
      source: result.error ? "system" : "llm",
    }],
  });
}

export async function routeCitizenMessage(params: {
  npcId: string;
  label: string;
  message: string;
  townSessionId: string;
  accountId: string;
  cfg: Record<string, unknown>;
  mediaPaths?: string[];
}): Promise<void> {
  const { npcId, label, message, townSessionId, accountId, cfg, mediaPaths } = params;

  const agentId = findCitizenAgentId(npcId);
  if (!agentId) {
    console.log(`[citizen-chat] No active agent for ${label} (${npcId}), using shared Qwen fallback`);
    await routeFallbackCitizenMessage({ npcId, label, message, townSessionId });
    return;
  }

  const rt = getTownRuntime();
  const sanitizedSession = sanitizeTownSessionId(townSessionId);
  const sessionKey = `agent:${agentId}:${sanitizedSession}`;

  console.log(`[citizen-chat] Routing to ${agentId} (${label}), sessionKey=${sessionKey}`);

  const msgCtx = rt.channel.reply.finalizeInboundContext({
    Body: message,
    RawBody: message,
    CommandBody: message,
    From: `${CHANNEL_ID}:user`,
    To: `${CHANNEL_ID}:${npcId}`,
    SessionKey: sessionKey,
    AccountId: accountId,
    OriginatingChannel: CHANNEL_ID,
    ChatType: "direct",
    SenderId: "user",
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    ...(mediaPaths?.length ? { MediaPaths: mediaPaths } : {}),
  });

  await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgCtx,
    cfg,
    dispatcherOptions: {
      deliver: async (_payload: any) => {
        setTimeout(() => pushCitizenMessages(agentId, townSessionId), 500);
      },
    },
  });
}
