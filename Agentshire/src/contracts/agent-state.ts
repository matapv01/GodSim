// @desc Agent state machine and structured state snapshots
//
// AgentStateSnapshot 是递归结构, children 字段形成子代理树
// 前端可据此渲染实时代理状态面板 (phase → UI 状态, activity → 当前动作)
//
// 迁移注意:
//   - ws-handler 尚未发送 SessionState, 仍用旧的扁平 { sessionId, status }
//   - state_snapshot AgentEvent 尚未在 OpenClaw 核心中发射
//   - CLI 的 App.tsx 目前自行拼装子代理树, 未来应改用 AgentStateSnapshot

export type AgentPhase =
  | 'initializing'
  | 'idle'
  | 'thinking'
  | 'tool_calling'
  | 'streaming'
  | 'waiting_input'
  | 'done'
  | 'error';

export interface AgentActivity {
  type: 'llm_call' | 'tool_execution' | 'sub_agent_wait';
  toolName?: string;
  toolUseId?: string;
  description?: string;
  startedAt: number;
  progress?: number;
}

export type HookIcon = '🛡️' | '🔧' | '🛑' | '🗜️' | '🚀' | '🏁' | '🔔';

export interface HookActivity {
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'PreCompact' | 'SessionStart' | 'SessionEnd' | 'Notification';
  status: 'running' | 'success' | 'error' | 'blocked';
  icon: HookIcon;
  toolName?: string;
  detail?: string;
  durationMs?: number;
}

export const HOOK_ICONS: Record<string, HookIcon> = {
  PreToolUse: '🛡️',
  PostToolUse: '🔧',
  Stop: '🛑',
  PreCompact: '🗜️',
  SessionStart: '🚀',
  SessionEnd: '🏁',
  Notification: '🔔',
};

export interface AgentResources {
  tokens: { used: number; limit: number; percent: number };
  iteration: { current: number; max: number };
  durationMs: number;
}

export interface AgentSnapStats {
  toolCalls: number;
  agentSpawns: number;
  tokensIn: number;
  tokensOut: number;
}

export interface AgentStateSnapshot {
  agentId: string;
  displayName?: string;
  phase: AgentPhase;
  model: string;
  persona?: string;
  activity?: AgentActivity;
  hookActivity?: HookActivity;
  resources: AgentResources;
  stats: AgentSnapStats;
  children: AgentStateSnapshot[];
}

export type SessionStatus = 'active' | 'suspended' | 'completed' | 'error';

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  rootAgent: AgentStateSnapshot;
  createdAt: number;
  lastActiveAt: number;
  persona?: string;
  metadata?: Record<string, unknown>;
}
