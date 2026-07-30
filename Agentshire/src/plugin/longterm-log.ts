import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./paths.js";
import type { ChatItem } from "../contracts/chat.js";

const MAX_HISTORY_ITEMS = 500;

function logDir(): string {
  const dir = join(stateDir(), "agentshire-longterm");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function dayStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "unknown";
}

function appendJsonl(kind: string, id: string, item: Record<string, unknown>): void {
  try {
    const ts = typeof item.timestamp === "number" ? item.timestamp : Date.now();
    const file = join(logDir(), `${kind}-${safeId(id)}-${dayStamp(ts)}.jsonl`);
    appendFileSync(file, JSON.stringify({ ...item, savedAt: Date.now() }) + "\n", "utf-8");
  } catch (err) {
    console.warn("[longterm-log] append failed:", (err as Error).message);
  }
}

export function appendChatItems(params: {
  townSessionId: string;
  agentId: string;
  npcId?: string;
  items: ChatItem[];
}): void {
  for (const item of params.items) {
    appendJsonl("chat", params.agentId, {
      kind: "chat",
      townSessionId: params.townSessionId,
      agentId: params.agentId,
      npcId: params.npcId,
      ...item,
    });
  }
}

export function appendTownEvent(event: Record<string, unknown>): void {
  appendJsonl("town", "journal", { kind: "town_event", ...event });
}

export function loadLongTermChatItems(agentId: string, limit: number = 80): ChatItem[] {
  try {
    const dir = logDir();
    const prefix = `chat-${safeId(agentId)}-`;
    const files = readdirSync(dir)
      .filter((file) => file.startsWith(prefix) && file.endsWith(".jsonl"))
      .sort()
      .slice(-30);

    const items: ChatItem[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      const text = readFileSync(join(dir, file), "utf-8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as ChatItem & { id?: string };
          if (!data.id || seen.has(data.id)) continue;
          seen.add(data.id);
          items.push(data);
        } catch {
          continue;
        }
      }
    }

    items.sort((a, b) => a.timestamp - b.timestamp);
    return items.slice(-Math.min(limit, MAX_HISTORY_ITEMS));
  } catch {
    return [];
  }
}
