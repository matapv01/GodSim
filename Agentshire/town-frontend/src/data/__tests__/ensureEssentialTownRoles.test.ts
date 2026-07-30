import { describe, expect, it } from 'vitest'
import { ensureEssentialTownRoles, type TownConfig } from '../TownConfig'
import { getProfessionForSpecialty } from '../Professions'

function makeConfig(): TownConfig {
  return {
    townName: 'Test',
    steward: { name: 'Quản gia', persona: 'SOUL', avatarId: 'char-female-b' },
    user: { name: 'Người chơi', specialty: 'Người quan sát', avatarId: 'char-male-c' },
    citizens: [
      { id: 'citizen_1', name: 'Minh', specialty: 'Backend', persona: 'YAN', avatarId: 'char-male-b', homeId: 'house_a' },
      { id: 'citizen_2', name: 'Lan', specialty: 'Thiết kế', persona: 'CHENGZI', avatarId: 'char-female-c', homeId: 'house_b' },
      { id: 'citizen_3', name: 'Hà', specialty: 'Dữ liệu', persona: 'HAITANG', avatarId: 'char-female-e', homeId: 'house_c' },
      { id: 'citizen_4', name: 'An', specialty: 'Frontend', persona: 'DIANDIAN', avatarId: 'char-female-f', homeId: 'house_d' },
      { id: 'citizen_5', name: 'Khôi', specialty: 'Kiến trúc', persona: 'XIAOLIE', avatarId: 'char-male-e', homeId: 'house_e' },
      { id: 'citizen_6', name: 'Vy', specialty: 'Nội dung', persona: 'QIQI', avatarId: 'char-female-d', homeId: 'house_f' },
      { id: 'citizen_7', name: 'Bảo', specialty: 'Phân tích', persona: 'CHEN', avatarId: 'char-male-d', homeId: 'house_g' },
    ],
    createdAt: Date.now(),
    version: 5,
  }
}

describe('ensureEssentialTownRoles', () => {
  it('assigns required workplace roles to default citizens when missing', () => {
    const config = ensureEssentialTownRoles(makeConfig())
    const professions = config.citizens.map(c => getProfessionForSpecialty(c.specialty).id)

    expect(professions).toContain('office_worker')
    expect(professions).toContain('dentist')
    expect(professions).toContain('police')
    expect(professions).toContain('shopkeeper')
    expect(professions).toContain('barista')
    expect(professions).toContain('cook')
    expect(professions).toContain('journalist')
  })
})
