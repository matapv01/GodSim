// @desc Daily behavior scheduling, AgentBrain integration, and nightly routine orchestration
import { DailyBehavior, generateRouteProfile } from '../npc/DailyBehavior'
import { ActivityJournal } from '../npc/ActivityJournal'
import { AgentBrain } from '../npc/AgentBrain'
import { SpotAllocator } from '../npc/SpotAllocator'
import type { NPC } from '../npc/NPC'
import type { NPCManager } from '../npc/NPCManager'
import type { EncounterManager } from '../npc/EncounterManager'
import type { PersonaStore } from '../npc/PersonaStore'
import type { TownJournal } from '../npc/TownJournal'
import type { GameClock } from './GameClock'
import { BUILDING_REGISTRY, WAYPOINTS, type WeatherType } from '../types'

export interface DailySchedulerDeps {
  npcManager: NPCManager
  gameClock: GameClock
  encounterManager: EncounterManager
  personaStore: PersonaStore
  getTownJournal: () => TownJournal
  getCurrentSceneType: () => string
  getWeather?: () => WeatherType
  getNpcSpecialty?: (npcId: string) => string | undefined
  getNpcHomeBuilding?: (npcId: string) => string | undefined
}

export class DailyScheduler {
  private dailyBehaviors = new Map<string, DailyBehavior>()
  private activityJournals = new Map<string, ActivityJournal>()
  private agentBrains = new Map<string, AgentBrain>()
  private dailyBehaviorStartTimer: ReturnType<typeof setTimeout> | null = null
  private dailyBehaviorEligibleNpcIds = new Set<string>()
  private spotAllocator = new SpotAllocator()
  private _implicitChatFn: ((req: {
    scene: string; system: string; user: string; maxTokens?: number; extraStop?: string[]
  }) => Promise<{ text: string; fallback: boolean }>) | null = null

  private deps: DailySchedulerDeps

  constructor(deps: DailySchedulerDeps) {
    this.deps = deps
  }

  getDailyBehaviors(): Map<string, DailyBehavior> { return this.dailyBehaviors }
  getActivityJournals(): Map<string, ActivityJournal> { return this.activityJournals }
  getAgentBrains(): Map<string, AgentBrain> { return this.agentBrains }
  getEligibleNpcIds(): Set<string> { return this.dailyBehaviorEligibleNpcIds }

  setImplicitChatFn(fn: typeof this._implicitChatFn): void {
    this._implicitChatFn = fn
  }

  getImplicitChatFn() { return this._implicitChatFn }

  private _soulModeEnabled = true
  private _savedImplicitChatFn: typeof this._implicitChatFn = null

  enableSoulMode(): void {
    this._soulModeEnabled = true
    if (this._savedImplicitChatFn) {
      this._implicitChatFn = this._savedImplicitChatFn
    }
  }

  disableSoulMode(): void {
    this._soulModeEnabled = false
    this._savedImplicitChatFn = this._implicitChatFn
    this._implicitChatFn = null
  }

  isSoulModeEnabled(): boolean { return this._soulModeEnabled }

  addEligibleNpcId(id: string): void {
    this.dailyBehaviorEligibleNpcIds.add(id)
  }

  removeEligibleNpcId(id: string): void {
    this.dailyBehaviorEligibleNpcIds.delete(id)
  }

  getBestDailyBehaviorHome(npc: NPC): string {
    const configuredHome = this.deps.getNpcHomeBuilding?.(npc.id)
    if (configuredHome && WAYPOINTS[configuredHome]) return configuredHome

    const homeOptions: Array<{ key: string; x: number; z: number }> = [
      { key: 'house_a_door', x: WAYPOINTS.house_a_door.x, z: WAYPOINTS.house_a_door.z },
      { key: 'house_b_door', x: WAYPOINTS.house_b_door.x, z: WAYPOINTS.house_b_door.z },
      { key: 'house_c_door', x: WAYPOINTS.house_c_door.x, z: WAYPOINTS.house_c_door.z },
      { key: 'house_d_door', x: WAYPOINTS.house_d_door.x, z: WAYPOINTS.house_d_door.z },
      { key: 'house_e_door', x: WAYPOINTS.house_e_door.x, z: WAYPOINTS.house_e_door.z },
      { key: 'house_f_door', x: WAYPOINTS.house_f_door.x, z: WAYPOINTS.house_f_door.z },
      { key: 'house_g_door', x: WAYPOINTS.house_g_door.x, z: WAYPOINTS.house_g_door.z },
    ]

    const pos = npc.getPosition()
    let bestHome = homeOptions[0]
    let bestDistSq = Number.POSITIVE_INFINITY
    for (const h of homeOptions) {
      const dx = h.x - pos.x
      const dz = h.z - pos.z
      const d2 = dx * dx + dz * dz
      if (d2 < bestDistSq) {
        bestDistSq = d2
        bestHome = h
      }
    }
    return bestHome.key
  }

