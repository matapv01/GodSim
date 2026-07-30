/**
 * Watches a session transcript file for new entries and emits ChatItem deltas.
 *
 * Key design decisions:
 *   - Default: starts from file tail (no replay of old content — history handles that).
 *   - Cold-start mode (fromBeginning=true): reads from offset 0 to catch the
 *     first reply written before the watcher could start.
 *   - Reuses parseTranscriptEntry() so history and realtime are the same parser.
 *   - Does NOT touch Town's AgentEvent pipeline at all.
 */

import { existsSync, openSync, closeSync, fstatSync, readSync } from "node:fs";
import type { ChatItem } from "../contracts/chat.js";
import { parseTranscriptEntry, createParserState, type TranscriptParserState } from "./session-history.js";

const POLL_MS = 300;

export class ChatSessionWatcher {
  private filePath: string;
  private agentId: string;
  private emit: (items: ChatItem[]) => void;
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private partial = "";
  private state: TranscriptParserState;

  constructor(filePath: string, agentId: string, emit: (items: ChatItem[]) => void) {
    this.filePath = filePath;
    this.agentId = agentId;
    this.emit = emit;
    this.state = createParserState();
  }

  start(fromBeginning = false): void {
    if (this.stopped) return;
    if (!existsSync(this.filePath)) return;

    if (fromBeginning) {
      this.offset = 0;
    } else {
      try {
        const fd = openSync(this.filePath, "r");
        this.offset = fstatSync(fd).size;
        closeSync(fd);
      } catch {
        this.offset = 0;
      }
    }

    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private poll(): void {
    if (this.stopped) return;
    if (!existsSync(this.filePath)) return;

    let fd: number | null = null;
    try {
      fd = openSync(this.filePath, "r");
      const size = fstatSync(fd).size;
      if (size <= this.offset) { closeSync(fd); return; }

      const len = size - this.offset;
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, this.offset);
      closeSync(fd);
      fd = null;
      this.offset = size;

      const chunk = this.partial + buf.toString("utf-8");
      const lines = chunk.split("\n");
      this.partial = lines.pop() ?? "";

      const allItems: ChatItem[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          const items = parseTranscriptEntry(entry, this.agentId, this.state);
          if (items.length > 0) allItems.push(...items);
        } catch { /* skip malformed */ }
      }

      if (allItems.length > 0) {
        this.emit(allItems);
      }
    } catch {
      if (fd !== null) try { closeSync(fd); } catch {}
    }
  }
}
