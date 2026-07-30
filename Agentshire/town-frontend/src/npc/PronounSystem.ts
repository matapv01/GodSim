export interface PronounSet {
  npcSelf: string
  you: string
}

export function resolvePronouns(
  npcGender: 'male' | 'female',
  status?: string,
): PronounSet {
  if (status === 'lover') {
    if (npcGender === 'female') return { npcSelf: 'em', you: 'anh' }
    return { npcSelf: 'anh', you: 'em' }
  }
  if (status === 'crush' || status === 'flirt') {
    if (npcGender === 'female') return { npcSelf: 'em', you: 'anh' }
    return { npcSelf: 'tôi', you: 'bạn' }
  }
  if (status === 'close_friend') {
    return { npcSelf: 'mình', you: 'cậu' }
  }
  if (status === 'friend' || status === 'neighbor') {
    return { npcSelf: 'tôi', you: 'bạn' }
  }
  if (status === 'strained' || status === 'rival') {
    if (npcGender === 'female') return { npcSelf: 'tôi', you: 'chị' }
    return { npcSelf: 'tôi', you: 'anh' }
  }
  if (npcGender === 'female') return { npcSelf: 'tôi', you: 'anh' }
  return { npcSelf: 'tôi', you: 'bạn' }
}

export function getNpcGenderString(npcId: string): 'male' | 'female' {
  const map: Record<string, 'male' | 'female'> = {
    steward: 'female',
    user: 'male',
    citizen_1: 'male',
    citizen_2: 'female',
    citizen_3: 'female',
    citizen_4: 'female',
    citizen_5: 'male',
    citizen_6: 'female',
    citizen_7: 'male',
  }
  return map[npcId] ?? 'male'
}

export function buildXungHoInstruction(npcId: string, status?: string): string {
  const gender = getNpcGenderString(npcId)
  const p = resolvePronouns(gender, status)
  return `Xưng hô: tự xưng là "${p.npcSelf}", gọi người chơi là "${p.you}". Dùng nhất quán trong suốt hội thoại.`
}
