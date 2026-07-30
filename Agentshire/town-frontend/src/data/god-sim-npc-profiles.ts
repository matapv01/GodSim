export type PersonalityKey = 'friendliness' | 'confidence' | 'humor' | 'patience' | 'ambition'
export type NeedKey = 'hunger' | 'energy' | 'social' | 'happiness'

export interface GodSimNpcProfile {
  personality: Record<PersonalityKey, number>
  needs: Record<NeedKey, number>
}

const DEFAULT_PROFILE: GodSimNpcProfile = {
  personality: {
    friendliness: 62,
    confidence: 58,
    humor: 45,
    patience: 60,
    ambition: 52,
  },
  needs: {
    hunger: 28,
    energy: 72,
    social: 50,
    happiness: 64,
  },
}

const PROFILES: Record<string, GodSimNpcProfile> = {
  steward: {
    personality: { friendliness: 68, confidence: 86, humor: 36, patience: 78, ambition: 72 },
    needs: { hunger: 22, energy: 82, social: 46, happiness: 70 },
  },
  user: {
    personality: { friendliness: 50, confidence: 70, humor: 42, patience: 88, ambition: 55 },
    needs: { hunger: 18, energy: 90, social: 30, happiness: 68 },
  },
  citizen_1: {
    personality: { friendliness: 54, confidence: 76, humor: 34, patience: 82, ambition: 80 },
    needs: { hunger: 34, energy: 68, social: 38, happiness: 66 },
  },
  citizen_2: {
    personality: { friendliness: 82, confidence: 74, humor: 64, patience: 58, ambition: 78 },
    needs: { hunger: 42, energy: 64, social: 76, happiness: 72 },
  },
  citizen_3: {
    personality: { friendliness: 74, confidence: 62, humor: 48, patience: 84, ambition: 60 },
    needs: { hunger: 30, energy: 70, social: 58, happiness: 76 },
  },
  citizen_4: {
    personality: { friendliness: 88, confidence: 66, humor: 82, patience: 62, ambition: 58 },
    needs: { hunger: 38, energy: 78, social: 82, happiness: 84 },
  },
  citizen_5: {
    personality: { friendliness: 58, confidence: 84, humor: 52, patience: 40, ambition: 86 },
    needs: { hunger: 52, energy: 62, social: 48, happiness: 60 },
  },
  citizen_6: {
    personality: { friendliness: 80, confidence: 68, humor: 76, patience: 56, ambition: 74 },
    needs: { hunger: 36, energy: 66, social: 78, happiness: 82 },
  },
  citizen_7: {
    personality: { friendliness: 48, confidence: 72, humor: 30, patience: 86, ambition: 70 },
    needs: { hunger: 26, energy: 74, social: 34, happiness: 64 },
  },
}

export function getGodSimNpcProfile(npcId: string): GodSimNpcProfile {
  return PROFILES[npcId] ?? DEFAULT_PROFILE
}