  startDailyBehaviors(): void {
    if (this.deps.getCurrentSceneType() !== 'town') return
    const workers = this.deps.npcManager
      .getWorkers()
      .filter((npc) => this.dailyBehaviorEligibleNpcIds.has(npc.id))

    if (workers.length === 0) {
      for (const behavior of this.dailyBehaviors.values()) behavior.stop()
      this.dailyBehaviors.clear()
      return
    }

    const workerIds = new Set(workers.map((npc) => npc.id))
    for (const [npcId, behavior] of this.dailyBehaviors.entries()) {
      if (workerIds.has(npcId)) continue
      behavior.stop()
      this.dailyBehaviors.delete(npcId)
    }

    workers.forEach((npc, i) => {
      if (this.dailyBehaviors.has(npc.id)) return
      this.createAndStartBehavior(npc, 2000 + i * (2000 + Math.floor(Math.random() * 2000)))
    })
  }

  stopBehaviorForNpcs(npcIds: string[]): void {
    for (const id of npcIds) {
      const behavior = this.dailyBehaviors.get(id)
      if (behavior) {
        behavior.stop()
        this.dailyBehaviors.delete(id)
      }
      this.agentBrains.delete(id)
    }
  }

  startBehaviorForNpc(npcId: string): void {
    if (this.dailyBehaviors.has(npcId)) return
    if (!this.dailyBehaviorEligibleNpcIds.has(npcId)) return
    const npc = this.deps.npcManager.get(npcId)
    if (!npc) return
    this.createAndStartBehavior(npc, 500, true)
  }

  private createAndStartBehavior(npc: NPC, delayMs: number, resumeFromCurrentPosition = false): void {
    const homeKey = this.getBestDailyBehaviorHome(npc)
    const specialty = this.deps.getNpcSpecialty?.(npc.id) ?? this.deps.personaStore.get(npc.id)?.specialty
    const profile = generateRouteProfile(npc.id, homeKey, specialty)
    const behavior = new DailyBehavior(npc, this.deps.gameClock, profile, this.spotAllocator)

    let journal = this.activityJournals.get(npc.id)
    if (!journal) {
      journal = new ActivityJournal(npc.id, npc.label ?? npc.id, this.deps.gameClock)
      this.activityJournals.set(npc.id, journal)
    }
    behavior.setJournal(journal)

    if (npc.id !== 'steward' && !this.agentBrains.has(npc.id)) {
      const persona = this.deps.personaStore.get(npc.id)
      const brain = new AgentBrain(npc, this.deps.gameClock, journal, persona, {
        implicitChat: this.implicitChatForBrain.bind(this),
        getNearbyNpcs: this.getNearbyNpcsForBrain.bind(this),
        getTownRecent: () => this.deps.getTownJournal().getRecentDescriptions(5),
        getWeather: () => this.deps.getWeather?.() ?? 'clear',
        onTalkTo: (initiatorId, targetName, reason) => {
          this.onBrainTalkTo(initiatorId, targetName, reason)
        },
      })
      behavior.setAgentBrain(brain)
      brain.start()
      this.agentBrains.set(npc.id, brain)
    }

    this.dailyBehaviors.set(npc.id, behavior)
    if (resumeFromCurrentPosition) {
      behavior.resumeFromCurrentPosition()
    } else {
      behavior.start(delayMs)
    }
  }

  stopDailyBehaviors(): void {
    if (this.dailyBehaviorStartTimer) {
      clearTimeout(this.dailyBehaviorStartTimer)
      this.dailyBehaviorStartTimer = null
    }
    for (const behavior of this.dailyBehaviors.values()) behavior.stop()
    this.dailyBehaviors.clear()
    this.agentBrains.clear()
  }

  scheduleStartDailyBehaviors(delayMs: number): void {
    if (this.dailyBehaviorStartTimer) {
      clearTimeout(this.dailyBehaviorStartTimer)
    }
    this.dailyBehaviorStartTimer = setTimeout(() => {
      this.dailyBehaviorStartTimer = null
      this.startDailyBehaviors()
    }, delayMs)
  }

