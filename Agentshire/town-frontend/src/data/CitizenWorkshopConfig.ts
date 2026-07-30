export type ModelSource = 'builtin' | 'library' | 'custom'

import { getLocale } from '../i18n'

export interface ModelTransform {
  scale: number
  rotationX: number
  rotationY: number
  rotationZ: number
  offsetX: number
  offsetY: number
  offsetZ: number
}

export function createDefaultModelTransform(): ModelTransform {
  return { scale: 2.8, rotationX: 0, rotationY: 0, rotationZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 }
}

/**
 * Compute a recommended default ModelTransform based on model geometry and source.
 * `rawHeight` is the model's bounding-box height at scale=1.
 * Builtin models are already standardised at scale 2.8.
 * Library (Characters_1) models face -Z, so rotationY defaults to 180.
 */
export function computeDefaultTransform(rawHeight: number, source: ModelSource): ModelTransform {
  const base = createDefaultModelTransform()
  if (source === 'builtin') return base

  if (source === 'library') {
    const BUILTIN_RENDERED_HEIGHT = 2.8
    base.scale = rawHeight > 0.01 ? BUILTIN_RENDERED_HEIGHT / rawHeight : 2.8
    base.rotationY = 180
    return base
  }

  const BUILTIN_RENDERED_HEIGHT = 2.8
  base.scale = rawHeight > 0.01 ? BUILTIN_RENDERED_HEIGHT / rawHeight : 2.8
  return base
}

/**
 * Standard animation slot names used across the town.
 * Each slot maps to a specific animation clip name in the model's animation set.
 */
export const ANIM_SLOTS = ['idle', 'walk', 'typing', 'wave', 'cheer', 'reading', 'frustrated', 'dancing'] as const
export type AnimSlot = typeof ANIM_SLOTS[number]
export type AnimMapping = Partial<Record<AnimSlot, string>>

export const CHARACTERS1_DEFAULT_ANIM_MAPPING: AnimMapping = {
  idle: 'Idle_A',
  walk: 'Walk_A',
  typing: 'Zombie_Atack_B',
  wave: 'Pistol_Shoot',
  cheer: 'Jump_B_Full',
  reading: 'Pistol_Idle',
  frustrated: 'Death_A',
  dancing: 'Jump_C_Full',
}

export interface WorkshopUserConfig {
  name: string
  avatarUrl?: string
  avatarId: string
  modelSource: ModelSource
  modelTransform?: ModelTransform
  animMapping?: AnimMapping
  animFileUrl?: string
}

export interface WorkshopStewardConfig {
  name: string
  avatarUrl?: string
  avatarId: string
  modelSource: ModelSource
  modelTransform?: ModelTransform
  bio: string
  persona: string
  animMapping?: AnimMapping
  detectedClips?: string[]
  animFileUrls?: string[]
  animFileUrl?: string             // deprecated, migrated to animFileUrls
}

export interface WorkshopCitizenConfig {
  id: string
  name: string
  avatarUrl?: string
  avatarId: string
  modelSource: ModelSource
  modelTransform?: ModelTransform
  bio: string
  customSoul?: string
  industry: string
  specialty: string
  persona: string
  homeId: string
  agentEnabled?: boolean
  useCustomPersona?: boolean
  animMapping?: AnimMapping
  detectedClips?: string[]
  animFileUrls?: string[]
  animFileUrl?: string             // deprecated, migrated to animFileUrls
}

export interface CitizenWorkshopConfig {
  version: 1
  user: WorkshopUserConfig
  steward: WorkshopStewardConfig
  citizens: WorkshopCitizenConfig[]
  /** @deprecated migrated to per-entry modelTransform; kept for backward compat loading */
  modelTransforms?: Record<string, ModelTransform>
}

/**
 * Published (resolved) config — all URLs baked in, Soul loaded from files.
 * Chat / town frontend reads this directly without further resolution.
 */
export interface PublishedCharacterEntry {
  id: string
  role: 'user' | 'steward' | 'citizen'
  name: string
  avatarUrl: string
  modelUrl: string
  avatarId: string
  modelSource: ModelSource
  bio: string
  specialty: string
  persona: string
  personaFile: string
  homeId: string
  agentEnabled: boolean
  agentId?: string
  agentStatus?: 'active' | 'stopped' | 'error'
  animMapping: AnimMapping
  animFileUrls: string[]
  detectedClips?: string[]
  modelTransform: ModelTransform
}

