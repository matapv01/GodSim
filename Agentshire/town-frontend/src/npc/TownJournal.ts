/**
 * TownJournal — real-time event stream + daily narrative summaries.
 *
 * Zero LLM cost for event collection; one LLM call per game-day for summary.
 * Also orchestrates nightly citizen reflections.
 */

import type { GameClock } from '../game/GameClock'
import type { TimePeriod } from '../types'
import { t } from '../i18n'

// ── TownEvent: real-time stream entry ──

export type TownEventType =
  | 'wake_up' | 'arrival' | 'departure'
  | 'encounter_start' | 'encounter_message' | 'encounter_end'
  | 'reflection' | 'go_home'
  | 'time_change' | 'mode_change'
  | 'player_message'

export interface TownEvent {
  gameTime: string
  period: TimePeriod
  type: TownEventType
  actors: string[]
  location: string
  description: string
  timestamp: number
}

// ── Daily Summary ──

export interface DailySummary {
  dayCount: number
  text: string
  eventCount: number
  timestamp: number
}

// ── Config ──

const MAX_EVENTS_PER_DAY = 100
const MAX_LONG_TERM_EVENTS = 2000
const MAX_DAILY_SUMMARIES = 30
const RECENT_EVENTS_FOR_PERCEPTION = 10
const LONG_TERM_STORAGE_KEY = 'agentshire_town_journal_archive_v1'
const CJK_TEXT_RE = /[\u3400-\u9fff]/

function containsCjkText(text: string): boolean {
  return CJK_TEXT_RE.test(text)
}

const PERIOD_LABELS: Partial<Record<TimePeriod, string>> = {
  dawn: t('journal.period.dawn'),
  morning: t('journal.period.morning'),
  noon: t('journal.period.noon'),
  afternoon: t('journal.period.afternoon'),
  dusk: t('journal.period.dusk'),
  night: t('journal.period.night'),
}

export interface TownJournalDeps {
  implicitChat: (req: {
    scene: string
    system: string
    user: string
  }) => Promise<{ text: string; fallback: boolean }>
}

export class TownJournal {
  private gameClock: GameClock
  private deps: TownJournalDeps

  private events: TownEvent[] = []
  private currentDayEvents: TownEvent[] = []
  private dailySummaries: DailySummary[] = []
  private lastDayCount = -1

  private onEventListeners: Array<(event: TownEvent) => void> = []
  private onSummaryListeners: Array<(summary: DailySummary) => void> = []

  constructor(gameClock: GameClock, deps: TownJournalDeps) {
    this.gameClock = gameClock
    this.deps = deps
    this.restoreLongTermArchive()
  }

  // ── Event Recording ──

  record(type: TownEventType, actors: string[], location: string, description: string): void {
    const state = this.gameClock.getState()
    const event: TownEvent = {
      gameTime: this.gameClock.getFormattedTime(),
      period: state.period,
      type,
      actors,
      location,
      description,
      timestamp: Date.now(),
    }

    this.events.push(event)
    if (this.events.length > MAX_EVENTS_PER_DAY * 3) {
      this.events = this.events.slice(-MAX_EVENTS_PER_DAY * 2)
    }

    if (state.dayCount !== this.lastDayCount) {
      this.currentDayEvents = []
      this.lastDayCount = state.dayCount
    }
    this.currentDayEvents.push(event)
    if (this.currentDayEvents.length > MAX_EVENTS_PER_DAY) {
      this.currentDayEvents.shift()
    }

    for (const fn of this.onEventListeners) fn(event)
    this.persistLongTermEvent(event)
  }

  // ── Convenience recorders ──

  recordWakeUp(name: string, home: string): void {
    this.record('wake_up', [name], home, t('journal.wake_up', { name }))
  }

  recordArrival(name: string, location: string, locationName: string): void {
    this.record('arrival', [name], location, t('journal.arrival', { name, location: locationName }))
  }

  recordDeparture(name: string, location: string, locationName: string): void {
    this.record('departure', [name], location, t('journal.departure', { name, location: locationName }))
  }

  recordEncounterStart(nameA: string, nameB: string, location: string): void {
    this.record('encounter_start', [nameA, nameB], location, t('journal.encounter_start', { nameA, nameB }))
  }

  recordEncounterMessage(speaker: string, text: string, location: string): void {
    this.record('encounter_message', [speaker], location, t('journal.encounter_message', { speaker, text }))
  }

  recordEncounterEnd(nameA: string, nameB: string, summary: string, location: string): void {
    this.record('encounter_end', [nameA, nameB], location, t('journal.encounter_end', { nameA, nameB, summary }))
  }