  async implicitChatForBrain(req: {
    scene: string; system: string; user: string; maxTokens?: number; extraStop?: string[]
  }): Promise<{ text: string; fallback: boolean }> {
    if (!this._implicitChatFn) return { text: '', fallback: true }
    return this._implicitChatFn(req)
  }

  getNearbyNpcsForBrain(npcId: string, radius: number): Array<{ npcId: string; name: string; distance: number }> {
    const npc = this.deps.npcManager?.get(npcId)
    if (!npc) return []
    const allNpcs = this.deps.npcManager?.getAll() ?? []
    const result: Array<{ npcId: string; name: string; distance: number }> = []
    for (const other of allNpcs) {
      if (other.id === npcId || other.id === 'steward' || other.id === 'user') continue
      if (this.deps.encounterManager && this.deps.encounterManager.getActiveDialogueCount() > 0) continue
      const dist = npc.getPosition().distanceTo(other.getPosition())
      if (dist < radius) {
        result.push({ npcId: other.id, name: other.label ?? other.id, distance: dist })
      }
    }
    return result.sort((a, b) => a.distance - b.distance)
  }

  onBrainTalkTo(initiatorId: string, targetName: string, reason: string): void {
    const allNpcs = this.deps.npcManager?.getAll() ?? []
    const target = allNpcs.find(n => (n.label ?? n.id) === targetName || n.id === targetName)
    if (!target) return
    const initiator = this.deps.npcManager?.get(initiatorId)
    if (!initiator) return
    this.deps.encounterManager?.requestEncounter(initiator, target, reason)
  }

  async triggerNightlyRoutine(): Promise<void> {
    if (!this._implicitChatFn) return

    const citizens: Array<{
      npcId: string
      name: string
      persona?: { coreSummary: string; speakingStyle?: string }
      journal: ActivityJournal
    }> = []

    for (const [npcId, journal] of this.activityJournals) {
      if (npcId === 'steward') continue
      const npc = this.deps.npcManager?.get(npcId)
      if (!npc) continue
      const persona = this.deps.personaStore.get(npcId)
      citizens.push({
        npcId,
        name: npc.label ?? npcId,
        persona: persona ? { coreSummary: persona.coreSummary, speakingStyle: persona.speakingStyle } : undefined,
        journal,
      })
    }

    if (citizens.length > 0) {
      await this.deps.getTownJournal().runNightlyReflections(citizens)
    }
  }