export interface PublishedCitizenConfig {
  version: 1
  publishedAt: string
  characters: PublishedCharacterEntry[]
}

export const INDUSTRY_SPECIALTY_MAP: Record<string, string[]> = {
  '互联网': ['前端开发', '后端开发', '全栈开发', '移动开发', '架构设计', '运维'],
  '产品设计': ['产品经理', 'UI设计', 'UX设计', '交互设计'],
  '自媒体': ['内容运营', '短视频创作', '直播运营', '文案写作', '社群运营'],
  '金融': ['投资分析', '风控合规', '量化交易', '财务管理'],
  '电商': ['电商运营', '供应链', '选品分析', '用户增长'],
  '教育': ['课程设计', '教学研究', '知识管理'],
  '市场营销': ['品牌策略', '广告投放', '市场调研', 'SEO/SEM'],
  '数据': ['数据分析', '数据工程', '商业智能'],
  '游戏': ['游戏策划', '游戏开发', '游戏美术'],
  '项目管理': ['项目管理', '质量保障'],
  '通用': ['通用助手'],
}

const INDUSTRY_SPECIALTY_MAP_EN: Record<string, string[]> = {
  'Tech': ['Frontend', 'Backend', 'Fullstack', 'Mobile', 'Architect', 'DevOps'],
  'Design': ['Product Manager', 'UI Design', 'UX Design', 'Interaction'],
  'Media': ['Content Ops', 'Video Creator', 'Live Ops', 'Copywriting', 'Community'],
  'Finance': ['Investment', 'Risk & Compliance', 'Quant Trading', 'Finance Mgmt'],
  'E-commerce': ['E-com Ops', 'Supply Chain', 'Product Selection', 'Growth'],
  'Education': ['Curriculum', 'Research', 'Knowledge Mgmt'],
  'Marketing': ['Brand Strategy', 'Ad Ops', 'Market Research', 'SEO/SEM'],
  'Data': ['Data Analysis', 'Data Engineering', 'BI'],
  'Gaming': ['Game Design', 'Game Dev', 'Game Art'],
  'Project': ['Project Mgmt', 'QA'],
  'General': ['General Assistant'],
}

const INDUSTRY_SPECIALTY_MAP_VI: Record<string, string[]> = {
  'Công nghệ': ['Frontend', 'Backend', 'Fullstack', 'Mobile', 'Kiến trúc', 'DevOps'],
  'Thiết kế': ['Quản lý sản phẩm', 'Thiết kế UI', 'Thiết kế UX', 'Tương tác'],
  'Nội dung': ['Vận hành nội dung', 'Video ngắn', 'Livestream', 'Viết nội dung', 'Cộng đồng'],
  'Tài chính': ['Đầu tư', 'Rủi ro & tuân thủ', 'Giao dịch định lượng', 'Quản lý tài chính'],
  'Thương mại điện tử': ['Vận hành sàn', 'Chuỗi cung ứng', 'Chọn sản phẩm', 'Tăng trưởng'],
  'Giáo dục': ['Thiết kế khóa học', 'Nghiên cứu giảng dạy', 'Quản lý tri thức'],
  'Marketing': ['Chiến lược thương hiệu', 'Quảng cáo', 'Nghiên cứu thị trường', 'SEO/SEM'],
  'Dữ liệu': ['Phân tích dữ liệu', 'Kỹ thuật dữ liệu', 'BI'],
  'Game': ['Thiết kế game', 'Lập trình game', 'Mỹ thuật game'],
  'Dự án': ['Quản lý dự án', 'Đảm bảo chất lượng'],
  'Tổng quát': ['Trợ lý tổng quát'],
}

export function getIndustrySpecialtyMap(): Record<string, string[]> {
  return getLocale() === 'vi' ? INDUSTRY_SPECIALTY_MAP_VI : getLocale() === 'en' ? INDUSTRY_SPECIALTY_MAP_EN : INDUSTRY_SPECIALTY_MAP
}

export const INDUSTRY_LIST = Object.keys(getIndustrySpecialtyMap())

export function getSpecialtiesForIndustry(industry: string): string[] {
  const map = getIndustrySpecialtyMap()
  return map[industry] ?? map[Object.keys(map)[0]] ?? ['Trợ lý tổng quát']
}

