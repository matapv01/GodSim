// ────────────────────────────────────────────────────────────
// Performance — Hardware-based profile detection
//
// Three tiers (low / medium / high) with config presets.
// ────────────────────────────────────────────────────────────

export type PerformanceProfile = 'low' | 'medium' | 'high'

export interface PerformanceConfig {
  maxParticles: number
  physicsFps: number
  targetFps: number
  antialias: boolean
  postProcess: boolean
}

export const LOW: PerformanceConfig = {
  maxParticles: 50, physicsFps: 30, targetFps: 30, antialias: false, postProcess: false,
}

export const MEDIUM: PerformanceConfig = {
  maxParticles: 200, physicsFps: 60, targetFps: 60, antialias: true, postProcess: false,
}

export const HIGH: PerformanceConfig = {
  maxParticles: 500, physicsFps: 60, targetFps: 60, antialias: true, postProcess: true,
}

export const PROFILES: Record<PerformanceProfile, PerformanceConfig> = { low: LOW, medium: MEDIUM, high: HIGH }

export function detectProfile(): PerformanceProfile {
  const memory = (navigator as any).deviceMemory as number | undefined
  const cores = navigator.hardwareConcurrency || 4
  if (memory !== undefined && memory <= 2) return 'low'
  if (cores <= 2) return 'low'
  if (cores >= 8 || (memory && memory >= 8)) return 'high'
  return 'medium'
}

export function getConfig(profile: PerformanceProfile): PerformanceConfig {
  return PROFILES[profile]
}
