export type ProfessionId =
  | 'observer'
  | 'office_worker'
  | 'software_engineer'
  | 'designer'
  | 'dentist'
  | 'doctor'
  | 'police'
  | 'shopkeeper'
  | 'barista'
  | 'cook'
  | 'teacher'
  | 'artist'
  | 'journalist'
  | 'unemployed'

export interface ProfessionDef {
  id: ProfessionId
  label: string
  description: string
  workplaceKeys: string[]
  patrolKeys?: string[]
  affinity: Record<string, number>
  keywords: string[]
  authority?: number
  fearAura?: number
}

export interface ProfessionOption {
  value: string
  label: string
}

export const PROFESSIONS: ProfessionDef[] = [
  {
    id: 'observer',
    label: 'Người quan sát',
    description: 'Tự do đi lại, tham gia xã hội theo ý người chơi.',
    workplaceKeys: ['user_home_door', 'park_center', 'cafe_door'],
    affinity: { user_home_door: 2.6, park_center: 1.5, cafe_door: 1.3 },
    keywords: ['observer', 'quan sát', 'quan sat', 'người chơi', 'nguoi choi'],
  },
  {
    id: 'office_worker',
    label: 'Nhân viên công ty',
    description: 'Đi làm ở công ty vào ban ngày, ghé cafe hoặc quán ăn sau giờ làm.',
    workplaceKeys: ['office_door', 'coworking_door'],
    affinity: { office_door: 5.5, coworking_door: 3.2, cafe_door: 1.5, restaurant_door: 1.4 },
    keywords: ['công ty', 'cong ty', 'office', 'planner', 'product', 'lập kế hoạch', 'lap ke hoach'],
  },
  {
    id: 'software_engineer',
    label: 'Kỹ sư phần mềm',
    description: 'Làm việc nhiều ở văn phòng, hay ghé cafe để suy nghĩ hoặc gặp đồng nghiệp.',
    workplaceKeys: ['office_door', 'coworking_door'],
    affinity: { office_door: 5.8, coworking_door: 4.0, cafe_door: 1.6 },
    keywords: ['frontend', 'backend', 'dev', 'developer', 'programming', 'lập trình', 'lap trinh', 'kỹ sư', 'ky su', 'software'],
  },
  {
    id: 'designer',
    label: 'Nhà thiết kế',
    description: 'Làm ở văn phòng nhỏ, nhà văn hóa và cafe.',
    workplaceKeys: ['coworking_door', 'museum_door'],
    affinity: { coworking_door: 4.2, museum_door: 2.8, cafe_door: 1.8, office_door: 1.5 },
    keywords: ['design', 'designer', 'thiết kế', 'thiet ke', 'kiến trúc', 'kien truc', 'màu sắc', 'mau sac'],
  },
  {
    id: 'dentist',
    label: 'Nha sĩ',
    description: 'Làm việc ở phòng khám, nói chuyện nhiều về lịch khám và sức khỏe răng miệng.',
    workplaceKeys: ['clinic_door'],
    affinity: { clinic_door: 7.0, office_door: 1.2, cafe_door: 1.2 },
    keywords: ['nha sĩ', 'nha si', 'dentist', 'răng', 'rang'],
  },
  {
    id: 'doctor',
    label: 'Bác sĩ',
    description: 'Trực ở phòng khám, ghé chợ/quán ăn sau ca làm.',
    workplaceKeys: ['clinic_door'],
    affinity: { clinic_door: 7.2, market_door: 1.4, restaurant_door: 1.3 },
    keywords: ['bác sĩ', 'bac si', 'doctor', 'y tá', 'y ta', 'nurse', 'khám', 'kham'],
  },
  {
    id: 'police',
    label: 'Cảnh sát',
    description: 'Đi tuần quanh công ty, chợ, công viên; xử lý xe đi sai đường, đậu sai chỗ, đánh nhau và gây gổ.',
    workplaceKeys: ['office_door'],
    patrolKeys: ['market_door', 'park_center', 'cafe_door', 'restaurant_door', 'office_door'],
    affinity: { office_door: 3.8, market_door: 3.8, park_center: 3.5, cafe_door: 2.0, restaurant_door: 2.4, clinic_door: 1.2 },
    keywords: ['cảnh sát', 'canh sat', 'công an', 'cong an', 'police', 'an ninh', 'security'],
    authority: 90,
    fearAura: 80,
  },
  {
    id: 'shopkeeper',
    label: 'Chủ sạp chợ',
    description: 'Có mặt ở khu chợ, biết nhiều tin đồn và khách quen.',
    workplaceKeys: ['market_door'],
    affinity: { market_door: 7.0, restaurant_door: 1.5, cafe_door: 1.2 },
    keywords: ['chợ', 'cho', 'bán hàng', 'ban hang', 'shop', 'shopkeeper', 'seller'],
  },
  {
    id: 'barista',
    label: 'Pha chế',
    description: 'Làm ở quán cafe và dễ nghe được chuyện riêng của khách.',
    workplaceKeys: ['cafe_door'],
    affinity: { cafe_door: 7.0, market_door: 1.2, restaurant_door: 1.2 },
    keywords: ['barista', 'pha chế', 'pha che', 'cafe', 'cà phê', 'ca phe'],
  },
  {
    id: 'cook',
    label: 'Đầu bếp',
    description: 'Làm ở quán ăn, bận nhất vào giờ ăn.',
    workplaceKeys: ['restaurant_door'],
    affinity: { restaurant_door: 7.0, market_door: 2.0, cafe_door: 1.1 },
    keywords: ['đầu bếp', 'dau bep', 'cook', 'chef', 'quán ăn', 'quan an'],
  },
  {
    id: 'teacher',
    label: 'Giáo viên',
    description: 'Hay đến nhà văn hóa, công viên và cafe để gặp học trò/phụ huynh.',
    workplaceKeys: ['museum_door'],
    affinity: { museum_door: 5.5, park_center: 2.0, cafe_door: 1.4 },
    keywords: ['giáo viên', 'giao vien', 'teacher', 'dạy', 'day'],
  },
  {
    id: 'artist',
    label: 'Nghệ sĩ',
    description: 'Lang thang giữa nhà văn hóa, công viên và cafe để tìm cảm hứng.',
    workplaceKeys: ['museum_door', 'park_center'],
    affinity: { museum_door: 4.0, park_center: 3.2, cafe_door: 2.0 },
    keywords: ['nghệ sĩ', 'nghe si', 'artist', 'vẽ', 've', 'âm nhạc', 'am nhac'],
  },
  {
    id: 'journalist',
    label: 'Phóng viên',
    description: 'Đi nhiều qua chợ, cafe, công viên để nghe chuyện và săn tin.',
    workplaceKeys: ['market_door', 'cafe_door'],
    affinity: { market_door: 3.5, cafe_door: 3.2, park_center: 2.0, office_door: 1.4 },
    keywords: ['phóng viên', 'phong vien', 'journalist', 'nội dung', 'noi dung', 'content', 'writing'],
  },
  {
    id: 'unemployed',
    label: 'Tự do',
    description: 'Không có nơi làm cố định, hay ghé cafe, công viên, chợ.',
    workplaceKeys: ['cafe_door', 'park_center', 'market_door'],
    affinity: { cafe_door: 2.8, park_center: 2.5, market_door: 2.0, restaurant_door: 1.4 },
    keywords: ['tự do', 'tu do', 'freelance', 'general', 'tổng quát', 'tong quat'],
  },
]

const byId = new Map(PROFESSIONS.map((p) => [p.id, p]))
const normalize = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function getProfessionOptions(): ProfessionOption[] {
  return PROFESSIONS.map((p) => ({ value: p.label, label: p.label }))
}

export function getProfessionById(id: ProfessionId): ProfessionDef {
  return byId.get(id) ?? byId.get('unemployed')!
}

export function getProfessionForSpecialty(specialty?: string): ProfessionDef {
  const raw = (specialty ?? '').trim()
  if (!raw) return getProfessionById('unemployed')
  const normalized = normalize(raw)
  for (const p of PROFESSIONS) {
    if (normalize(p.label) === normalized) return p
  }
  for (const p of PROFESSIONS) {
    if (p.keywords.some((kw) => normalized.includes(normalize(kw)))) return p
  }
  return getProfessionById('unemployed')
}

export function isPoliceSpecialty(specialty?: string): boolean {
  return getProfessionForSpecialty(specialty).id === 'police'
}