  recordGoHome(name: string, home: string): void {
    this.record('go_home', [name], home, t('journal.go_home', { name }))
  }

  recordReflection(name: string, reflection: string): void {
    this.record('reflection', [name], 'home', t('journal.reflection', { name, reflection }))
  }

  recordTimeChange(period: TimePeriod): void {
    const desc = PERIOD_LABELS[period] ?? t('journal.period_change', { period })
    this.record('time_change', [], 'town', desc)
  }

  recordModeChange(mode: 'life' | 'work', detail?: string): void {
    const desc = mode === 'work'
      ? (detail ?? t('journal.mode_work'))
      : (detail ?? t('journal.mode_life'))
    this.record('mode_change', [], 'town', desc)
  }

  recordPlayerMessage(name: string, text: string, target?: string): void {
    const desc = target
      ? t('journal.player_message_to', { name, target, text })
      : t('journal.player_message', { name, text })
    this.record('player_message', [name], 'town', desc)
  }

  // ── Queries (for L2 tactical perception) ──

  getRecentEvents(count?: number): TownEvent[] {
    const n = count ?? RECENT_EVENTS_FOR_PERCEPTION
    return this.currentDayEvents.slice(-n)
  }

  getRecentArchiveEvents(count?: number): TownEvent[] {
    const n = count ?? RECENT_EVENTS_FOR_PERCEPTION
    return this.events.slice(-n)
  }

  getRecentDescriptions(count?: number): string[] {
    return this.getRecentEvents(count).map(e => `[${e.gameTime}] ${e.description}`)
  }

  getCurrentDayEventCount(): number {
    return this.currentDayEvents.length
  }

  // ── Daily Summaries ──

  getDailySummary(dayCount: number): DailySummary | undefined {
    return this.dailySummaries.find(s => s.dayCount === dayCount)
  }

  getAllSummaries(): ReadonlyArray<DailySummary> {
    return this.dailySummaries
  }

  async generateDailySummary(dayCount: number): Promise<DailySummary> {
    const existing = this.getDailySummary(dayCount)
    if (existing) return existing

    const dayEvents = this.currentDayEvents.length > 0
      ? this.currentDayEvents
      : this.events.filter(e => {
          const state = this.gameClock.getState()
          return true
        }).slice(-50)

    const eventLog = dayEvents
      .filter(e => e.type !== 'encounter_message' && e.type !== 'time_change')
      .map(e => `[${e.gameTime}] ${e.description}`)
      .join('\n')

    let text: string

    if (eventLog.length > 0) {
      try {
        const result = await this.deps.implicitChat({
          scene: 'town_journal',
          system: 'Bạn là người ghi nhật kí thị trấn. Dựa trên các sự kiện trong ngày, hãy viết một đoạn nhật kí 3-5 câu bằng tiếng Việt. Giọng văn ấm áp, tự nhiên, như đang kể lại chuyện trong thị trấn. Chỉ xuất nội dung nhật kí, không dùng tiếng Trung, không markdown.',
          user: `Sự kiện ngày ${dayCount}:\n${eventLog}`,
        })
        text = result.fallback || containsCjkText(result.text) ? this.buildFallbackSummary(dayEvents) : result.text
      } catch {
        text = this.buildFallbackSummary(dayEvents)
      }
    } else {
      text = 'Một ngày yên bình, mọi thứ trong thị trấn vẫn diễn ra như thường lệ.'
    }

    const summary: DailySummary = {
      dayCount,
      text,
      eventCount: dayEvents.length,
      timestamp: Date.now(),
    }

    this.dailySummaries.push(summary)
    if (this.dailySummaries.length > MAX_DAILY_SUMMARIES) {
      this.dailySummaries.shift()
    }

    for (const fn of this.onSummaryListeners) fn(summary)

    return summary
  }

  private buildFallbackSummary(events: TownEvent[]): string {
    const actors = new Set<string>()
    let encounters = 0
    const places = new Set<string>()

    for (const e of events) {
      for (const a of e.actors) actors.add(a)
      if (e.type === 'encounter_end') encounters++
      if (e.location && e.location !== 'town' && e.location !== 'home') places.add(e.location)
    }

    const parts: string[] = []
    if (actors.size > 0) parts.push(`${[...actors].slice(0, 3).join(', ')} đã có một ngày khá bận rộn`)
    if (encounters > 0) parts.push(`có ${encounters} cuộc trò chuyện đáng nhớ`)
    if (places.size > 0) parts.push(`mọi người ghé qua ${[...places].slice(0, 3).join(', ')}`)

    return parts.length > 0 ? parts.join(', ') + '.' : 'Một ngày yên bình.'
  }