export function createDefaultWorkshopConfig(): CitizenWorkshopConfig {
  return {
    version: 1,
    user: {
      name: 'Người quan sát',
      avatarId: 'char-male-c',
      modelSource: 'builtin',
    },
    steward: {
      name: 'Quản gia',
      avatarId: 'char-female-b',
      modelSource: 'builtin',
      bio: 'Người điều phối sắc bén, quyết đoán, quan sát thị trấn và hỗ trợ cư dân khi cần',
      persona: 'SOUL',
    },
    citizens: [
      { id: 'citizen_1', name: 'Minh', avatarId: 'char-male-b', modelSource: 'builtin', bio: 'Trầm tĩnh, logic, làm nhân viên công ty và để ý quy trình vận hành của thị trấn', industry: 'Công nghệ', specialty: 'Nhân viên công ty', persona: 'YAN', homeId: 'house_a' },
      { id: 'citizen_2', name: 'Lan', avatarId: 'char-female-c', modelSource: 'builtin', bio: 'Nhanh nhạy, nhiều ý tưởng, quản một sạp chợ và biết nhiều tin đời thường', industry: 'Thương mại điện tử', specialty: 'Chủ sạp chợ', persona: 'CHENGZI', homeId: 'house_b' },
      { id: 'citizen_3', name: 'Hà', avatarId: 'char-female-e', modelSource: 'builtin', bio: 'Nhẹ nhàng, tinh tế, làm nha sĩ ở phòng khám và rất để ý sức khỏe của mọi người', industry: 'Tổng quát', specialty: 'Nha sĩ', persona: 'HAITANG', homeId: 'house_c' },
      { id: 'citizen_4', name: 'An', avatarId: 'char-female-f', modelSource: 'builtin', bio: 'Ấm áp, vui vẻ, làm pha chế ở quán cafe nên hay nghe khách tâm sự', industry: 'Tổng quát', specialty: 'Pha chế', persona: 'DIANDIAN', homeId: 'house_d' },
      { id: 'citizen_5', name: 'Khôi', avatarId: 'char-male-e', modelSource: 'builtin', bio: 'Thích hành động nhanh, là cảnh sát khu vực chuyên xử lý xe cộ, đậu sai chỗ và gây gổ', industry: 'Tổng quát', specialty: 'Cảnh sát', persona: 'XIAOLIE', homeId: 'house_e' },
      { id: 'citizen_6', name: 'Vy', avatarId: 'char-female-d', modelSource: 'builtin', bio: 'Giàu trí tưởng tượng, làm đầu bếp quán ăn và bắt nhịp câu chuyện trong bữa cơm', industry: 'Tổng quát', specialty: 'Đầu bếp', persona: 'QIQI', homeId: 'house_f' },
      { id: 'citizen_7', name: 'Bảo', avatarId: 'char-male-d', modelSource: 'builtin', bio: 'Điềm tĩnh, nói ít, làm phóng viên địa phương và ghi lại những chuyện đáng chú ý', industry: 'Nội dung', specialty: 'Phóng viên', persona: 'CHEN', homeId: 'house_g' },
    ],
  }
}

const DEFAULT_VI_BY_ID: Record<string, Partial<WorkshopCitizenConfig>> = {
  citizen_1: {
    name: 'Minh',
    bio: 'Trầm tĩnh, logic, thích quan sát cấu trúc của mọi thứ',
    industry: 'Công nghệ',
    specialty: 'Kiến trúc',
  },
  citizen_2: {
    name: 'Lan',
    bio: 'Nhanh nhạy, nhiều ý tưởng, hay để ý cảm xúc của người khác',
    industry: 'Thiết kế',
    specialty: 'Quản lý sản phẩm',
  },
  citizen_3: {
    name: 'Hà',
    bio: 'Nhẹ nhàng, tinh tế, rất nhạy với màu sắc và không gian',
    industry: 'Thiết kế',
    specialty: 'Thiết kế UI',
  },
  citizen_4: {
    name: 'An',
    bio: 'Ấm áp, vui vẻ, thường làm bầu không khí nhẹ đi',
    industry: 'Công nghệ',
    specialty: 'Frontend',
  },
  citizen_5: {
    name: 'Khôi',
    bio: 'Thích hành động nhanh, không ngại việc khó, hơi nóng tính nhưng tốt bụng',
    industry: 'Công nghệ',
    specialty: 'Backend',
  },
  citizen_6: {
    name: 'Vy',
    bio: 'Giàu trí tưởng tượng, thích kể chuyện và bắt nhịp xu hướng',
    industry: 'Nội dung',
    specialty: 'Vận hành nội dung',
  },
  citizen_7: {
    name: 'Bảo',
    bio: 'Điềm tĩnh, nói ít, thường nhìn vấn đề qua dữ kiện',
    industry: 'Dữ liệu',
    specialty: 'Phân tích dữ liệu',
  },
}

