/**
 * Group discussion orchestrator.
 * Manages a round-robin discussion between multiple citizen agents around a user-provided topic.
 *
 * Flow:
 *   1. User provides topic + list of npcIds
 *   2. Orchestrator sends contextual message to first citizen via routeCitizenMessage
 *   3. On citizen response (captured via hook), appends to shared history, sends to next citizen
 *   4. User can "interject" at any time — message is queued and injected after current speaker
 *   5. Continues until explicitly ended
 */

import { routeCitizenMessage } from "./citizen-chat-router.js";

const TURN_TIMEOUT_MS = 30_000;
const MAX_TOTAL_TURNS = 30;

interface Participant {
  npcId: string;
  name: string;
}

interface HistoryEntry {
  speaker: string;
  text: string;
}

interface ActiveDiscussion {
  participants: Participant[];
  history: HistoryEntry[];
  queue: number[];
  currentIndex: number;
  currentSpeakerNpcId: string | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  pendingUserMessages: string[];
  totalTurns: number;
  stopped: boolean;
  townSessionId: string;
  accountId: string;
  cfg: Record<string, unknown>;
  responseBuffer: string;
}

let activeDiscussion: ActiveDiscussion | null = null;

export function hasActiveDiscussion(): boolean {
  return activeDiscussion !== null && !activeDiscussion.stopped;
}

export function getDiscussionSpeaker(): string | null {
  return activeDiscussion?.currentSpeakerNpcId ?? null;
}

export function startDiscussion(params: {
  participants: Participant[];
  townSessionId: string;
  accountId: string;
  cfg: Record<string, unknown>;
}): void {
  if (activeDiscussion && !activeDiscussion.stopped) {
    endDiscussion();
  }

  const { participants, townSessionId, accountId, cfg } = params;
  const queue = participants.map((_, i) => i);

  activeDiscussion = {
    participants,
    history: [],
    queue,
    currentIndex: 0,
    currentSpeakerNpcId: null,
    turnTimer: null,
    pendingUserMessages: [],
    totalTurns: 0,
    stopped: false,
    townSessionId,
    accountId,
    cfg,
    responseBuffer: "",
  };

  console.log(`[group-discussion] Started with ${participants.length} participants: ${participants.map(p => p.name).join(", ")}`);
}

export function onUserMessage(message: string): void {
  if (!activeDiscussion || activeDiscussion.stopped) return;

  if (activeDiscussion.currentSpeakerNpcId) {
    activeDiscussion.pendingUserMessages.push(message);
    console.log(`[group-discussion] User message queued (speaker active): "${message.slice(0, 50)}"`);
  } else {
    activeDiscussion.history.push({ speaker: "镇长", text: message });
    console.log(`[group-discussion] User message added to history: "${message.slice(0, 50)}"`);
    sendToNextSpeaker();
  }
}

