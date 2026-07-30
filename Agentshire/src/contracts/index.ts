// @desc Public entry — re-exports all contract types
//
// ─── Architecture ───
//
//   contracts/          <-- 你在这里：所有层的唯一类型真理之源
//       │
//       ├── media.ts         多模态内容块 (text/image/audio/video/file)
//       ├── agent-state.ts   Agent 状态机 & 递归快照树
//       ├── events.ts        AgentEvent 联合类型 (OpenClaw 核心对外契约)
//       ├── registry.ts      中央注册表 (session ↔ project 关联)
//       └── index.ts         本文件：公共导出入口
//
// ─── 消费者 ───
//
//   CLI 层        → events.ts + agent-state.ts + media.ts
//   OpenClaw 层 → events.ts + agent-state.ts (src/core/types.ts re-export)
//
// ─── 已移除 (Phase 0 清理, 2026-03) ───
//
//   messages.ts — WS 新格式类型，从未被消费，已删除
//   envelope.ts — 传输信封类型，从未被消费，已删除
//

// Media
export type {
  ContentKind,
  InlineSource,
  UrlSource,
  StreamSource,
  TextContent,
  ImageContent,
  AudioContent,
  VideoStreamSource,
  VideoContent,
  FileContent,
  MediaContent,
  MultimodalBody,
} from './media.js';

// Agent state
export type {
  AgentPhase,
  AgentActivity,
  AgentResources,
  AgentSnapStats,
  AgentStateSnapshot,
  SessionStatus,
  SessionState,
} from './agent-state.js';

// Chat
export type {
  ChatMediaType,
  ChatItemKind,
  ChatItem,
  ChatTextItem,
  ChatMediaItem,
  ChatToolItem,
  ChatStatusItem,
  ChatItemHistoryResult,
} from './chat.js';

// Events
export type {
  AgentStats,
  ToolResultMeta,
  TokenUsage,
  ASRSegment,
  AgentEvent,
  MediaOutputMeta,
} from './events.js';