  async dialogueProviderImpl(opts: {
    scene: 'encounter_init' | 'encounter_reply' | 'dialogue_summary'
    speaker: { id: string; name: string; persona?: any }
    listener: { id: string; name: string }
    nearbyAudience?: Array<{ id: string; name: string; distanceToSpeaker: number; distanceToListener: number }>
    journalContext?: object
    conversationSoFar: Array<{ speaker: string; text: string }>
    turnNumber: number
    maxTurns: number
    tacticalReason?: string
  }): Promise<string> {
    if (!this._implicitChatFn) {
      return ''
    }

    if (opts.scene === 'dialogue_summary') {
      const transcript = opts.conversationSoFar.map(t => `${t.speaker}: ${t.text}`).join('\n')
      const result = await this._implicitChatFn({
        scene: 'dialogue_summary',
        system: '用一句简短的话总结这段对话的主题和内容，20字以内。只输出总结。',
        user: transcript,
      })
      return result.text
    }

    const persona = opts.speaker.persona
    const name = persona?.name ?? opts.speaker.name
    const speakerHome = this.deps.getNpcHomeBuilding?.(opts.speaker.id)
    const listenerHome = this.deps.getNpcHomeBuilding?.(opts.listener.id)
    const speakerProfession = this.deps.getNpcSpecialty?.(opts.speaker.id)
    const listenerProfession = this.deps.getNpcSpecialty?.(opts.listener.id)
    const professionRule = [
      speakerProfession ? `Nghề của bạn: ${speakerProfession}.` : '',
      listenerProfession ? `Nghề của ${opts.listener.name}: ${listenerProfession}.` : '',
      'Lời nói phải khớp nghề: nhân viên công ty nói về ca làm/công ty; nha sĩ/bác sĩ gắn phòng khám; chủ sạp gắn chợ; pha chế gắn cafe; đầu bếp gắn quán ăn. Nếu một bên là cảnh sát/công an, bên kia tự dè chừng, kính nể hoặc né chuyện nhạy cảm tùy quan hệ.',
    ].filter(Boolean).join('\n')
    const speakerHomeName = speakerHome ? (BUILDING_REGISTRY.find(b => b.key === speakerHome)?.name ?? speakerHome) : undefined
    const listenerHomeName = listenerHome ? (BUILDING_REGISTRY.find(b => b.key === listenerHome)?.name ?? listenerHome) : undefined
    const homeRule = speakerHome && listenerHome && speakerHome === listenerHome
      ? `Bạn và ${opts.listener.name} sống cùng nhà: ${speakerHomeName}. Khi nhắc về nhà, phải nói "về nhà mình/nhà chung/nhà tụi mình", không nói như đó là nhà riêng của người kia.`
      : [
          speakerHomeName ? `Nhà của bạn: ${speakerHomeName}.` : '',
          listenerHomeName ? `Nhà của ${opts.listener.name}: ${listenerHomeName}.` : '',
          'Không tự tiện rủ hoặc đi vào nhà riêng của người khác nếu chưa có quan hệ/lời mời rõ ràng; ưu tiên hẹn ở chợ, cafe, công viên, quán ăn, công ty.',
        ].filter(Boolean).join('\n')
    const audience = opts.nearbyAudience ?? []
    const privacyRule = audience.length
      ? [
          `Đang có người khác đủ gần để nghe: ${audience.map(p => `${p.name} (${Math.min(p.distanceToSpeaker, p.distanceToListener).toFixed(1)}m)`).join(', ')}.`,
          'Nếu chủ đề là bí mật, tán tỉnh, ghen tuông, gia đình nhạy cảm, hẹn riêng, hoặc kế hoạch kín, nhân vật phải nhận ra bối cảnh này.',
          'Không nói thẳng chuyện riêng trước mặt người thứ ba. Hãy nói bóng gió, hạ giọng, rủ ra địa điểm khác/thời điểm khác, hoặc dừng câu chuyện.',
        ].join('\n')
      : 'Không có người thứ ba đủ gần để nghe; có thể nói riêng tư hơn nếu hợp quan hệ và tình huống.'
    let system: string

    if (opts.scene === 'encounter_init') {
      system = [
        `Bạn là ${name}. ${persona?.coreSummary ?? ''}`,
        persona?.speakingStyle ? `Phong cách nói: ${persona.speakingStyle}` : '',
        `Bây giờ là ${this.deps.gameClock?.getFormattedTime() ?? 'ban ngày'}. Bạn chủ động bắt chuyện với ${opts.listener.name}.`,
        opts.tacticalReason ? `Động cơ của bạn: ${opts.tacticalReason}` : '',
        professionRule,
        homeRule,
        privacyRule,
        'Viết 1 câu thoại tiếng Việt tự nhiên, tối đa 24 từ. Chỉ xuất nội dung thoại.',
      ].filter(Boolean).join('\n')
    } else {
      system = [
        `Bạn là ${name}. ${persona?.coreSummary ?? ''}`,
        persona?.speakingStyle ? `Phong cách nói: ${persona.speakingStyle}` : '',
        professionRule,
        homeRule,
        privacyRule,
        'Tiếp tục cuộc trò chuyện bằng 1 câu tiếng Việt tự nhiên, tối đa 24 từ. Nếu nên kết thúc thì thêm [END]. Chỉ xuất nội dung thoại.',
      ].filter(Boolean).join('\n')
    }

    const user = opts.scene === 'encounter_init'
      ? JSON.stringify({ instruction: 'bắt chuyện', nearby_audience: audience })
      : JSON.stringify({
          conversation_so_far: opts.conversationSoFar,
          turn_number: opts.turnNumber,
          max_turns: opts.maxTurns,
          nearby_audience: audience,
        })

    const result = await this._implicitChatFn({
      scene: opts.scene,
      system,
      user,
      extraStop: ['[END]'],
    })

    return result.text
  }

  removeNpc(npcId: string): void {
    this.dailyBehaviorEligibleNpcIds.delete(npcId)
    this.activityJournals.delete(npcId)
    this.agentBrains.delete(npcId)
    const dailyBehavior = this.dailyBehaviors.get(npcId)
    if (dailyBehavior) {
      dailyBehavior.stop()
      this.dailyBehaviors.delete(npcId)
    }
  }
}