export function onCitizenResponse(agentId: string, text: string): void {
  if (!activeDiscussion || activeDiscussion.stopped) return;

  const participant = activeDiscussion.participants.find(p => {
    const expectedPrefix = `citizen-${p.npcId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    return agentId === expectedPrefix || agentId === p.npcId;
  });

  if (!participant) return;
  if (participant.npcId !== activeDiscussion.currentSpeakerNpcId) return;

  activeDiscussion.responseBuffer += text;
}

export function onCitizenTurnEnd(agentId: string): void {
  if (!activeDiscussion || activeDiscussion.stopped) return;

  const participant = activeDiscussion.participants.find(p => {
    const expectedPrefix = `citizen-${p.npcId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    return agentId === expectedPrefix || agentId === p.npcId;
  });

  if (!participant) return;
  if (participant.npcId !== activeDiscussion.currentSpeakerNpcId) return;

  if (activeDiscussion.turnTimer) {
    clearTimeout(activeDiscussion.turnTimer);
    activeDiscussion.turnTimer = null;
  }

  const responseText = activeDiscussion.responseBuffer.trim();
  activeDiscussion.responseBuffer = "";
  activeDiscussion.currentSpeakerNpcId = null;

  if (responseText) {
    activeDiscussion.history.push({ speaker: participant.name, text: responseText });
    console.log(`[group-discussion] ${participant.name} said: "${responseText.slice(0, 80)}"`);
  } else {
    console.log(`[group-discussion] ${participant.name} had empty response, skipping`);
  }

  if (activeDiscussion.stopped) return;

  while (activeDiscussion.pendingUserMessages.length > 0) {
    const userMsg = activeDiscussion.pendingUserMessages.shift()!;
    activeDiscussion.history.push({ speaker: "镇长", text: userMsg });
    console.log(`[group-discussion] Flushed queued user message: "${userMsg.slice(0, 50)}"`);
  }

  activeDiscussion.currentIndex = (activeDiscussion.currentIndex + 1) % activeDiscussion.participants.length;

  sendToNextSpeaker();
}

export function endDiscussion(): void {
  if (!activeDiscussion) return;

  console.log(`[group-discussion] Ending discussion (${activeDiscussion.totalTurns} total turns)`);

  activeDiscussion.stopped = true;
  if (activeDiscussion.turnTimer) {
    clearTimeout(activeDiscussion.turnTimer);
    activeDiscussion.turnTimer = null;
  }
  activeDiscussion = null;
}

function buildContextMessage(discussion: ActiveDiscussion): string {
  let context = "";
  for (const entry of discussion.history) {
    context += `${entry.speaker}：${entry.text}\n`;
  }
  context += `\n轮到你了，简短回复。`;

  return context;
}

function sendToNextSpeaker(): void {
  if (!activeDiscussion || activeDiscussion.stopped) return;

  if (activeDiscussion.totalTurns >= MAX_TOTAL_TURNS) {
    console.log(`[group-discussion] Max turns (${MAX_TOTAL_TURNS}) reached, pausing`);
    return;
  }

  if (activeDiscussion.history.length === 0) return;

  const participant = activeDiscussion.participants[activeDiscussion.currentIndex];
  const contextMessage = buildContextMessage(activeDiscussion);

  activeDiscussion.currentSpeakerNpcId = participant.npcId;
  activeDiscussion.responseBuffer = "";
  activeDiscussion.totalTurns++;

  console.log(`[group-discussion] Turn ${activeDiscussion.totalTurns}: sending to ${participant.name} (${participant.npcId})`);

  activeDiscussion.turnTimer = setTimeout(() => {
    if (!activeDiscussion || activeDiscussion.currentSpeakerNpcId !== participant.npcId) return;
    console.log(`[group-discussion] ${participant.name} timed out after ${TURN_TIMEOUT_MS}ms, skipping`);
    activeDiscussion.currentSpeakerNpcId = null;
    activeDiscussion.responseBuffer = "";
    activeDiscussion.currentIndex = (activeDiscussion.currentIndex + 1) % activeDiscussion.participants.length;
    sendToNextSpeaker();
  }, TURN_TIMEOUT_MS);

  routeCitizenMessage({
    npcId: participant.npcId,
    label: participant.name,
    message: contextMessage,
    townSessionId: activeDiscussion.townSessionId,
    accountId: activeDiscussion.accountId,
    cfg: activeDiscussion.cfg,
  }).catch((err) => {
    console.error(`[group-discussion] Failed to route message to ${participant.name}:`, err);
    if (!activeDiscussion || activeDiscussion.stopped) return;
    if (activeDiscussion.turnTimer) {
      clearTimeout(activeDiscussion.turnTimer);
      activeDiscussion.turnTimer = null;
    }
    activeDiscussion.currentSpeakerNpcId = null;
    activeDiscussion.responseBuffer = "";
    activeDiscussion.currentIndex = (activeDiscussion.currentIndex + 1) % activeDiscussion.participants.length;
    sendToNextSpeaker();
  });
}
