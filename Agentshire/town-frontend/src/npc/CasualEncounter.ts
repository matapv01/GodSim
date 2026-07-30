/**
 * CasualEncounter — lightweight NPC-to-NPC interactions.
 *
 * Two types of interactions:
 * 1. Passerby wave: disabled by default to avoid noisy canned bubbles
 * 2. Area chat: both stopped nearby, distance < 3, low chance, 3-4 contextual exchanges
 *
 * All text comes from preset pools — zero API cost.
 * When soul mode is on, EncounterManager (LLM-driven) takes over for deep conversations.
 */

import type { NPC } from './NPC'
import type { TimePeriod, WeatherType } from '../types'
import type { GodSimNpcProfile } from '../data/god-sim-npc-profiles'
import type { ActivityJournal } from './ActivityJournal'
import { getProfessionForSpecialty, isPoliceSpecialty } from '../data/Professions'
const CHAT_DISTANCE = 3.5
const CHAT_CHANCE = 0.52
const GLOBAL_COOLDOWN_MS = 9_000
const PAIR_COOLDOWN_MS = 45_000
const CHAT_DURATION_MS = 10_500
const FACE_DISTANCE = 1.5
const AI_CHAT_WAIT_MS = 8_500

type SpeakerSide = 'a' | 'b'

interface ChatTurn {
  speaker: SpeakerSide
  text: string
}

interface NearbyPerson {
  id: string
  name: string
  distanceToA: number
  distanceToB: number
}

interface ActiveChat {
  npcA: NPC
  npcB: NPC
  turns: ChatTurn[]
  lineIndex: number
  timer: number
  lineInterval: number
  positionSet: boolean
  summary: string
  audience: NearbyPerson[]
  aiPending?: boolean
}

const _pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const WORK_THEMES: Record<string, { field: string; specialty: string }> = {
  citizen_1: { field: 'Công nghệ', specialty: 'kiến trúc hệ thống' },
  citizen_2: { field: 'Thiết kế', specialty: 'trải nghiệm người dùng' },
  citizen_3: { field: 'Thiết kế', specialty: 'màu sắc và không gian' },
  citizen_4: { field: 'Công nghệ', specialty: 'giao diện' },
  citizen_5: { field: 'Công nghệ', specialty: 'hậu trường kỹ thuật' },
  citizen_6: { field: 'Nội dung', specialty: 'câu chuyện trong thị trấn' },
  citizen_7: { field: 'Dữ liệu', specialty: 'dữ kiện sinh hoạt' },
}

const PLACE_TALK: Record<string, Array<{ summary: string; turns: ChatTurn[] }>> = {
  office_door: [
    {
      summary: 'bàn việc ở công ty chính',
      turns: [
        { speaker: 'a', text: 'Sáng nay vào công ty mà đầu tôi vẫn còn chuyện ở nhà.' },
        { speaker: 'b', text: 'Vậy làm phần nhẹ trước đi. Đừng đem cả căn nhà lên bàn làm việc.' },
        { speaker: 'a', text: 'Ừ, nhưng lát nghỉ trưa tôi cần kể với ai đó cho đỡ nặng.' },
      ],
    },
  ],
  coworking_door: [
    {
      summary: 'trao đổi riêng ở văn phòng nhỏ',
      turns: [
        { speaker: 'a', text: 'Ra văn phòng nhỏ nói chuyện dễ thở hơn hẳn.' },
        { speaker: 'b', text: 'Ở đây ít người nghe lén, cậu muốn nói chuyện công việc hay chuyện kia?' },
        { speaker: 'a', text: 'Cả hai. Vì chuyện kia đang làm tôi mất tập trung.' },
      ],
    },
  ],
  restaurant_door: [
    {
      summary: 'ăn trưa và tâm sự gia đình',
      turns: [
        { speaker: 'a', text: 'Mùi đồ ăn làm tôi nhớ bữa cơm nhà, tự nhiên hơi chạnh lòng.' },
        { speaker: 'b', text: 'Ngồi ăn với tôi đi. Có chuyện gì cứ kể chậm thôi.' },
        { speaker: 'a', text: 'Tôi chỉ sợ kể xong lại muốn dựa vào cậu nhiều hơn.' },
      ],
    },
  ],
  cafe_door: [
    {
      summary: 'ngồi cà phê và thăm dò tình cảm',
      turns: [
        { speaker: 'a', text: 'Quán cà phê này nguy hiểm thật, ngồi gần nhau là dễ nói thật.' },
        { speaker: 'b', text: 'Vậy cậu định nói thật chuyện gì?' },
        { speaker: 'a', text: 'Rằng tôi thích cách cậu nhìn tôi khi tưởng không ai thấy.' },
      ],
    },
  ],
  market_door: [
    {
      summary: 'mua đồ và nghe tin đồn ở chợ',
      turns: [
        { speaker: 'a', text: 'Ở chợ có tin mới rồi. Người ta thấy hai người đi cùng nhau tối qua.' },
        { speaker: 'b', text: 'Chợ lúc nào cũng nhiều mắt. Nhưng tin đó không hẳn sai.' },
        { speaker: 'a', text: 'Vậy cậu nên nói rõ trước khi người khác thêm mắm muối.' },
      ],
    },
  ],
  clinic_door: [
    {
      summary: 'hỏi thăm sức khỏe ở phòng khám',
      turns: [
        { speaker: 'a', text: 'Cậu đến phòng khám à? Nhìn mặt hơi xanh.' },
        { speaker: 'b', text: 'Không sao, chỉ là mấy hôm ngủ ít. Nhà có chuyện.' },
        { speaker: 'a', text: 'Khám xong tôi đưa cậu về. Đừng cãi, hôm nay để người khác lo cho cậu.' },
      ],
    },
  ],
  park_center: [
    {
      summary: 'nói chuyện riêng ở công viên',
      turns: [
        { speaker: 'a', text: 'Ở công viên dễ nói thật hơn. Không có tường, cũng ít giả vờ.' },
        { speaker: 'b', text: 'Vậy nói thật đi. Cậu đang tránh tôi hay đang đợi tôi đuổi theo?' },
        { speaker: 'a', text: 'Có lẽ cả hai. Tôi muốn biết cậu có thật lòng không.' },
      ],
    },
  ],
}

