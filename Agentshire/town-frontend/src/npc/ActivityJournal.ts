import type { GameClock } from '../game/GameClock'
import type {
  ActivityEntry, ActivityAction, DialogueRecord,
  Relationship, DailyReflection, DailyPlan, DailyPlanItem,
} from '../types'

const MAX_ENTRIES = 20
const MAX_DIALOGUES = 5
const MAX_REFLECTIONS = 7
const MAX_RECENT_TOPICS = 3

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function inferRelationshipSignals(topic?: string): Partial<Pick<Relationship, 'romance' | 'tension' | 'jealousy' | 'trust'>> {
  const text = (topic ?? '').toLowerCase()
  const hasAny = (words: string[]) => words.some(w => text.includes(w))
  const signals: Partial<Pick<Relationship, 'romance' | 'tension' | 'jealousy' | 'trust'>> = {}
  if (hasAny(['tán tỉnh', 'rủ đi chơi', 'rủ đi riêng', 'hẹn hò', 'thích', 'ham muốn', 'hấp dẫn', 'đi dạo riêng', 'mập mờ'])) {
    signals.romance = 0.12
    signals.tension = 0.04
  }
  if (hasAny(['ghen', 'ngoại tình', 'bắt cá', 'tình cũ', 'đánh ghen', 'nghi ngờ'])) {
    signals.jealousy = 0.14
    signals.tension = 0.12
  }
  if (hasAny(['tâm sự', 'gia đình', 'bí mật', 'tin tưởng', 'kể riêng', 'đừng kể'])) {
    signals.trust = 0.1
  }
  if (hasAny(['cãi', 'khó chịu', 'giận', 'tránh mặt', 'phản bội'])) {
    signals.tension = Math.max(signals.tension ?? 0, 0.1)
  }
  return signals
}

function deriveRelationshipLabel(rel: Relationship): { label: string; status: Relationship['status'] } {
  if ((rel.jealousy ?? 0) > 0.55 || rel.sentiment < -0.45) return { label: 'căng thẳng/ghen', status: 'strained' }
  if ((rel.tension ?? 0) > 0.6 && (rel.romance ?? 0) > 0.35) return { label: 'mập mờ nguy hiểm', status: 'flirt' }
  if ((rel.romance ?? 0) > 0.72 && rel.sentiment > 0.25) return { label: 'người yêu', status: 'lover' }
  if ((rel.romance ?? 0) > 0.42) return { label: 'có cảm tình', status: 'crush' }
  if ((rel.trust ?? 0) > 0.62 && rel.sentiment > 0.25) return { label: 'bạn thân', status: 'close_friend' }
  if (rel.sentiment > 0.35 || rel.interactionCount >= 8) return { label: 'bạn quen', status: 'friend' }
  if (rel.interactionCount >= 2) return { label: 'hàng xóm quen', status: 'neighbor' }
  return { label: 'người lạ', status: 'stranger' }
}

export class ActivityJournal {
  readonly npcId: string
  readonly npcName: string
  private gameClock: GameClock
  private entries: ActivityEntry[] = []
  private dialogues: DialogueRecord[] = []
  private relationships: Map<string, Relationship> = new Map()
  private reflections: DailyReflection[] = []
  private _currentPlan: DailyPlan | null = null

  constructor(npcId: string, npcName: string, gameClock: GameClock) {
    this.npcId = npcId
    this.npcName = npcName
    this.gameClock = gameClock
  }

