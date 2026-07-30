// @desc AGUI (AG-UI Protocol) event types for OpenClaw
// Based on AG-UI Protocol: https://docs.ag-ui.com/concepts/events
//
// These types mirror the AGUI definitions in packages/agentstudio/backend/src/engines/types.ts
// but live within OpenClaw's contract layer so the package is self-contained.

// ── Event Type Enum ──

export enum AGUIEventType {
  // Lifecycle
  RUN_STARTED = 'RUN_STARTED',
  RUN_FINISHED = 'RUN_FINISHED',
  RUN_ERROR = 'RUN_ERROR',
  STEP_STARTED = 'STEP_STARTED',
  STEP_FINISHED = 'STEP_FINISHED',

  // Text Message
  TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',

  // Thinking (extended)
  THINKING_START = 'THINKING_START',
  THINKING_CONTENT = 'THINKING_CONTENT',
  THINKING_END = 'THINKING_END',

  // Tool Call
  TOOL_CALL_START = 'TOOL_CALL_START',
  TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
  TOOL_CALL_END = 'TOOL_CALL_END',
  TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',

  // State Management
  STATE_SNAPSHOT = 'STATE_SNAPSHOT',
  STATE_DELTA = 'STATE_DELTA',
  MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',

  // Special
  RAW = 'RAW',
  CUSTOM = 'CUSTOM',
}

// ── Base Event ──

export interface AGUIBaseEvent {
  type: AGUIEventType;
  timestamp: number;
  threadId?: string;
  runId?: string;
}

// ── Lifecycle Events ──

export interface AGUIRunStartedEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_STARTED;
  threadId: string;
  runId: string;
  input?: unknown;
}

export interface AGUIRunFinishedEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_FINISHED;
  threadId: string;
  runId: string;
  result?: unknown;
}

export interface AGUIRunErrorEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_ERROR;
  error: string;
  code?: string;
  message?: string;
}

export interface AGUIStepStartedEvent extends AGUIBaseEvent {
  type: AGUIEventType.STEP_STARTED;
  stepName?: string;
}

export interface AGUIStepFinishedEvent extends AGUIBaseEvent {
  type: AGUIEventType.STEP_FINISHED;
  stepName?: string;
}

// ── Text Message Events ──

export interface AGUITextMessageStartEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_START;
  messageId: string;
  role?: 'assistant' | 'user' | 'system';
}

export interface AGUITextMessageContentEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  content: string;
}

export interface AGUITextMessageEndEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_END;
  messageId: string;
}

// ── Thinking Events ──

export interface AGUIThinkingStartEvent extends AGUIBaseEvent {
  type: AGUIEventType.THINKING_START;
  messageId: string;
}

export interface AGUIThinkingContentEvent extends AGUIBaseEvent {
  type: AGUIEventType.THINKING_CONTENT;
  messageId: string;
  content: string;
}

export interface AGUIThinkingEndEvent extends AGUIBaseEvent {
  type: AGUIEventType.THINKING_END;
  messageId: string;
}

// ── Tool Call Events ──

export interface AGUIToolCallStartEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
  parentMessageId?: string;
}

export interface AGUIToolCallArgsEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_ARGS;
  toolCallId: string;
  args: string;
}

export interface AGUIToolCallEndEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_END;
  toolCallId: string;
}

export interface AGUIToolCallResultEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_RESULT;
  toolCallId: string;
  result: string;
  isError?: boolean;
}

// ── State Management Events ──

export interface AGUIStateSnapshotEvent extends AGUIBaseEvent {
  type: AGUIEventType.STATE_SNAPSHOT;
  snapshot: unknown;
}

export interface AGUIStateDeltaEvent extends AGUIBaseEvent {
  type: AGUIEventType.STATE_DELTA;
  delta: unknown;
}

export interface AGUIMessagesSnapshotEvent extends AGUIBaseEvent {
  type: AGUIEventType.MESSAGES_SNAPSHOT;
  messages: unknown[];
}

// ── Special Events ──

export interface AGUIRawEvent extends AGUIBaseEvent {
  type: AGUIEventType.RAW;
  source: string;
  event: unknown;
}

export interface AGUICustomEvent extends AGUIBaseEvent {
  type: AGUIEventType.CUSTOM;
  name: string;
  data: unknown;
}

// ── Union Type ──

export type AGUIEvent =
  | AGUIRunStartedEvent
  | AGUIRunFinishedEvent
  | AGUIRunErrorEvent
  | AGUIStepStartedEvent
  | AGUIStepFinishedEvent
  | AGUITextMessageStartEvent
  | AGUITextMessageContentEvent
  | AGUITextMessageEndEvent
  | AGUIThinkingStartEvent
  | AGUIThinkingContentEvent
  | AGUIThinkingEndEvent
  | AGUIToolCallStartEvent
  | AGUIToolCallArgsEvent
  | AGUIToolCallEndEvent
  | AGUIToolCallResultEvent
  | AGUIStateSnapshotEvent
  | AGUIStateDeltaEvent
  | AGUIMessagesSnapshotEvent
  | AGUIRawEvent
  | AGUICustomEvent;

// ── Utility Functions ──

export function formatAguiEventAsSSE(event: AGUIEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createTimestamp(): number {
  return Date.now();
}