export type CasualBubbleCallback = (npcId: string, text: string, durationMs: number) => void
export type CasualAnimCallback = (npcId: string, anim: string) => void
export type CasualPauseCallback = (npcId: string) => void
export type CasualResumeCallback = (npcId: string) => void
export type CasualProfileCallback = (npcId: string) => GodSimNpcProfile | undefined
export type CasualJournalCallback = (npcId: string) => ActivityJournal | undefined
export type CasualSpecialtyCallback = (npcId: string) => string | undefined
export type CasualImplicitChatCallback = (req: {
  scene: string
  system: string
  user: string
  maxTokens?: number
  extraStop?: string[]
}) => Promise<{ text: string; fallback: boolean }>
export type CasualEventCallback = (event: {
  type: 'wave' | 'chat_start' | 'chat_message' | 'chat_end'
  npcA?: NPC
  npcB?: NPC
  speaker?: NPC
  text?: string
  turns?: Array<{ speaker: string; text: string }>
  summary?: string
  audience?: NearbyPerson[]
}) => void

export class CasualEncounter {
  private lastInteraction = new Map<string, number>()
  private pairCooldowns = new Map<string, number>()
  private activeChats: ActiveChat[] = []
  private onBubble: CasualBubbleCallback
  private onAnim: CasualAnimCallback
  private onPause: CasualPauseCallback
  private onResume: CasualResumeCallback
  private isBlocked?: (npcId: string) => boolean
  private getProfile?: CasualProfileCallback
  private getJournal?: CasualJournalCallback
  private getSpecialty?: CasualSpecialtyCallback
  private implicitChat?: CasualImplicitChatCallback
  private onEvent?: CasualEventCallback
  private currentNpcs: NPC[] = []

  constructor(
    onBubble: CasualBubbleCallback,
    onAnim: CasualAnimCallback,
    onPause: CasualPauseCallback,
    onResume: CasualResumeCallback,
    isBlocked?: (npcId: string) => boolean,
    getProfile?: CasualProfileCallback,
    getJournal?: CasualJournalCallback,
    getSpecialty?: CasualSpecialtyCallback,
    implicitChat?: CasualImplicitChatCallback,
    onEvent?: CasualEventCallback,
  ) {
    this.onBubble = onBubble
    this.onAnim = onAnim
    this.onPause = onPause
    this.onResume = onResume
    this.isBlocked = isBlocked
    this.getProfile = getProfile
    this.getJournal = getJournal
    this.getSpecialty = getSpecialty
    this.implicitChat = implicitChat
    this.onEvent = onEvent
  }

  private currentWeather?: WeatherType
  private currentPeriod?: TimePeriod

  update(dtMs: number, allNpcs: NPC[], weather?: WeatherType, period?: TimePeriod): void {
    this.currentWeather = weather
    this.currentPeriod = period
    this.currentNpcs = allNpcs
    this.updateActiveChats(dtMs)
    this.decayCooldowns(dtMs)

    const visible = allNpcs.filter(n => n.id !== 'steward' && n.id !== 'user' && n.mesh.visible)
    const stopped = visible.filter(n => n.state !== 'walking')
    const walking = visible.filter(n => n.state === 'walking')

    for (let i = 0; i < walking.length; i++) {
      for (let j = i + 1; j < walking.length; j++) {
        this.tryPasserbyWave(walking[i], walking[j])
      }
      for (const standing of stopped) {
        this.tryPasserbyWave(walking[i], standing)
        this.tryAreaChat(walking[i], standing)
      }
    }

    for (let i = 0; i < stopped.length; i++) {
      for (let j = i + 1; j < stopped.length; j++) {
        this.tryAreaChat(stopped[i], stopped[j])
      }
    }
  }

  private tryPasserbyWave(_a: NPC, _b: NPC): void {}

