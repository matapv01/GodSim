/**
 * Routine templates define daily behavior patterns for citizens.
 * Each template specifies preferred building tags per time period,
 * with randomization parameters to ensure variety.
 *
 * Templates reference building tags (compatible with editor binding system),
 * not specific building IDs. Runtime resolves tags to actual buildings.
 */

import type { TimePeriod } from '../types'
import { getLocale } from '../i18n'

export interface ScheduleSlot {
  period: TimePeriod
  /** Preferred building tag (e.g. 'cafe', 'office', 'home'). null = any. */
  preferredTag: string | null
  /** 0-1: probability of staying at current location instead of following schedule */
  stayChance: number
  /** 0-1: probability of skipping this slot entirely (adds randomness) */
  skipChance: number
}

export interface RoutineTemplate {
  id: string
  label: string
  schedule: ScheduleSlot[]
  wakeOffset: [number, number]
  sleepOffset: [number, number]
  walkSpeed: [number, number]
  stayMultiplier: [number, number]
  /** 0-1: higher = more likely to greet/chat with other NPCs */
  socialLevel: number
}

const TEMPLATES: RoutineTemplate[] = [
  {
    id: 'workaholic',
    label: '工作狂',
    schedule: [
      { period: 'dawn',      preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
      { period: 'morning',   preferredTag: 'office', stayChance: 0.2, skipChance: 0.05 },
      { period: 'noon',      preferredTag: 'restaurant', stayChance: 0.2, skipChance: 0.15 },
      { period: 'afternoon', preferredTag: 'office', stayChance: 0.2, skipChance: 0 },
      { period: 'dusk',      preferredTag: 'cafe',   stayChance: 0.1, skipChance: 0.25 },
      { period: 'night',     preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
    ],
    wakeOffset: [-10_000, 5_000],
    sleepOffset: [5_000, 20_000],
    walkSpeed: [2.5, 3.0],
    stayMultiplier: [0.6, 0.9],
    socialLevel: 0.3,
  },
  {
    id: 'social',
    label: '社交达人',
    schedule: [
      { period: 'dawn',      preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
      { period: 'morning',   preferredTag: 'market', stayChance: 0.1, skipChance: 0.2 },
      { period: 'noon',      preferredTag: 'restaurant', stayChance: 0.1, skipChance: 0.1 },
      { period: 'afternoon', preferredTag: 'park',   stayChance: 0.2, skipChance: 0.25 },
      { period: 'dusk',      preferredTag: 'cafe',   stayChance: 0.2, skipChance: 0.2 },
      { period: 'night',     preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
    ],
    wakeOffset: [-5_000, 10_000],
    sleepOffset: [-5_000, 10_000],
    walkSpeed: [2.0, 2.8],
    stayMultiplier: [0.7, 1.0],
    socialLevel: 0.8,
  },
  {
    id: 'creative',
    label: '创意型',
    schedule: [
      { period: 'dawn',      preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
      { period: 'morning',   preferredTag: 'cafe',   stayChance: 0.4, skipChance: 0.4 },
      { period: 'noon',      preferredTag: 'restaurant', stayChance: 0.2, skipChance: 0.2 },
      { period: 'afternoon', preferredTag: 'museum', stayChance: 0.3, skipChance: 0.2 },
      { period: 'dusk',      preferredTag: 'home',   stayChance: 0.3, skipChance: 0.1 },
      { period: 'night',     preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
    ],
    wakeOffset: [10_000, 30_000],
    sleepOffset: [-10_000, 5_000],
    walkSpeed: [1.8, 2.5],
    stayMultiplier: [0.9, 1.3],
    socialLevel: 0.4,
  },
  {
    id: 'homebody',
    label: '居家型',
    schedule: [
      { period: 'dawn',      preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
      { period: 'morning',   preferredTag: 'home',   stayChance: 0.5, skipChance: 0.3 },
      { period: 'noon',      preferredTag: 'market', stayChance: 0.2, skipChance: 0.4 },
      { period: 'afternoon', preferredTag: 'clinic', stayChance: 0.2, skipChance: 0.45 },
      { period: 'dusk',      preferredTag: 'home',   stayChance: 0.8, skipChance: 0 },
      { period: 'night',     preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
    ],
    wakeOffset: [0, 15_000],
    sleepOffset: [-15_000, 0],
    walkSpeed: [1.8, 2.3],
    stayMultiplier: [1.0, 1.4],
    socialLevel: 0.2,
  },
  {
    id: 'explorer',
    label: '探索者',
    schedule: [
      { period: 'dawn',      preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
      { period: 'morning',   preferredTag: 'market',  stayChance: 0.1, skipChance: 0.2 },
      { period: 'noon',      preferredTag: 'restaurant', stayChance: 0.1, skipChance: 0.1 },
      { period: 'afternoon', preferredTag: 'park',    stayChance: 0.1, skipChance: 0.1 },
      { period: 'dusk',      preferredTag: 'museum',  stayChance: 0.2, skipChance: 0.25 },
      { period: 'night',     preferredTag: 'home',   stayChance: 1.0, skipChance: 0 },
    ],
    wakeOffset: [-5_000, 15_000],
    sleepOffset: [-5_000, 15_000],
    walkSpeed: [2.2, 3.0],
    stayMultiplier: [0.5, 0.8],
    socialLevel: 0.5,
  },
]

const SPECIALTY_MATCH: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /nha\s*s[ĩi]|dentist|b[aá]c\s*s[ĩi]|doctor|y\s*t[aá]|clinic|ph[oò]ng\s*kh[aá]m/i, templateId: 'workaholic' },
  { pattern: /c[ảa]nh\s*s[aá]t|c[oô]ng\s*an|police|an\s*ninh|security|tr[ậa]t\s*t[ựu]/i, templateId: 'explorer' },
  { pattern: /ch[uủ]\s*s[ạa]p|b[aá]n\s*h[aà]ng|shopkeeper|seller|ch[oợ]/i, templateId: 'social' },
  { pattern: /pha\s*ch[ếe]|barista|cafe|c[aà]\s*ph[eê]/i, templateId: 'social' },
  { pattern: /[đd][ầa]u\s*b[ếe]p|cook|chef|qu[aá]n\s*[ăa]n|restaurant/i, templateId: 'workaholic' },
  { pattern: /ph[oó]ng\s*vi[eê]n|journalist|s[aă]n\s*tin|tin\s*[đd][oồ]n/i, templateId: 'explorer' },
  { pattern: /架构|后端|开发|工程|服务端|kiến trúc|backend|hệ thống|kỹ thuật/i, templateId: 'workaholic' },
  { pattern: /产品|运营|内容|营销|自媒体|sản phẩm|vận hành|nội dung|marketing/i, templateId: 'social' },
  { pattern: /设计|UI|美术|创意|视觉|thiết kế|màu sắc|sáng tạo/i, templateId: 'creative' },
  { pattern: /前端|数据|分析|测试|QA|frontend|dữ liệu|phân tích/i, templateId: 'homebody' },
]

export function getTemplateById(id: string): RoutineTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1]
}

const TEMPLATE_LABELS_EN: Record<string, string> = {
  workaholic: 'Ham làm',
  social: 'Hướng ngoại',
  creative: 'Sáng tạo',
  homebody: 'Thích ở nhà',
  explorer: 'Hay đi',
}

export function getTemplateLabel(templateId: string): string {
  if (getLocale() === 'en') return TEMPLATE_LABELS_EN[templateId] ?? templateId
  return TEMPLATES.find(t => t.id === templateId)?.label ?? templateId
}

export function matchTemplate(specialty: string): RoutineTemplate {
  const spec = (specialty ?? '').toLowerCase()
  for (const rule of SPECIALTY_MATCH) {
    if (rule.pattern.test(spec)) return getTemplateById(rule.templateId)
  }
  return TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
}

export function getScheduleSlotForPeriod(template: RoutineTemplate, period: TimePeriod): ScheduleSlot | null {
  return template.schedule.find(s => s.period === period) ?? null
}

export function randInRange(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0])
}
