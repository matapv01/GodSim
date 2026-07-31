import type * as THREE from 'three'

export interface Vec3 { x: number; y: number; z: number }

export type TimePeriod = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night'

export type WeatherType =
  | 'clear' | 'cloudy' | 'drizzle' | 'rain' | 'heavyRain' | 'storm'
  | 'lightSnow' | 'snow' | 'blizzard' | 'fog' | 'sandstorm' | 'aurora'

export interface GameClockConfig {
  startHour: number
  dayDurationRealMs: number
  nightSpeedMultiplier: number
  paused: boolean
}

export interface GameTimeState {
  hour: number
  minute: number
  normalizedTime: number
  period: TimePeriod
  dayCount: number
  isNight: boolean
}

export type NPCRole = 'producer' | 'worker' | 'user'

export interface NPCConfig {
  id: string
  name: string
  color: number
  spawn: Vec3
  role: NPCRole
  label?: string
  characterKey?: string
  avatarUrl?: string
  modelUrl?: string
  modelTransform?: { scale: number; rotationX: number; rotationY: number; rotationZ: number; offsetX: number; offsetY: number; offsetZ: number }
  animMapping?: Partial<Record<string, string>>
  animFileUrls?: string[]
}

export type NPCState =
  | 'idle' | 'walking' | 'running' | 'sitting' | 'typing'
  | 'thinking' | 'celebrate' | 'frustrated' | 'sleeping' | 'wave'

export type WorkPhase =
  | 'waiting' | 'coding' | 'thinking' | 'done' | 'error' | 'recovering'

export type GlowColor = 'none' | 'gold' | 'cyan' | 'yellow' | 'green' | 'red' | 'gray'

export interface Waypoint { x: number; z: number }
export interface LocationZone { x: number; z: number; w: number; d: number; color: number }

export const WAYPOINTS: Record<string, Waypoint> = {
  road_entrance: { x: 28.0, z: 31.75 },
  plaza_center: { x: 25.6, z: 19.25 },
  plaza_fountain: { x: 25.6, z: 19.25 },
  plaza_side: { x: 30.4, z: 19.25 },
  office_door: { x: 24.4, z: 13.0 },
  coworking_door: { x: 31.6, z: 10.5 },
  house_a_door: { x: 6.0, z: 7.5 },
  house_b_door: { x: 6.0, z: 13.0 },
  house_c_door: { x: 6.0, z: 18.5 },
  house_d_door: { x: 6.0, z: 24.0 },
  house_e_door: { x: 14.0, z: 24.0 },
  house_f_door: { x: 14.0, z: 18.5 },
  house_g_door: { x: 14.0, z: 13.0 },
  clinic_door: { x: 17.2, z: 9.25 },
  market_door: { x: 38.8, z: 10.5 },
  cafe_door: { x: 38.8, z: 18.0 },
  restaurant_door: { x: 42.4, z: 31.25 },
  user_home_door: { x: 11.2, z: 30.5 },
  museum_door: { x: 38.8, z: 25.5 },
  park_bench_1: { x: 16.0, z: 26.75 },
  park_bench_2: { x: 22.0, z: 26.75 },
  park_center: { x: 18.4, z: 28.0 },
  gathering_point: { x: 32.8, z: 26.75 },
}