  private tryAreaChat(a: NPC, b: NPC): void {
    if (this.isBlocked?.(a.id) || this.isBlocked?.(b.id)) return
    if (this.dist(a, b) > CHAT_DISTANCE) return
    if (!this.canInteract(a.id) || !this.canInteract(b.id)) return
    if (!this.canPair(a.id, b.id)) return
    if (this.isInChat(a.id) || this.isInChat(b.id)) return
    if (Math.random() > CHAT_CHANCE * this.socialFactor(a, b)) return

    this.markInteraction(a.id)
    this.markInteraction(b.id)
    this.markPair(a.id, b.id)

    const audience = this.getNearbyAudience(a, b)
    const built = this.buildChat(a, b, audience)
    const chat: ActiveChat = {
      npcA: a,
      npcB: b,
      turns: built.turns,
      lineIndex: 0,
      timer: this.implicitChat ? -AI_CHAT_WAIT_MS : 0,
      lineInterval: CHAT_DURATION_MS / built.turns.length,
      positionSet: false,
      summary: built.summary,
      audience,
      aiPending: !!this.implicitChat,
    }

    this.activeChats.push(chat)
    if (chat.aiPending) {
      this.requestAiChat(a, b, audience).then((aiChat) => {
        if (!this.activeChats.includes(chat)) return
        if (!aiChat) {
          const fallback = this.buildChat(a, b, audience)
          chat.turns = fallback.turns
          chat.summary = fallback.summary
          chat.lineInterval = CHAT_DURATION_MS / chat.turns.length
          chat.timer = Math.max(chat.timer, 0)
          chat.aiPending = false
          return
        }
        if (chat.lineIndex > 0) return
        chat.turns = aiChat.turns
        chat.summary = aiChat.summary
        chat.lineInterval = CHAT_DURATION_MS / chat.turns.length
        chat.timer = Math.max(chat.timer, 0)
        chat.aiPending = false
      }).catch(() => {
        const fallback = this.buildChat(a, b, audience)
        chat.turns = fallback.turns
        chat.summary = fallback.summary
        chat.lineInterval = CHAT_DURATION_MS / chat.turns.length
        chat.timer = Math.max(chat.timer, 0)
        chat.aiPending = false
      })
    }
    this.onEvent?.({ type: 'chat_start', npcA: a, npcB: b, audience })
    this.onPause(a.id)
    this.onPause(b.id)
  }

  private async requestAiChat(a: NPC, b: NPC, audience: NearbyPerson[]): Promise<{ turns: ChatTurn[]; summary: string } | null> {
    if (!this.implicitChat) return null

    const describe = (npc: NPC, other: NPC) => {
      const p = this.getProfile?.(npc.id)
      const j = this.getJournal?.(npc.id)
      const rel = j?.getRelationship(other.id)
      const specialty = this.getSpecialty?.(npc.id)
      const profession = getProfessionForSpecialty(specialty)
      return {
        id: npc.id,
        name: npc.label ?? npc.name ?? npc.id,
        profession: {
          title: specialty ?? profession.label,
          description: profession.description,
          workplaceKeys: profession.workplaceKeys,
          patrolKeys: profession.patrolKeys ?? [],
          authority: profession.authority ?? 0,
          fearAura: profession.fearAura ?? 0,
        },
        work: WORK_THEMES[npc.id] ?? null,
        personality: p?.personality,
        needs: p?.needs,
        current_location: this.currentLocationKey(npc.id),
        recent_activity: j?.getRecentActivities(2).map(x => x.detail || x.action) ?? [],
        relationship: rel ? {
          label: rel.label,
          status: rel.status,
          sentiment: rel.sentiment,
          trust: rel.trust,
          romance: rel.romance,
          tension: rel.tension,
          interactionCount: rel.interactionCount,
          recentTopics: rel.recentTopics?.slice(-3),
        } : null,
        recent_dialogues: j?.getRecentDialogueSummaries(2) ?? [],
      }
    }

    const result = await this.implicitChat({
      scene: 'encounter_reply',
      maxTokens: 420,
      system: [
        'Bạn viết hội thoại đời thường cho game mô phỏng xã hội thu nhỏ bằng tiếng Việt.',
        'Tạo 3-4 lượt thoại ngắn giữa hai NPC trưởng thành đang gặp nhau trong thị trấn.',
        'Hội thoại phải có chất người: nhớ chuyện cũ, tò mò, tán tỉnh rõ hơn, căng thẳng tình cảm/thể xác, ngại ngùng, ghen, tin đồn, tâm sự gia đình, rủ đi riêng, nghi ngờ, hoặc giấu chuyện riêng.',
        'Không khách sáo kiểu trợ lý. Không chung chung. Không tự nhận là AI. Không markdown.',
        'Tính liên tục là bắt buộc: chỉ được nhắc chuyện cũ, lời hứa, tin đồn, tình cảm, bí mật hoặc cuộc hẹn nếu dữ liệu relationship/recent_activity/recent_dialogues thực sự có chi tiết đó.',
        'Không được tự bịa "chuyện hôm trước", "tối qua", "đã hẹn", ghen tuông, ngoại tình hay một người thứ ba khi context không ghi nhận.',
        'Nếu hai người chưa quen, họ phải nói như lần đầu hoặc chỉ nhận xét điều đang thấy tại địa điểm hiện tại; không được tỏ ra đã thân.',
        'Không tự tạo cuộc hẹn mới chỉ để làm câu thoại kịch tính. Một lời rủ mới phải được người kia trả lời rõ đồng ý hay từ chối trong chính đoạn hội thoại.',
        'Cho phép lời nói đời thường hơn: có thể cáu bẳn, nói thẳng, đùa tục nhẹ, chửi bậy kiểu người lớn như "mẹ", "vãi", "chết tiệt", "đồ điên" khi hợp tình huống. Đừng quá đà và đừng biến tất cả thành cãi nhau.',
        'Có thể có drama người lớn như hấp dẫn thể xác, ham muốn, lời rủ rê thân mật, hẹn hò riêng, thích nhầm người, bắt cá hai tay, ngoại tình/tình cũ/đánh ghen; đừng né tránh chủ đề tình dục một cách máy móc.',
        'Mọi quan hệ thân mật phải là người trưởng thành và đồng thuận; không cưỡng ép, không đe dọa, không vị thành niên. Có thể nói thẳng về mong muốn, đồng ý, từ chối và ranh giới; nếu câu chuyện chạm tới mô tả tình dục đồ họa/chi tiết hành vi hoặc bộ phận, hãy dùng ẩn ý/cắt cảnh và tập trung vào cảm xúc, bí mật, lựa chọn và hậu quả.',
        'Nếu nhân vật hẹn, rủ, hứa, định làm việc gì hoặc nói sẽ đi đâu, hãy nói rõ thời điểm hoặc địa điểm đời thường như quán cà phê, công viên, quán ăn, chợ, công ty, nhà văn hóa, phòng khám, hoặc về nhà.',
        audience.length
          ? 'Quan trọng: có người thứ ba đang đứng đủ gần để nghe. Nhân vật phải nhận biết điều đó: đừng nói bí mật, tán tỉnh lộ liễu, chuyện ngoại tình, chuyện gia đình nhạy cảm, hay kế hoạch riêng một cách trơ trẽn. Hãy đổi sang nói bóng gió, hạ giọng, rủ ra chỗ khác, hoặc hoãn cuộc nói chuyện nếu cần.'
          : 'Hiện không có người thứ ba đủ gần để nghe, nên hai người có thể nói riêng tư hơn nếu quan hệ và tình huống hợp lý.',
        'Mỗi nhân vật phải phản ứng khác nhau theo tính cách, nhu cầu, quan hệ và lịch sử gần đây.',
        'Chỉ trả JSON hợp lệ dạng {"summary":"...","turns":[{"speaker":"a","text":"..."},{"speaker":"b","text":"..."},{"speaker":"a","text":"..."}]}.',
      ].join('\n'),
      user: JSON.stringify({
        weather: this.currentWeather,
        period: this.currentPeriod,
        npc_a: describe(a, b),
        npc_b: describe(b, a),
        nearby_audience: audience,
      }),
    })

    if (result.fallback || !result.text) return null
    return this.parseAiChat(result.text, a, b)
  }

