export type PersonalityKey = 'friendliness' | 'confidence' | 'humor' | 'patience' | 'ambition'
export type NeedKey = 'hunger' | 'energy' | 'social' | 'happiness'

export interface GodSimNpcProfile {
  personality: Record<PersonalityKey, number>
  needs: Record<NeedKey, number>
}

const DEFAULT_PROFILE: GodSimNpcProfile = {
  personality: {
    friendliness: 76,
    confidence: 50,
    humor: 50,
    patience: 78,
    ambition: 42,
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
    personality: { friendliness: 82, confidence: 62, humor: 42, patience: 90, ambition: 52 },
    needs: { hunger: 22, energy: 82, social: 46, happiness: 70 },
  },
  user: {
    personality: { friendliness: 72, confidence: 56, humor: 48, patience: 90, ambition: 42 },
    needs: { hunger: 18, energy: 90, social: 30, happiness: 68 },
  },
  citizen_1: {
    personality: { friendliness: 74, confidence: 56, humor: 42, patience: 88, ambition: 54 },
    needs: { hunger: 34, energy: 68, social: 38, happiness: 66 },
  },
  citizen_2: {
    personality: { friendliness: 84, confidence: 56, humor: 60, patience: 78, ambition: 52 },
    needs: { hunger: 42, energy: 64, social: 76, happiness: 72 },
  },
  citizen_3: {
    personality: { friendliness: 82, confidence: 52, humor: 50, patience: 90, ambition: 46 },
    needs: { hunger: 30, energy: 70, social: 58, happiness: 76 },
  },
  citizen_4: {
    personality: { friendliness: 88, confidence: 54, humor: 70, patience: 80, ambition: 44 },
    needs: { hunger: 38, energy: 78, social: 82, happiness: 84 },
  },
  citizen_5: {
    personality: { friendliness: 78, confidence: 58, humor: 52, patience: 76, ambition: 56 },
    needs: { hunger: 52, energy: 62, social: 48, happiness: 60 },
  },
  citizen_6: {
    personality: { friendliness: 84, confidence: 54, humor: 64, patience: 78, ambition: 50 },
    needs: { hunger: 36, energy: 66, social: 78, happiness: 82 },
  },
  citizen_7: {
    personality: { friendliness: 74, confidence: 54, humor: 40, patience: 92, ambition: 48 },
    needs: { hunger: 26, energy: 74, social: 34, happiness: 64 },
  },
}

export function getGodSimNpcProfile(npcId: string): GodSimNpcProfile {
  return PROFILES[npcId] ?? DEFAULT_PROFILE
}