  record(data: {
    location: string
    locationName: string
    action: ActivityAction
    detail?: string
    relatedNpc?: string
  }): void {
    this.entries.push({
      ...data,
      time: this.gameClock.getFormattedTime(),
      timestamp: Date.now(),
    })
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift()
    }
  }

  recordDialogue(dialogue: DialogueRecord): void {
    this.dialogues.push(dialogue)
    if (this.dialogues.length > MAX_DIALOGUES) {
      this.dialogues.shift()
    }
  }

  /**
   * Generate context object for LLM encounter dialogue prompts.
   */
  toContextJSON(options: {
    currentLocation: string
    currentLocationName: string
    encounteredNpc: { name: string; lastSeenAt?: string }
  }): object {
    return {
      current_time: this.gameClock.getFormattedTime(),
      current_period: this.gameClock.getPeriod(),
      current_location: options.currentLocation,
      current_location_name: options.currentLocationName,
      encountered_npc: options.encounteredNpc,
      my_recent_activities: this.getRecentActivities(5),
      my_recent_dialogues: this.getRecentDialogueSummaries(2),
    }
  }

  getRecentActivities(count: number): Array<{ time: string; action: string; location: string; detail?: string }> {
    const filtered: ActivityEntry[] = []
    let lastStayingLoc: string | null = null
    for (let i = this.entries.length - 1; i >= 0 && filtered.length < count * 2; i--) {
      const e = this.entries[i]
      if (e.action === 'staying') {
        if (e.location === lastStayingLoc) continue
        lastStayingLoc = e.location
      }
      filtered.unshift(e)
    }

    filtered.sort((a, b) => {
      const aChatScore = a.action === 'chatted' ? 1 : 0
      const bChatScore = b.action === 'chatted' ? 1 : 0
      if (aChatScore !== bChatScore) return bChatScore - aChatScore
      return a.timestamp - b.timestamp
    })

    return filtered.slice(0, count).map(e => ({
      time: e.time,
      action: e.action,
      location: e.locationName,
      ...(e.detail ? { detail: e.detail } : {}),
    }))
  }

  getRecentDialogueSummaries(count: number): Array<{ time: string; with: string; topic: string }> {
    return this.dialogues.slice(-count).map(d => {
      const state = this.gameClock.getState()
      const hh = String(state.hour).padStart(2, '0')
      const mm = String(state.minute).padStart(2, '0')
      return {
        time: `${hh}:${mm}`,
        with: d.partnerName,
        topic: d.summary,
      }
    })
  }

  getEntries(): ReadonlyArray<ActivityEntry> {
    return this.entries
  }

  getDialogues(): ReadonlyArray<DialogueRecord> {
    return this.dialogues
  }

  clear(): void {
    this.entries.length = 0
    this.dialogues.length = 0
  }

  // ── Relationship Graph ──

  getRelationship(npcId: string): Relationship | undefined {
    return this.relationships.get(npcId)
  }

  getRelationships(): ReadonlyArray<Relationship> {
    return [...this.relationships.values()]
  }

  getRelationshipMap(): ReadonlyMap<string, Relationship> {
    return this.relationships
  }

  updateRelationship(partner: { npcId: string; name: string }, update: {
    topic?: string
    sentimentDelta?: number
    label?: string
    romanceDelta?: number
    trustDelta?: number
    tensionDelta?: number
    jealousyDelta?: number
  }): void {
    let rel = this.relationships.get(partner.npcId)
    if (!rel) {
      rel = {
        npcId: partner.npcId,
        name: partner.name,
        label: update.label ?? 'người lạ',
        sentiment: 0,
        familiarity: 0,
        trust: 0,
        romance: 0,
        tension: 0,
        jealousy: 0,
        status: 'stranger',
        lastInteraction: Date.now(),
        interactionCount: 0,
        recentTopics: [],
      }
    }

    rel.lastInteraction = Date.now()
    rel.interactionCount++
    rel.familiarity = clamp01((rel.familiarity ?? 0) + 0.08)
    if (update.label) rel.label = update.label
    if (update.sentimentDelta != null) {
      rel.sentiment = Math.max(-1, Math.min(1, rel.sentiment + update.sentimentDelta))
    }
    const inferred = inferRelationshipSignals(update.topic)
    rel.romance = clamp01((rel.romance ?? 0) + (update.romanceDelta ?? 0) + (inferred.romance ?? 0))
    rel.trust = clamp01((rel.trust ?? 0) + (update.trustDelta ?? 0) + (inferred.trust ?? 0))
    rel.tension = clamp01((rel.tension ?? 0) + (update.tensionDelta ?? 0) + (inferred.tension ?? 0))
    rel.jealousy = clamp01((rel.jealousy ?? 0) + (update.jealousyDelta ?? 0) + (inferred.jealousy ?? 0))
    if (update.topic) {
      rel.recentTopics.push(update.topic)
      if (rel.recentTopics.length > MAX_RECENT_TOPICS) {
        rel.recentTopics.shift()
      }
    }
    if (!update.label) {
      const derived = deriveRelationshipLabel(rel)
      rel.label = derived.label
      rel.status = derived.status
    }

    this.relationships.set(partner.npcId, rel)
  }

  getRelationshipsForPrompt(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const rel of this.relationships.values()) {
      const sentiment = rel.sentiment > 0.3 ? '，关系不错' : rel.sentiment < -0.3 ? '，关系一般' : ''
      result[rel.name] = `${rel.label}${sentiment}`
    }
    return result
  }

  // ── Daily Reflections ──

  addReflection(dayCount: number, text: string): void {
    this.reflections.push({ dayCount, text, timestamp: Date.now() })
    if (this.reflections.length > MAX_REFLECTIONS) {
      this.reflections.shift()
    }
  }

  getLatestReflection(): DailyReflection | undefined {
    return this.reflections.length > 0 ? this.reflections[this.reflections.length - 1] : undefined
  }

  getReflections(): ReadonlyArray<DailyReflection> {
    return this.reflections
  }

  getYesterdaySummary(currentDayCount: number): string {
    const yesterday = this.reflections.find(r => r.dayCount === currentDayCount - 1)
    return yesterday?.text ?? '没什么特别的'
  }

  // ── Daily Plan ──

  get currentPlan(): DailyPlan | null {
    return this._currentPlan
  }

  setDailyPlan(dayCount: number, items: DailyPlanItem[]): void {
    this._currentPlan = {
      dayCount,
      items,
      currentIndex: 0,
      suspended: false,
    }
  }

  advancePlan(): DailyPlanItem | null {
    if (!this._currentPlan || this._currentPlan.suspended) return null
    if (this._currentPlan.currentIndex >= this._currentPlan.items.length) return null
    const item = this._currentPlan.items[this._currentPlan.currentIndex]
    this._currentPlan.currentIndex++
    return item
  }

  getCurrentPlanItem(): DailyPlanItem | null {
    if (!this._currentPlan || this._currentPlan.suspended) return null
    const idx = this._currentPlan.currentIndex
    if (idx >= this._currentPlan.items.length) return null
    return this._currentPlan.items[idx]
  }

  suspendPlan(): void {
    if (this._currentPlan) this._currentPlan.suspended = true
  }

  resumePlan(): void {
    if (this._currentPlan) this._currentPlan.suspended = false
  }

  isPlanActive(): boolean {
    return this._currentPlan != null && !this._currentPlan.suspended
  }

  // ── Snapshot persistence ──

  toJSON(): {
    npcId: string
    npcName: string
    entries: ActivityEntry[]
    dialogues: DialogueRecord[]
    relationships: Array<[string, Relationship]>
    reflections: DailyReflection[]
    currentPlan: DailyPlan | null
  } {
    return {
      npcId: this.npcId,
      npcName: this.npcName,
      entries: this.entries.slice(),
      dialogues: this.dialogues.slice(),
      relationships: Array.from(this.relationships.entries()),
      reflections: this.reflections.slice(),
      currentPlan: this._currentPlan ? { ...this._currentPlan, items: this._currentPlan.items.slice() } : null,
    }
  }

  restore(data: {
    entries?: ActivityEntry[]
    dialogues?: DialogueRecord[]
    relationships?: Array<[string, Relationship]>
    reflections?: DailyReflection[]
    currentPlan?: DailyPlan | null
  }): void {
    if (data.entries) this.entries = data.entries.slice()
    if (data.dialogues) this.dialogues = data.dialogues.slice()
    if (data.relationships) this.relationships = new Map(data.relationships)
    if (data.reflections) this.reflections = data.reflections.slice()
    if (data.currentPlan !== undefined) this._currentPlan = data.currentPlan
  }

  // ── Extended Context for AgentBrain ──

  toAgentBrainContext(options: {
    currentLocation: string
    currentLocationName: string
    nearbyNpcs?: Array<{ name: string; npcId: string; distance: number }>
    townRecent?: string[]
  }): object {
    const nearby = options.nearbyNpcs?.map(n => ({
      name: n.name,
      distance: n.distance,
      relationship: this.relationships.get(n.npcId)?.label ?? '不认识',
    }))

    return {
      current_time: this.gameClock.getFormattedTime(),
      current_period: this.gameClock.getPeriod(),
      current_location: options.currentLocation,
      current_location_name: options.currentLocationName,
      current_plan: this.getCurrentPlanItem(),
      nearby_npcs: nearby ?? [],
      relationships: this.getRelationshipsForPrompt(),
      recent_memory: this.getRecentActivities(5).map(a =>
        `${a.time} ${a.action} @ ${a.location}${a.detail ? ': ' + a.detail : ''}`
      ),
      recent_dialogues: this.getRecentDialogueSummaries(2),
      town_recent: options.townRecent ?? [],
    }
  }
}