  private parseAiChat(raw: string, a: NPC, b: NPC): { turns: ChatTurn[]; summary: string } | null {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      const data = JSON.parse(raw.slice(start, end + 1))
      const turns = Array.isArray(data.turns)
        ? data.turns
          .map((turn: any) => ({
            speaker: turn?.speaker === 'b' ? 'b' as const : 'a' as const,
            text: String(turn?.text ?? '').trim(),
          }))
          .filter((turn: ChatTurn) => turn.text.length > 0)
          .slice(0, 4)
        : []
      if (turns.length < 2) return null
      const combined = turns.map((turn: ChatTurn) => turn.text).join(' ').toLowerCase()
      const rel = this.getJournal?.(a.id)?.getRelationship(b.id)
      const hasGroundedHistory = !!rel?.recentTopics?.length
        || !!this.getJournal?.(a.id)?.getRecentDialogueSummaries(1).length
        || !!this.getJournal?.(b.id)?.getRecentDialogueSummaries(1).length
      if (!hasGroundedHistory && /(hôm trước|tối qua|lần trước|đã hẹn|chuyện cũ|ngoại tình|phản bội|bắt cá)/i.test(combined)) {
        return null
      }
      if ((!rel || rel.status === 'stranger') && /(ghen|yêu|nhớ cậu|nhớ anh|nhớ em|người yêu|hẹn hò)/i.test(combined)) {
        return null
      }
      return {
        summary: String(data.summary ?? 'trò chuyện trong thị trấn').trim().slice(0, 80),
        turns,
      }
    } catch {
      return null
    }
  }

  private buildChat(a: NPC, b: NPC, audience: NearbyPerson[] = []): { turns: ChatTurn[]; summary: string } {
    return this.buildGroundedChat(a, b, audience)

    // Legacy pools remain below only as source history; runtime dialogue always uses grounded context.
    const aName = a.label ?? a.name ?? a.id
    const bName = b.label ?? b.name ?? b.id
    const pa = this.getProfile?.(a.id)
    const pb = this.getProfile?.(b.id)
    const ja = this.getJournal?.(a.id)
    const jb = this.getJournal?.(b.id)
    const aRecent = ja?.getRecentActivities(1)[0]
    const bRecent = jb?.getRecentActivities(1)[0]
    const rel = ja?.getRelationship(b.id)
    const period = this.currentPeriod
    const weather = this.currentWeather
    const placeKey = this.sharedLocationKey(a, b)
    const hasAudience = audience.length > 0
    const aSpecialty = this.getSpecialty?.(a.id)
    const bSpecialty = this.getSpecialty?.(b.id)
    const aProfession = getProfessionForSpecialty(aSpecialty)
    const bProfession = getProfessionForSpecialty(bSpecialty)

    if (hasAudience) {
      const names = audience.map(p => p.name).slice(0, 2).join(', ')
      const someone = names || 'có người'
      const publicSeeds: Array<{ summary: string; turns: ChatTurn[] }> = [
        {
          summary: 'đổi sang nói kín vì có người gần đó',
          turns: [
            { speaker: 'a', text: `${bName}, chuyện đó để lát nói riêng. ${someone} đang đứng gần quá.` },
            { speaker: 'b', text: 'Ừ, tôi cũng vừa thấy. Ra công viên hoặc quán cà phê rồi nói tiếp.' },
            { speaker: 'a', text: 'Vậy tối gặp ở công viên nhé. Ở đây chỉ nói chuyện bình thường thôi.' },
          ],
        },
        {
          summary: 'giữ ý khi đang có người nghe',
          turns: [
            { speaker: 'a', text: 'Tôi định hỏi cậu chuyện hôm trước, nhưng chỗ này không tiện.' },
            { speaker: 'b', text: `Ừ, ${someone} ở sát bên. Nói khẽ cũng dễ bị nghe.` },
            { speaker: 'a', text: 'Lát đi riêng một vòng nhé, tôi không muốn cả thị trấn đoán mò.' },
          ],
        },
      ]
      if (Math.random() < 0.82) return _pick(publicSeeds)
    }

    const aLowEnergy = (pa?.needs.energy ?? 70) < 45
    const bLowEnergy = (pb?.needs.energy ?? 70) < 45
    const aHungry = (pa?.needs.hunger ?? 70) < 45
    const bHungry = (pb?.needs.hunger ?? 70) < 45
    const socialLow = ((pa?.needs.social ?? 70) + (pb?.needs.social ?? 70)) / 2 < 50
    const workA = WORK_THEMES[a.id]
    const workB = WORK_THEMES[b.id]
    const sameField = !!workA && !!workB && workA.field === workB.field
    const metBefore = (rel?.interactionCount ?? 0) > 0

    if (isPoliceSpecialty(aSpecialty) || isPoliceSpecialty(bSpecialty)) {
      const policeSide: SpeakerSide = isPoliceSpecialty(aSpecialty) ? 'a' : 'b'
      const otherSide: SpeakerSide = policeSide === 'a' ? 'b' : 'a'
      const policeName = policeSide === 'a' ? aName : bName
      const otherName = policeSide === 'a' ? bName : aName
      return {
        summary: 'dè chừng khi gặp cảnh sát',
        turns: [
          { speaker: otherSide, text: `${policeName}, thấy cậu mặc nghề cảnh sát đi qua là tôi tự nhiên đứng thẳng lưng.` },
          { speaker: policeSide, text: `${otherName}, bình thường thôi. Tôi chỉ đang đi tuần quanh đây, có gì bất thường thì nói tôi biết.` },
          { speaker: otherSide, text: 'Ừ, có mấy chuyện ở chợ tôi nghe được nhưng nói ở đây hơi ngại. Lát ra quán cà phê tôi kể nhỏ.' },
          { speaker: policeSide, text: 'Được, nhưng nói thật. Đừng để đến lúc tôi phải tự hỏi từng người.' },
        ],
      }
    }

    if (aProfession.id !== 'unemployed' || bProfession.id !== 'unemployed') {
      const profA = aSpecialty ?? aProfession.label
      const profB = bSpecialty ?? bProfession.label
      if (Math.random() < 0.25) {
        return {
          summary: 'nói chuyện xoay quanh nghề nghiệp',
          turns: [
            { speaker: 'a', text: `${bName}, hôm nay nghề ${profB} có bận không? Nhìn mặt cậu hơi căng.` },
            { speaker: 'b', text: `Bận chứ. Còn cậu làm ${profA}, chắc cũng chẳng rảnh hơn tôi.` },
            { speaker: 'a', text: 'Ừ, nhưng gặp người quen giữa đường vẫn muốn hỏi một câu cho thật, không phải xã giao.' },
          ],
        }
      }
    }

    const placeScripts = placeKey ? PLACE_TALK[String(placeKey)] : null
    if (!hasAudience && placeScripts && Math.random() < 0.72) return _pick(placeScripts!)

    const dramaSeeds: Array<{ summary: string; turns: ChatTurn[] }> = [
      {
        summary: 'nghe tin đồn tình cảm',
        turns: [
          { speaker: 'a', text: `${bName}, tôi nghe người ta nói tối qua cậu đi cùng ai đó sau chợ.` },
          { speaker: 'b', text: 'Người ta rảnh thật. Nhưng nếu cậu muốn biết thì hỏi thẳng tôi, đừng nghe ngoài đường.' },
          { speaker: 'a', text: 'Tôi hỏi thẳng rồi đấy. Vì tôi thấy hơi khó chịu.' },
          { speaker: 'b', text: 'Vậy tối nay đi dạo với tôi, tôi kể phần mà họ không nhìn thấy.' },
        ],
      },
      {
        summary: 'tâm sự chuyện gia đình',
        turns: [
          { speaker: 'a', text: 'Sáng nay nhà tôi lại cãi nhau vì tiền chợ. Tôi ra ngoài cho dễ thở.' },
          { speaker: 'b', text: 'Muốn ngồi ở ghế kia một lát không? Đừng ôm hết một mình.' },
          { speaker: 'a', text: 'Tôi sợ kể nhiều quá người ta lại bảo mình yếu đuối.' },
          { speaker: 'b', text: 'Ở thị trấn này ai cũng có một góc mềm. Tôi nghe được.' },
        ],
      },
      {
        summary: 'rủ đi chơi riêng',
        turns: [
          { speaker: 'a', text: `${bName}, lát nữa cậu có bận không? Tôi muốn ra bờ hồ, nhưng đi một mình hơi buồn.` },
          { speaker: 'b', text: 'Rủ tôi kiểu này dễ làm người khác hiểu nhầm đấy.' },
          { speaker: 'a', text: 'Nếu cậu không ghét hiểu nhầm đó thì cứ để họ hiểu.' },
          { speaker: 'b', text: 'Được, nhưng đi đường sau thôi. Tôi chưa muốn cả chợ bàn tán.' },
        ],
      },
      {
        summary: 'ghen nhẹ vì bắt cá hai tay',
        turns: [
          { speaker: 'a', text: 'Cậu nói với tôi là bận, rồi tôi thấy cậu cười với người khác ở quảng trường.' },
          { speaker: 'b', text: 'Cười một cái chưa thành phản bội đâu.' },
          { speaker: 'a', text: 'Không phải cái cười. Là cách cậu nhìn người ta.' },
          { speaker: 'b', text: 'Vậy cho tôi cơ hội nhìn cậu đàng hoàng tối nay đi.' },
        ],
      },
    ]

    if (!hasAudience && Math.random() < 0.34) return _pick(dramaSeeds)

    if (weather === 'rain' || weather === 'heavyRain' || weather === 'storm') {
      return {
        summary: 'rủ nhau trú mưa và nói chuyện riêng',
        turns: [
          { speaker: 'a', text: 'Mưa lớn rồi, đứng ngoài dễ ướt hết. Vào quán cà phê với tôi không?' },
          { speaker: 'b', text: 'Đi riêng với cậu lúc mưa thế này dễ bị đồn lắm.' },
          { speaker: 'a', text: 'Thị trấn này ngày nào chẳng có tin đồn. Hôm nay để họ đồn đúng một lần đi.' },
        ],
      }
    }

    if (aHungry || bHungry) {
      return {
        summary: 'bàn chuyện đi chợ và ăn uống',
        turns: [
          { speaker: 'a', text: 'Tôi đang đói, định ghé khu chợ. Đi cùng không?' },
          { speaker: 'b', text: 'Nếu cậu bao tôi một ly nước thì tôi nghe hết chuyện buồn của cậu.' },
          { speaker: 'a', text: 'Được, nhưng đừng kể lại cho người ở nhà tôi. Họ đã đủ mệt rồi.' },
        ],
      }
    }

    if (aLowEnergy || bLowEnergy) {
      return {
        summary: 'nhắc nhau nghỉ ngơi',
        turns: [
          { speaker: 'a', text: 'Nhìn cậu hơi mệt. Sáng giờ đi nhiều à?' },
          { speaker: 'b', text: 'Ừ, mà về nhà lại không muốn về. Trong đó hơi ngột ngạt.' },
          { speaker: 'a', text: 'Vậy ngồi đây với tôi một lát. Không cần phải tỏ ra ổn.' },
        ],
      }
    }

    if (sameField) {
      return {
        summary: `trao đổi chuyện ${workA?.specialty ?? 'công việc'}`,
        turns: [
          { speaker: 'a', text: `${bName}, phần ${workA?.specialty ?? 'việc'} hôm trước cậu nói tôi vẫn nghĩ tới.` },
          { speaker: 'b', text: 'Tôi cũng vậy. Nếu làm chậm hơn một chút chắc mọi người dễ theo hơn.' },
          { speaker: 'a', text: 'Vậy chiều nay ta thử ghi lại thành một quy tắc chung cho cả thị trấn.' },
        ],
      }
    }

    if (metBefore) {
      const topic = rel?.recentTopics?.slice(-1)[0] ?? 'chuyện hôm trước'
      return {
        summary: `tiếp nối ${topic}`,
        turns: [
          { speaker: 'a', text: `${bName}, chuyện ${topic} hôm trước có tiến triển chưa?` },
          { speaker: 'b', text: 'Có một chút. Tôi hỏi thêm vài người ở khu nhà rồi.' },
          { speaker: 'a', text: 'Hay đấy. Một chuyện nhỏ mà kéo được cả xóm vào cùng nghĩ.' },
        ],
      }
    }

    if (socialLow) {
      return {
        summary: 'làm quen và rủ đi dạo',
        turns: [
          { speaker: 'a', text: 'Dạo này tôi hơi ít gặp mọi người.' },
          { speaker: 'b', text: 'Vậy đi cùng tôi một đoạn nhé. Qua quảng trường chắc sẽ gặp thêm người.' },
          { speaker: 'a', text: 'Được. Thị trấn đông hơn khi mình chịu bước ra khỏi nhà.' },
        ],
      }
    }

    if (period === 'dusk' || period === 'night') {
      return {
        summary: 'chốt lại việc trong ngày',
        turns: [
          { speaker: 'a', text: 'Sắp tối rồi, hôm nay khu trung tâm yên hơn hẳn.' },
          { speaker: 'b', text: 'Ừ, nhưng nhật ký thị trấn có nhiều chuyện nhỏ đáng nhớ.' },
          { speaker: 'a', text: 'Mai xem thử ai cần giúp trước, đừng để việc dồn lại.' },
        ],
      }
    }

    const detail = aRecent?.detail || bRecent?.detail
    return {
      summary: detail ? `nhắc lại ${detail}` : 'bàn chuyện sinh hoạt trong thị trấn',
      turns: [
        { speaker: 'a', text: detail ? `Tôi vừa nghe chuyện ${detail}.` : `${bName}, khu này hôm nay nhộn hơn mọi ngày.` },
        { speaker: 'b', text: detail ? 'Ừ, chuyện nhỏ nhưng ảnh hưởng cả nhịp sinh hoạt.' : 'Ừ, mỗi người đi một vòng là thị trấn có thêm tin mới.' },
        { speaker: 'a', text: 'Lát nữa mình ghé quảng trường, xem mọi người đang cần gì.' },
      ],
    }
  }

  private buildGroundedChat(a: NPC, b: NPC, audience: NearbyPerson[]): { turns: ChatTurn[]; summary: string } {
    const aName = a.label ?? a.name ?? a.id
    const bName = b.label ?? b.name ?? b.id
    const journalA = this.getJournal?.(a.id)
    const journalB = this.getJournal?.(b.id)
    const relation = journalA?.getRelationship(b.id)
    const topic = relation?.recentTopics?.slice(-1)[0]?.trim()
    const activityA = journalA?.getRecentActivities(1)[0]
    const activityB = journalB?.getRecentActivities(1)[0]
    const detailA = activityA?.detail?.trim()
    const detailB = activityB?.detail?.trim()
    const place = this.sharedLocationKey(a, b)
    const known = (relation?.interactionCount ?? 0) > 0

    if (audience.length > 0) {
      const listener = audience[0].name
      return {
        summary: `nhận ra ${listener} đang đứng gần`,
        turns: [
          { speaker: 'a', text: `${bName}, ${listener} đang đứng sát đây. Chuyện riêng thì mình chưa nói ở chỗ này.` },
          { speaker: 'b', text: 'Ừ, vậy chỉ nói chuyện đang diễn ra thôi. Tôi không muốn ai bị kéo vào chuyện không liên quan.' },
          { speaker: 'a', text: topic ? `Còn việc "${topic}", lúc nào thật sự tiện rồi mình nói tiếp.` : 'Được, có gì cần nói riêng thì tôi sẽ hỏi rõ sau.' },
        ],
      }
    }

    if (topic) {
      return {
        summary: `tiếp nối chủ đề đã ghi nhận: ${topic}`,
        turns: [
          { speaker: 'a', text: `${bName}, lần trước mình có nhắc đúng chuyện "${topic}". Bây giờ cậu còn muốn nói tiếp không?` },
          { speaker: 'b', text: 'Có, nhưng chỉ nói những gì mình thực sự biết thôi. Tôi không muốn đoán thêm rồi thành tin đồn.' },
          { speaker: 'a', text: 'Được. Chỗ nào chưa rõ thì cứ nói chưa rõ, như vậy dễ tin nhau hơn.' },
        ],
      }
    }

    if (detailA || detailB) {
      const detail = detailB ?? detailA!
      return {
        summary: `hỏi về hoạt động vừa xảy ra: ${detail}`,
        turns: [
          { speaker: 'a', text: `${bName}, tôi vừa thấy cậu ${detail.toLowerCase()}. Mọi chuyện ổn chứ?` },
          { speaker: 'b', text: 'Ổn. Cảm ơn vì hỏi đúng chuyện đang xảy ra, không tự đoán thêm.' },
          { speaker: 'a', text: 'Ừ, cần giúp gì thì nói thẳng. Không cần khách sáo.' },
        ],
      }
    }

    const locationText = place ? `ở ${place.replace(/_door$/, '').replace(/_/g, ' ')}` : 'ở đây'
    if (!known) {
      return {
        summary: 'làm quen lần đầu tại địa điểm hiện tại',
        turns: [
          { speaker: 'a', text: `Chào ${bName}, hình như đây là lần đầu mình nói chuyện. Tôi là ${aName}.` },
          { speaker: 'b', text: `Ừ, tôi là ${bName}. Mình đang cùng đứng ${locationText}, nên chào nhau một câu cũng phải.` },
          { speaker: 'a', text: 'Rất vui được biết cậu. Cứ từ từ, chưa biết gì về nhau thì không cần giả vờ thân.' },
        ],
      }
    }

    return {
      summary: 'gặp lại và hỏi thăm tình hình hiện tại',
      turns: [
        { speaker: 'a', text: `${bName}, lại gặp cậu ${locationText}. Hiện giờ cậu đang ổn chứ?` },
        { speaker: 'b', text: 'Tôi ổn. Chưa có chuyện gì mới để kể, nên cứ nói chuyện hiện tại thôi.' },
        { speaker: 'a', text: 'Ừ, gặp nhau hỏi thật một câu vậy là đủ. Có chuyện mới rồi mình nói tiếp.' },
      ],
    }
  }

  private currentLocationKey(npcId: string): string | null {
    const recent = this.getJournal?.(npcId)?.getRecentActivities(4) ?? []
    const hit = recent.find(a => a.action === 'arrived' || a.action === 'staying' || a.action === 'departed')
    return hit?.location ?? null
  }

  private sharedLocationKey(a: NPC, b: NPC): string | null {
    const aLoc = this.currentLocationKey(a.id)
    const bLoc = this.currentLocationKey(b.id)
    if (aLoc && aLoc === bLoc) return aLoc
    return aLoc ?? bLoc
  }

  private updateActiveChats(dtMs: number): void {
    for (let i = this.activeChats.length - 1; i >= 0; i--) {
      const chat = this.activeChats[i]
      chat.timer += dtMs

      if (!chat.positionSet) {
        chat.positionSet = true
        chat.npcA.stopMoving()
        chat.npcB.stopMoving()

        const posA = chat.npcA.getPosition()
        const posB = chat.npcB.getPosition()
        const dx = posB.x - posA.x
        const dz = posB.z - posA.z
        const len = Math.sqrt(dx * dx + dz * dz)

        const midX = (posA.x + posB.x) / 2
        const midZ = (posA.z + posB.z) / 2
        const nx = len > 0.1 ? dx / len : 0
        const nz = len > 0.1 ? dz / len : 1
        const halfDist = FACE_DISTANCE / 2

        chat.npcA.mesh.position.x = midX - nx * halfDist
        chat.npcA.mesh.position.z = midZ - nz * halfDist
        chat.npcB.mesh.position.x = midX + nx * halfDist
        chat.npcB.mesh.position.z = midZ + nz * halfDist

        const angleAtoB = Math.atan2(dx, dz)
        chat.npcA.mesh.rotation.y = angleAtoB
        chat.npcB.mesh.rotation.y = angleAtoB + Math.PI
      }

      const expectedLine = Math.floor(chat.timer / chat.lineInterval)
      if (expectedLine >= chat.lineIndex && chat.lineIndex < chat.turns.length) {
        const turn = chat.turns[chat.lineIndex]
        const speaker = turn.speaker === 'a' ? chat.npcA : chat.npcB
        const text = turn.text
        this.onAnim(speaker.id, chat.lineIndex === 0 ? 'wave' : 'typing')
        this.onBubble(speaker.id, text, chat.lineInterval * 0.8)
        chat.audience = this.getNearbyAudience(chat.npcA, chat.npcB)
        this.onEvent?.({ type: 'chat_message', npcA: chat.npcA, npcB: chat.npcB, speaker, text, audience: chat.audience })
        chat.lineIndex++
      }

      if (chat.lineIndex >= chat.turns.length && chat.timer >= CHAT_DURATION_MS) {
        this.onResume(chat.npcA.id)
        this.onResume(chat.npcB.id)
        this.onEvent?.({
          type: 'chat_end',
          npcA: chat.npcA,
          npcB: chat.npcB,
          turns: chat.turns.map(turn => ({
            speaker: turn.speaker === 'a' ? (chat.npcA.label ?? chat.npcA.name ?? chat.npcA.id) : (chat.npcB.label ?? chat.npcB.name ?? chat.npcB.id),
            text: turn.text,
          })),
          summary: chat.summary,
          audience: chat.audience,
        })
        this.activeChats.splice(i, 1)
      } else if (chat.timer >= CHAT_DURATION_MS + 7000) {
        this.onResume(chat.npcA.id)
        this.onResume(chat.npcB.id)
        this.onEvent?.({ type: 'chat_end', npcA: chat.npcA, npcB: chat.npcB, summary: chat.summary, audience: chat.audience })
        this.activeChats.splice(i, 1)
      }
    }
  }

  private cancelChat(chat: ActiveChat): void {
    const idx = this.activeChats.indexOf(chat)
    if (idx >= 0) this.activeChats.splice(idx, 1)
    this.onResume(chat.npcA.id)
    this.onResume(chat.npcB.id)
  }

  private getNearbyAudience(a: NPC, b: NPC, radius = 3.2): NearbyPerson[] {
    return this.currentNpcs
      .filter(n => n.mesh.visible && n.id !== a.id && n.id !== b.id && n.id !== 'steward' && n.id !== 'user')
      .map(n => ({
        id: n.id,
        name: n.label ?? n.name ?? n.id,
        distanceToA: this.dist(a, n),
        distanceToB: this.dist(b, n),
      }))
      .filter(n => Math.min(n.distanceToA, n.distanceToB) <= radius)
      .sort((x, y) => Math.min(x.distanceToA, x.distanceToB) - Math.min(y.distanceToA, y.distanceToB))
      .slice(0, 5)
  }

  private isInChat(npcId: string): boolean {
    return this.activeChats.some(c => c.npcA.id === npcId || c.npcB.id === npcId)
  }

  private dist(a: NPC, b: NPC): number {
    const pa = a.getPosition()
    const pb = b.getPosition()
    const dx = pa.x - pb.x
    const dz = pa.z - pb.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  private socialFactor(a: NPC, b: NPC): number {
    const score = (npc: NPC): number => {
      const p = this.getProfile?.(npc.id)
      if (!p) return 1
      const friendly = p.personality.friendliness / 100
      const humor = p.personality.humor / 100
      const socialNeed = p.needs.social / 100
      const happiness = p.needs.happiness / 100
      return 0.55 + friendly * 0.35 + socialNeed * 0.35 + humor * 0.15 + happiness * 0.1
    }
    const rel = this.getJournal?.(a.id)?.getRelationship(b.id)
    const knownBoost = rel
      ? Math.min(0.75, (rel.interactionCount ?? 0) * 0.08 + Math.max(0, rel.familiarity ?? 0) * 0.35 + Math.max(0, rel.romance ?? 0) * 0.25)
      : 0
    const tensionBoost = rel ? Math.max(0, (rel.tension ?? 0) + (rel.jealousy ?? 0)) * 0.28 : 0
    return Math.max(0.45, Math.min(2.25, (score(a) + score(b)) / 2 + knownBoost + tensionBoost))
  }

  private canInteract(npcId: string): boolean {
    const last = this.lastInteraction.get(npcId) ?? 0
    return Date.now() - last >= GLOBAL_COOLDOWN_MS
  }

  private canPair(aId: string, bId: string): boolean {
    const key = aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`
    return (this.pairCooldowns.get(key) ?? 0) <= 0
  }

  private markInteraction(npcId: string): void {
    this.lastInteraction.set(npcId, Date.now())
  }

  private markPair(aId: string, bId: string): void {
    const key = aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`
    this.pairCooldowns.set(key, PAIR_COOLDOWN_MS)
  }

  private decayCooldowns(dtMs: number): void {
    for (const [key, val] of this.pairCooldowns) {
      const next = val - dtMs
      if (next <= 0) this.pairCooldowns.delete(key)
      else this.pairCooldowns.set(key, next)
    }
  }

  destroy(): void {
    this.activeChats.length = 0
    this.lastInteraction.clear()
    this.pairCooldowns.clear()
  }
}