export const LOCATION_ZONES: Record<string, LocationZone> = {
  office_door:     { x: 24.4, z: 12.0,  w: 6.8, d: 3.0, color: 0x4aa3df },
  coworking_door:  { x: 31.6, z: 12.0,  w: 4.8, d: 2.8, color: 0x4aa3df },
  house_a_door:    { x: 6.0,  z: 7.5,  w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_b_door:    { x: 6.0,  z: 13.0, w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_c_door:    { x: 6.0,  z: 18.5, w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_d_door:    { x: 6.0,  z: 24.0, w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_e_door:    { x: 14.0, z: 24.0, w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_f_door:    { x: 14.0, z: 18.5, w: 3.2, d: 2.4, color: 0x5ccf7a },
  house_g_door:    { x: 14.0, z: 13.0, w: 3.2, d: 2.4, color: 0x5ccf7a },
  clinic_door:     { x: 17.2, z: 11.4,  w: 3.8, d: 2.6, color: 0x70d6ff },
  market_door:     { x: 38.8, z: 12.9,  w: 5.6, d: 3.0, color: 0xffd166 },
  cafe_door:       { x: 38.8, z: 20.25, w: 5.0, d: 3.0, color: 0xd4a574 },
  restaurant_door: { x: 42.4, z: 31.5, w: 5.2, d: 3.0, color: 0xf28f5b },
  user_home_door:  { x: 13.5, z: 29.5,  w: 3.4, d: 2.4, color: 0xddaa44 },
  museum_door:     { x: 38.8, z: 27.75, w: 5.3, d: 2.8, color: 0xb8b8ff },
  park_center:     { x: 18.4, z: 27.75, w: 7.0, d: 3.8, color: 0x6ee07f },
}

export const NPC_CONFIGS: NPCConfig[] = [
  { id: 'producer', name: 'Producer', color: 0x4488CC, spawn: { x: WAYPOINTS.plaza_side.x, y: 0, z: WAYPOINTS.plaza_side.z }, role: 'producer', label: '制作人·阿P' },
  { id: 'planner', name: 'Planner', color: 0xBB66CC, spawn: { x: WAYPOINTS.cafe_door.x, y: 0, z: WAYPOINTS.cafe_door.z }, role: 'worker', label: '策划·小策' },
  { id: 'explorer', name: 'Explorer', color: 0x44AA44, spawn: { x: WAYPOINTS.house_a_door.x, y: 0, z: WAYPOINTS.house_a_door.z }, role: 'worker', label: '美术·小画' },
  { id: 'coder', name: 'Coder', color: 0x6688AA, spawn: { x: WAYPOINTS.house_b_door.x, y: 0, z: WAYPOINTS.house_b_door.z }, role: 'worker', label: '开发·阿码' },
  { id: 'architect', name: 'Architect', color: 0xCC8844, spawn: { x: WAYPOINTS.house_c_door.x, y: 0, z: WAYPOINTS.house_c_door.z }, role: 'worker', label: '开发·阿构' },
  { id: 'user', name: 'Jin', color: 0xDDAA44, spawn: { x: WAYPOINTS.road_entrance.x, y: 0, z: WAYPOINTS.road_entrance.z }, role: 'user', label: 'Jin' },
]

export type SceneType = 'town' | 'office' | 'museum' | 'house_a' | 'house_b' | 'house_c' | 'user_home' | 'market' | 'cafe'

export type BuildingCategory = 'residential' | 'commercial' | 'public' | 'workspace'

export interface BuildingDef {
  key: string
  name: string
  scene: SceneType
  category: BuildingCategory
  /** Functional tag for behavior template matching (compatible with editor binding tags) */
  tag?: string
  stayRange: [number, number]
  capacity: number
}

export const BUILDING_REGISTRY: BuildingDef[] = [
  { key: 'office_door',     name: 'Công ty chính',      scene: 'office',    category: 'workspace',   tag: 'office',     stayRange: [8000, 16000], capacity: 5 },
  { key: 'coworking_door',  name: 'Văn phòng nhỏ',      scene: 'office',    category: 'workspace',   tag: 'office',     stayRange: [7000, 14000], capacity: 3 },
  { key: 'house_a_door',    name: 'Nhà Minh',           scene: 'house_a',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_b_door',    name: 'Nhà Lan',            scene: 'house_b',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_c_door',    name: 'Nhà Hà',             scene: 'house_c',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_d_door',    name: 'Nhà An',             scene: 'house_a',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_e_door',    name: 'Nhà Khôi',           scene: 'house_b',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_f_door',    name: 'Nhà Vy',             scene: 'house_c',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'house_g_door',    name: 'Nhà Bảo',            scene: 'house_a',   category: 'residential', tag: 'home',       stayRange: [8000, 18000], capacity: 1 },
  { key: 'clinic_door',     name: 'Phòng khám',         scene: 'museum',    category: 'public',      tag: 'clinic',     stayRange: [5000, 11000], capacity: 3 },
  { key: 'market_door',     name: 'Khu chợ',            scene: 'market',    category: 'commercial',  tag: 'market',     stayRange: [5000, 12000], capacity: 6 },
  { key: 'cafe_door',       name: 'Quán cà phê',        scene: 'cafe',      category: 'commercial',  tag: 'cafe',       stayRange: [7000, 15000], capacity: 5 },
  { key: 'restaurant_door', name: 'Quán ăn gia đình',   scene: 'cafe',      category: 'commercial',  tag: 'restaurant', stayRange: [7000, 16000], capacity: 5 },
  { key: 'user_home_door',  name: 'Nhà người quan sát', scene: 'user_home', category: 'residential', tag: 'userHome',   stayRange: [3000, 8000],  capacity: 1 },
  { key: 'museum_door',     name: 'Nhà văn hóa',        scene: 'museum',    category: 'public',      tag: 'museum',     stayRange: [6000, 14000], capacity: 5 },
  { key: 'park_center',     name: 'Công viên',          scene: 'museum',    category: 'public',      tag: 'park',       stayRange: [8000, 18000], capacity: 6 },
]

const BUILDING_NAMES_EN: Record<string, string> = {
  office_door: 'Công ty chính', coworking_door: 'Văn phòng nhỏ',
  house_a_door: 'Nhà Minh', house_b_door: 'Nhà Lan',
  house_c_door: 'Nhà Hà', house_d_door: 'Nhà An',
  house_e_door: 'Nhà Khôi', house_f_door: 'Nhà Vy',
  house_g_door: 'Nhà Bảo', clinic_door: 'Phòng khám',
  market_door: 'Khu chợ', cafe_door: 'Quán cà phê',
  restaurant_door: 'Quán ăn gia đình', user_home_door: 'Nhà người quan sát',
  museum_door: 'Nhà văn hóa', park_center: 'Công viên',
}

export function getBuildingName(key: string): string {
  if (getLocale() === 'en') return BUILDING_NAMES_EN[key] ?? key
  return BUILDING_REGISTRY.find(b => b.key === key)?.name ?? key
}

export interface NPCRouteProfile {
  npcId: string
  homeBuilding: string
  affinities: Record<string, number>
  stayMultiplier: number
  wakeDelay: number
  homeDelay: number
  templateId?: string
  walkSpeed?: number
  socialLevel?: number
}

export type ActivityAction =
  | 'arrived' | 'departed' | 'staying' | 'walking'
  | 'chatted' | 'went_home' | 'woke_up'
  | 'summoned' | 'assigned_task' | 'started_working'
  | 'completed_task' | 'celebrating' | 'returned_from_work'

export interface ActivityEntry {
  time: string
  timestamp: number
  location: string
  locationName: string
  action: ActivityAction
  detail?: string
  relatedNpc?: string
}

export interface DialogueRecord {
  timestamp: number
  partnerNpcId: string
  partnerName: string
  location: string
  turns: { speaker: string; text: string }[]
  summary: string
}

// ── AI-Driven Memory Extensions (Module 13) ──

export interface Relationship {
  npcId: string
  name: string
  label: string
  sentiment: number
  familiarity?: number
  trust?: number
  romance?: number
  tension?: number
  jealousy?: number
  status?: 'stranger' | 'neighbor' | 'friend' | 'close_friend' | 'crush' | 'flirt' | 'lover' | 'ex' | 'rival' | 'strained'
  lastInteraction: number
  interactionCount: number
  recentTopics: string[]
}

export interface DailyReflection {
  dayCount: number
  text: string
  timestamp: number
}

export interface DailyPlanItem {
  time: string
  place: string
  intent: string
}

export interface DailyPlan {
  dayCount: number
  items: DailyPlanItem[]
  currentIndex: number
  suspended: boolean
}

// ── Mode System (Module 8) ──

export type GlobalMode = 'life' | 'work'

export type WorkSubState =
  | 'summoning'
  | 'assigning'
  | 'going_to_office'
  | 'working'
  | 'publishing'
  | 'celebrating'
  | 'returning'

export interface ModeState {
  mode: GlobalMode
  workSubState?: WorkSubState
  taskDescription?: string
  summonedNpcIds: string[]
  startedAt: number
}

export const WORK_SUB_STATE_LABELS: Record<WorkSubState, string> = {
  summoning: '召唤中',
  assigning: '分工中',
  going_to_office: '前往办公室',
  working: '工作中',
  publishing: '发布中',
  celebrating: '庆祝中',
  returning: '返回小镇',
}

const WORK_SUB_STATE_LABELS_EN: Record<WorkSubState, string> = {
  summoning: 'Summoning',
  assigning: 'Briefing',
  going_to_office: 'To Office',
  working: 'Working',
  publishing: 'Publishing',
  celebrating: 'Celebrating',
  returning: 'Returning',
}

import { getLocale } from './i18n'

export function getWorkSubStateLabel(state: WorkSubState): string {
  return getLocale() === 'en' ? WORK_SUB_STATE_LABELS_EN[state] : WORK_SUB_STATE_LABELS[state]
}

export interface NarrativeStep {
  type: 'camera_move' | 'npc_move' | 'dialog' | 'wait'
    | 'scene_switch' | 'npc_state' | 'parallel' | 'fx'
    | 'callback' | 'progress'
  params: Record<string, unknown>
  durationMs?: number
}

export type NarrativeAct = NarrativeStep[]

export interface DialogMessage {
  from: string
  text: string
  timestamp: number
}

export const MOCK_REPLIES: Record<string, string[]> = {
  greeting: ['嗨！欢迎来到小镇！我是这里的制作人。告诉我你想做什么吧！'],
  game_request: ['好主意！让我召唤团队来帮你！', 'Roguelike！很酷。让我叫上大家一起干！'],
  progress: ['策划在写策划案，美术在画概念图，两个开发在实现核心系统…'],
  tour: ['好呀！走吧~', '跟我来，带你转转~'],
  return_office: ['走，回去看看他们干得怎么样'],
  completion: ['全部完成了！你的新作品已经上架博物馆了，去看看？'],
  fallback: ['嗯嗯，我明白了', '好的，让我想想', '有意思！', '没问题~', '交给我吧！'],
}

const MOCK_REPLIES_EN: Record<string, string[]> = {
  greeting: ['Hi! Welcome to town! I\'m the steward. What shall we build?'],
  game_request: ['Great idea! Let me summon the team!', 'Roguelike! Cool. Let me call everyone!'],
  progress: ['Planner is drafting, artist is sketching, devs are coding...'],
  tour: ['Sure! Follow me~', 'This way, let me show you around~'],
  return_office: ['Let\'s check on the team'],
  completion: ['All done! Your creation is in the museum, check it out?'],
  fallback: ['I see', 'Let me think', 'Interesting!', 'No problem~', 'On it!'],
}

export function getMockReplies(): Record<string, string[]> {
  return getLocale() === 'en' ? MOCK_REPLIES_EN : MOCK_REPLIES
}