const DEFAULT_NAMES = new Set([
  'Yan', 'Chengzi', 'Haitang', 'Diandian', 'Xiaolie', 'Qiqi', 'Chen',
  '岩', '橙子', '海棠', '点点', '小烈', '柒柒', '辰',
])

const DEFAULT_USER_NAMES = new Set(['Mayor', '镇长', '鎮長'])
const DEFAULT_STEWARD_NAMES = new Set(['shire', 'OpenClaw', '管家'])

export function translateDefaultWorkshopConfigForLocale(config: CitizenWorkshopConfig): CitizenWorkshopConfig {
  const next: CitizenWorkshopConfig = {
    ...config,
    user: { ...config.user },
    steward: { ...config.steward },
    citizens: config.citizens.map(c => ({ ...c })),
  }
  if (DEFAULT_USER_NAMES.has(next.user.name)) next.user.name = 'Người quan sát'
  if (DEFAULT_STEWARD_NAMES.has(next.steward.name)) next.steward.name = 'Quản gia'
  if (!next.steward.bio || /[岩橙海棠点烈柒辰镇管家]|manager|delegates|orchestrates/i.test(next.steward.bio)) {
    next.steward.bio = 'Người điều phối sắc bén, quyết đoán, quan sát thị trấn và hỗ trợ cư dân khi cần'
  }
  for (const citizen of next.citizens) {
    const vi = DEFAULT_VI_BY_ID[citizen.id]
    if (!vi) continue
    const looksDefault = DEFAULT_NAMES.has(citizen.name) || /[岩橙海棠点烈柒辰]|Quiet|Fast thinker|Elegant|Warm|Action-first|Creative|Cold logic/i.test(citizen.bio)
    if (!looksDefault) continue
    Object.assign(citizen, vi)
  }
  return next
}

let _nextId = 100
export function generateCitizenId(): string {
  return `citizen_${Date.now()}_${_nextId++}`
}

const SLOT_MATCH_KEYWORDS: Record<AnimSlot, string[]> = {
  idle: ['idle', 'standby', 'rest'],
  walk: ['walk', 'move', 'locomotion'],
  typing: ['type', 'typing', 'work', 'attack'],
  wave: ['wave', 'greet', 'hello', 'shoot'],
  cheer: ['cheer', 'celebrate', 'jump', 'victory'],
  reading: ['read', 'reading', 'book', 'pistol_idle'],
  frustrated: ['frustrat', 'angry', 'death', 'sad'],
  dancing: ['danc', 'dance'],
}

export const SLOT_LABELS: Record<string, string> = {
  idle: '待机', walk: '行走', typing: '工作', wave: '打招呼',
  cheer: '庆祝', reading: '阅读', frustrated: '沮丧', dancing: '跳舞',
}

const SLOT_LABELS_EN: Record<string, string> = {
  idle: 'Idle', walk: 'Walk', typing: 'Work', wave: 'Wave',
  cheer: 'Celebrate', reading: 'Read', frustrated: 'Frustrated', dancing: 'Dance',
}
const SLOT_LABELS_VI: Record<string, string> = {
  idle: 'Đứng yên', walk: 'Đi bộ', typing: 'Làm việc', wave: 'Chào',
  cheer: 'Ăn mừng', reading: 'Đọc', frustrated: 'Bực bội', dancing: 'Nhảy',
}

export function getSlotLabel(key: string): string {
  const map = getLocale() === 'vi' ? SLOT_LABELS_VI : getLocale() === 'en' ? SLOT_LABELS_EN : SLOT_LABELS
  return map[key] ?? key
}

export function autoMatchAnimSlots(clipNames: string[], existing?: AnimMapping): AnimMapping {
  const mapping: AnimMapping = existing ? { ...existing } : {}
  const lower = clipNames.map(n => ({ orig: n, lc: n.toLowerCase() }))
  for (const slot of ANIM_SLOTS) {
    if (mapping[slot]) continue
    const kws = SLOT_MATCH_KEYWORDS[slot]
    const match = lower.find(c => kws.some(k => c.lc.includes(k)))
    if (match) mapping[slot] = match.orig
  }
  return mapping
}