  // ── Nightly Reflection Orchestration ──

  async runNightlyReflections(citizens: Array<{
    npcId: string
    name: string
    persona?: { coreSummary: string; speakingStyle?: string }
    journal: import('./ActivityJournal').ActivityJournal
  }>): Promise<void> {
    const dayCount = this.gameClock.getState().dayCount

    for (const citizen of citizens) {
      const recentActivities = citizen.journal.getRecentActivities(5)
        .map(a => `${a.time} ${a.action} @ ${a.location}`)
        .join(', ')

      const system = [
        `Bạn là ${citizen.name}. ${citizen.persona?.coreSummary ?? ''}`,
        'Nhìn lại hôm nay, hãy viết một câu cảm nghĩ ngắn bằng tiếng Việt, tối đa 30 từ. Giọng ấm áp, đời thường. Chỉ xuất nội dung cảm nghĩ, không dùng tiếng Trung.',
      ].join('\n')

      try {
        const result = await this.deps.implicitChat({
          scene: 'daily_reflection',
          system,
          user: recentActivities || 'Hôm nay không có việc gì đặc biệt.',
        })

        const reflection = result.text && !containsCjkText(result.text) ? result.text : 'Hôm nay trôi qua khá ổn.'
        citizen.journal.addReflection(dayCount, reflection)
        this.recordReflection(citizen.name, reflection)
      } catch {
        const fallback = 'Hôm nay trôi qua khá ổn.'
        citizen.journal.addReflection(dayCount, fallback)
        this.recordReflection(citizen.name, fallback)
      }
    }

    await this.generateDailySummary(dayCount)
  }

  // ── Listeners ──

  onEvent(fn: (event: TownEvent) => void): void {
    this.onEventListeners.push(fn)
  }

  onSummary(fn: (summary: DailySummary) => void): void {
    this.onSummaryListeners.push(fn)
  }

  // ── Snapshot persistence ──

  toJSON(): {
    events: TownEvent[]
    currentDayEvents: TownEvent[]
    dailySummaries: DailySummary[]
    lastDayCount: number
  } {
    return {
      events: this.events.slice(),
      currentDayEvents: this.currentDayEvents.slice(),
      dailySummaries: this.dailySummaries.slice(),
      lastDayCount: this.lastDayCount,
    }
  }

  restore(data: {
    events?: TownEvent[]
    currentDayEvents?: TownEvent[]
    dailySummaries?: DailySummary[]
    lastDayCount?: number
  }): void {
    if (data.events) this.events = data.events.slice()
    if (data.currentDayEvents) this.currentDayEvents = data.currentDayEvents.slice()
    if (data.dailySummaries) this.dailySummaries = data.dailySummaries.slice()
    if (data.lastDayCount != null) this.lastDayCount = data.lastDayCount
  }

  clearAll(): void {
    this.events.length = 0
    this.currentDayEvents.length = 0
    this.dailySummaries.length = 0
    this.lastDayCount = this.gameClock.getState().dayCount
    try {
      localStorage.removeItem(LONG_TERM_STORAGE_KEY)
    } catch {
      // localStorage unavailable
    }
  }

  private persistLongTermEvent(event: TownEvent): void {
    try {
      const raw = localStorage.getItem(LONG_TERM_STORAGE_KEY)
      const archive = raw ? JSON.parse(raw) : []
      const events = Array.isArray(archive) ? archive : []
      events.push(event)
      localStorage.setItem(LONG_TERM_STORAGE_KEY, JSON.stringify(events.slice(-MAX_LONG_TERM_EVENTS)))
    } catch {
      // localStorage full or unavailable
    }
  }

  private restoreLongTermArchive(): void {
    try {
      const raw = localStorage.getItem(LONG_TERM_STORAGE_KEY)
      if (!raw) return
      const archive = JSON.parse(raw)
      if (!Array.isArray(archive)) return
      const events = archive
        .filter((event): event is TownEvent => !!event && typeof event.description === 'string' && typeof event.timestamp === 'number')
        .slice(-MAX_LONG_TERM_EVENTS)
      this.events = events.slice()
      this.currentDayEvents = events.slice(-MAX_EVENTS_PER_DAY)
      this.lastDayCount = this.gameClock.getState().dayCount
    } catch {
      // Ignore corrupted old archive.
    }
  }

  // ── Cleanup ──

  destroy(): void {
    this.onEventListeners.length = 0
    this.onSummaryListeners.length = 0
  }
}
