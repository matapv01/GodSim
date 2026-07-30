import * as THREE from 'three'
import type { GameClock } from '../GameClock'
import type { TownLightingRefs } from '../scene/TownBuilder'
import type { PostProcessManager } from './PostProcessing'

interface LightingPreset {
  sunColor: THREE.Color
  sunIntensity: number
  sunAngleDeg: number
  ambientColor: THREE.Color
  ambientIntensity: number
  hemiSkyColor: THREE.Color
  hemiGroundColor: THREE.Color
  hemiIntensity: number
  skyColor: THREE.Color
  fogNear: number
  fogFar: number
  bloomStrength: number
  streetLightIntensity: number
  windowEmissiveIntensity: number
}

// ═══════════════════════════════════════════════════════════════════
// 核心原则（参考 threejsdemos.com Day-Night Cycle + 动森/星露谷）:
//  1. ambient / hemi 颜色始终用浅色（白、浅灰蓝），只靠 intensity 控亮暗
//     → MeshLambertMaterial 最终亮度 = color × light_color × intensity
//     → 深色 light_color 会把乘积压到接近 0，无论 intensity 多高都是黑的
//  2. 夜间 directional 保持 ≥0.15 作为月光方向感
//  3. 下午 16:00 前场景保持完全明亮，17:00 后才开始日落
//  4. hour 27(=3AM) 加一帧与午夜等暗，防止凌晨比晚上亮
//  5. 夜间 sky/fog 用深蓝（不是黑），fog far 不低于 70
// ═══════════════════════════════════════════════════════════════════
const PRESETS: Array<{ hour: number; preset: LightingPreset }> = [
  // 05:00 黎明
  { hour: 5, preset: {
    sunColor: new THREE.Color(0xffd4a0), sunIntensity: 0.6, sunAngleDeg: 10,
    ambientColor: new THREE.Color(0xe0d8c8), ambientIntensity: 0.35,
    hemiSkyColor: new THREE.Color(0xffcba4), hemiGroundColor: new THREE.Color(0x806040), hemiIntensity: 0.25,
    skyColor: new THREE.Color(0xffcba4), fogNear: 35, fogFar: 75, bloomStrength: 0.4,
    streetLightIntensity: 0.5, windowEmissiveIntensity: 0.2,
  }},
  // 07:00 上午
  { hour: 7, preset: {
    sunColor: new THREE.Color(0xfff5e0), sunIntensity: 1.0, sunAngleDeg: 35,
    ambientColor: new THREE.Color(0xd8e0f0), ambientIntensity: 0.55,
    hemiSkyColor: new THREE.Color(0x87ceeb), hemiGroundColor: new THREE.Color(0x4a6830), hemiIntensity: 0.35,
    skyColor: new THREE.Color(0x87ceeb), fogNear: 40, fogFar: 85, bloomStrength: 0.3,
    streetLightIntensity: 0, windowEmissiveIntensity: 0,
  }},
  // 12:00 正午 — 最亮
  { hour: 12, preset: {
    sunColor: new THREE.Color(0xfffef5), sunIntensity: 1.3, sunAngleDeg: 80,
    ambientColor: new THREE.Color(0xe0e8ff), ambientIntensity: 0.65,
    hemiSkyColor: new THREE.Color(0xa0d8ff), hemiGroundColor: new THREE.Color(0x4a6830), hemiIntensity: 0.35,
    skyColor: new THREE.Color(0xa0d8ff), fogNear: 45, fogFar: 90, bloomStrength: 0.25,
    streetLightIntensity: 0, windowEmissiveIntensity: 0,
  }},
  // 14:00 下午 — 仍然很亮
  { hour: 14, preset: {
    sunColor: new THREE.Color(0xfff0d0), sunIntensity: 1.1, sunAngleDeg: 60,
    ambientColor: new THREE.Color(0xd8e0f0), ambientIntensity: 0.58,
    hemiSkyColor: new THREE.Color(0x90d0f0), hemiGroundColor: new THREE.Color(0x4a6830), hemiIntensity: 0.35,
    skyColor: new THREE.Color(0x87ceeb), fogNear: 42, fogFar: 85, bloomStrength: 0.3,
    streetLightIntensity: 0, windowEmissiveIntensity: 0,
  }},
  // 16:00 傍晚前 — 依然明亮，无感知变暗
  { hour: 16, preset: {
    sunColor: new THREE.Color(0xffe8b0), sunIntensity: 0.95, sunAngleDeg: 40,
    ambientColor: new THREE.Color(0xd8dce8), ambientIntensity: 0.55,
    hemiSkyColor: new THREE.Color(0x90c8e0), hemiGroundColor: new THREE.Color(0x4a6830), hemiIntensity: 0.32,
    skyColor: new THREE.Color(0x85c8e8), fogNear: 40, fogFar: 82, bloomStrength: 0.32,
    streetLightIntensity: 0, windowEmissiveIntensity: 0,
  }},
  // 17:30 黄金时刻 — 日落色彩但亮度充足
  { hour: 17.5, preset: {
    sunColor: new THREE.Color(0xff9050), sunIntensity: 0.7, sunAngleDeg: 12,
    ambientColor: new THREE.Color(0xd8c8b0), ambientIntensity: 0.45,
    hemiSkyColor: new THREE.Color(0xe08040), hemiGroundColor: new THREE.Color(0x604030), hemiIntensity: 0.28,
    skyColor: new THREE.Color(0xff8855), fogNear: 36, fogFar: 78, bloomStrength: 0.4,
    streetLightIntensity: 0.5, windowEmissiveIntensity: 0.2,
  }},
  // 18:30 暮色 — 天边余晖，路灯亮起
  { hour: 18.5, preset: {
    sunColor: new THREE.Color(0xc06040), sunIntensity: 0.35, sunAngleDeg: 3,
    ambientColor: new THREE.Color(0xc0b0a8), ambientIntensity: 0.40,
    hemiSkyColor: new THREE.Color(0x906050), hemiGroundColor: new THREE.Color(0x504038), hemiIntensity: 0.25,
    skyColor: new THREE.Color(0x804050), fogNear: 34, fogFar: 75, bloomStrength: 0.45,
    streetLightIntensity: 1.2, windowEmissiveIntensity: 0.45,
  }},
  // 19:30 入夜 — 月夜定型，路灯全亮
  { hour: 19.5, preset: {
    sunColor: new THREE.Color(0x8090c0), sunIntensity: 0.15, sunAngleDeg: -10,
    ambientColor: new THREE.Color(0xb0b8d0), ambientIntensity: 0.40,
    hemiSkyColor: new THREE.Color(0x506888), hemiGroundColor: new THREE.Color(0x304048), hemiIntensity: 0.25,
    skyColor: new THREE.Color(0x1a2a50), fogNear: 35, fogFar: 75, bloomStrength: 0.5,
    streetLightIntensity: 2.0, windowEmissiveIntensity: 0.7,
  }},
  // 23:00 午夜 — 最暗点，但依然可见
  { hour: 23, preset: {
    sunColor: new THREE.Color(0x7080b0), sunIntensity: 0.12, sunAngleDeg: -25,
    ambientColor: new THREE.Color(0xa0a8c0), ambientIntensity: 0.35,
    hemiSkyColor: new THREE.Color(0x405070), hemiGroundColor: new THREE.Color(0x283040), hemiIntensity: 0.22,
    skyColor: new THREE.Color(0x151e3a), fogNear: 32, fogFar: 72, bloomStrength: 0.5,
    streetLightIntensity: 2.0, windowEmissiveIntensity: 0.7,
  }},
  // 27:00 (=3AM) 凌晨 — 与午夜同暗，不提前回亮
  { hour: 27, preset: {
    sunColor: new THREE.Color(0x7080b0), sunIntensity: 0.12, sunAngleDeg: -25,
    ambientColor: new THREE.Color(0xa0a8c0), ambientIntensity: 0.35,
    hemiSkyColor: new THREE.Color(0x405070), hemiGroundColor: new THREE.Color(0x283040), hemiIntensity: 0.22,
    skyColor: new THREE.Color(0x151e3a), fogNear: 32, fogFar: 72, bloomStrength: 0.5,
    streetLightIntensity: 2.0, windowEmissiveIntensity: 0.7,
  }},
  // 29:00 (=5AM) 黎明 — 与 hour 5 衔接
  { hour: 29, preset: {
    sunColor: new THREE.Color(0xffd4a0), sunIntensity: 0.6, sunAngleDeg: 10,
    ambientColor: new THREE.Color(0xe0d8c8), ambientIntensity: 0.35,
    hemiSkyColor: new THREE.Color(0xffcba4), hemiGroundColor: new THREE.Color(0x806040), hemiIntensity: 0.25,
    skyColor: new THREE.Color(0xffcba4), fogNear: 35, fogFar: 75, bloomStrength: 0.4,
    streetLightIntensity: 0.5, windowEmissiveIntensity: 0.2,
  }},
]

export class TimeOfDayLighting {
  private refs: TownLightingRefs
  private scene: THREE.Scene
  private postProcess: PostProcessManager | null
  private enabled = true
  private updateCounter = 0

  private currentSunColor = new THREE.Color()
  private currentAmbientColor = new THREE.Color()
  private currentHemiSkyColor = new THREE.Color()
  private currentHemiGroundColor = new THREE.Color()
  private currentSkyColor = new THREE.Color()
  private currentSunIntensity = 1.0
  private currentAmbientIntensity = 0.6
  private currentHemiIntensity = 0.35
  private currentSunAngle = 35
  private currentFogNear = 40
  private currentFogFar = 80
  private currentBloom = 0.35
  private currentStreetLight = 0
  private currentWindowEmissive = 0

  // Weather override state (applied after base lighting)
  private weatherSunMul = 1
  private weatherAmbMul = 1
  private weatherAmbTint = new THREE.Color(1, 1, 1)
  private weatherFogNearOff = 0
  private weatherFogFarOff = 0
  private weatherSkyTint = new THREE.Color(1, 1, 1)
  private flashActive = false
  private flashSunOverride = 0
  private flashAmbOverride = 0

  constructor(scene: THREE.Scene, refs: TownLightingRefs, postProcess: PostProcessManager | null) {
    this.scene = scene
    this.refs = refs
    this.postProcess = postProcess

    this.currentSunColor.copy(refs.directional.color)
    this.currentAmbientColor.copy(refs.ambient.color)
    this.currentHemiSkyColor.set(0x87ceeb)
    this.currentHemiGroundColor.set(0x3a6020)
    this.currentSkyColor.set(0x87ceeb)
  }

  update(gameClock: GameClock): void {
    if (!this.enabled) return

    this.updateCounter++
    if (this.updateCounter % 10 !== 0) return

    const hour = gameClock.getGameHour()
    const target = this.samplePreset(hour)

    // samplePreset 已通过 smoothstep 在关键帧间做了平滑插值，
    // 此处仅用快速 lerp(0.5) 消除帧间微跳，1~2 次更新即收敛
    const k = 0.5

    this.currentSunColor.lerp(target.sunColor, k)
    this.currentAmbientColor.lerp(target.ambientColor, k)
    this.currentHemiSkyColor.lerp(target.hemiSkyColor, k)
    this.currentHemiGroundColor.lerp(target.hemiGroundColor, k)
    this.currentSkyColor.lerp(target.skyColor, k)

    this.currentSunIntensity    = THREE.MathUtils.lerp(this.currentSunIntensity,    target.sunIntensity,    k)
    this.currentAmbientIntensity = THREE.MathUtils.lerp(this.currentAmbientIntensity, target.ambientIntensity, k)
    this.currentHemiIntensity   = THREE.MathUtils.lerp(this.currentHemiIntensity,   target.hemiIntensity,   k)
    this.currentSunAngle        = THREE.MathUtils.lerp(this.currentSunAngle,        target.sunAngleDeg,     k)
    this.currentFogNear         = THREE.MathUtils.lerp(this.currentFogNear,         target.fogNear,         k)
    this.currentFogFar          = THREE.MathUtils.lerp(this.currentFogFar,          target.fogFar,          k)
    this.currentBloom           = THREE.MathUtils.lerp(this.currentBloom,           target.bloomStrength,   k)
    this.currentStreetLight     = THREE.MathUtils.lerp(this.currentStreetLight,     target.streetLightIntensity, k)
    this.currentWindowEmissive  = THREE.MathUtils.lerp(this.currentWindowEmissive,  target.windowEmissiveIntensity, k)

    this.apply()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  getStreetLights(): THREE.PointLight[] {
    return this.refs.streetLightPoints
  }

  getCurrentBloom(): number {
    return this.currentBloom
  }

  applyWeatherOverride(
    sunMul: number,
    ambMul: number,
    ambTint: THREE.Color,
    fogNearOff: number,
    fogFarOff: number,
    skyTint: THREE.Color,
  ): void {
    this.weatherSunMul = sunMul
    this.weatherAmbMul = ambMul
    this.weatherAmbTint.copy(ambTint)
    this.weatherFogNearOff = fogNearOff
    this.weatherFogFarOff = fogFarOff
    this.weatherSkyTint.copy(skyTint)
    this.apply()
  }

  applyFlashOverride(sunMultiplier: number): void {
    this.flashActive = true
    this.flashSunOverride = sunMultiplier
    this.flashAmbOverride = sunMultiplier * 0.6
    this.apply()
  }

  clearFlashOverride(): void {
    this.flashActive = false
    this.flashSunOverride = 0
    this.flashAmbOverride = 0
    this.apply()
  }

  private samplePreset(hour: number): LightingPreset {
    let h = hour
    if (h < 5) h += 24

    let lower = PRESETS[0]
    let upper = PRESETS[1]
    for (let i = 0; i < PRESETS.length - 1; i++) {
      if (h >= PRESETS[i].hour && h < PRESETS[i + 1].hour) {
        lower = PRESETS[i]
        upper = PRESETS[i + 1]
        break
      }
    }

    const range = upper.hour - lower.hour
    const t = range > 0 ? (h - lower.hour) / range : 0
    const st = smoothstep(t)

    return {
      sunColor: new THREE.Color().copy(lower.preset.sunColor).lerp(upper.preset.sunColor, st),
      sunIntensity: mix(lower.preset.sunIntensity, upper.preset.sunIntensity, st),
      sunAngleDeg: mix(lower.preset.sunAngleDeg, upper.preset.sunAngleDeg, st),
      ambientColor: new THREE.Color().copy(lower.preset.ambientColor).lerp(upper.preset.ambientColor, st),
      ambientIntensity: mix(lower.preset.ambientIntensity, upper.preset.ambientIntensity, st),
      hemiSkyColor: new THREE.Color().copy(lower.preset.hemiSkyColor).lerp(upper.preset.hemiSkyColor, st),
      hemiGroundColor: new THREE.Color().copy(lower.preset.hemiGroundColor).lerp(upper.preset.hemiGroundColor, st),
      hemiIntensity: mix(lower.preset.hemiIntensity, upper.preset.hemiIntensity, st),
      skyColor: new THREE.Color().copy(lower.preset.skyColor).lerp(upper.preset.skyColor, st),
      fogNear: mix(lower.preset.fogNear, upper.preset.fogNear, st),
      fogFar: mix(lower.preset.fogFar, upper.preset.fogFar, st),
      bloomStrength: mix(lower.preset.bloomStrength, upper.preset.bloomStrength, st),
      streetLightIntensity: mix(lower.preset.streetLightIntensity, upper.preset.streetLightIntensity, st),
      windowEmissiveIntensity: mix(lower.preset.windowEmissiveIntensity, upper.preset.windowEmissiveIntensity, st),
    }
  }

  private apply(): void {
    const { directional, ambient, hemisphere, streetLightPoints, windowLights } = this.refs

    directional.color.copy(this.currentSunColor)
    directional.intensity = this.flashActive
      ? this.flashSunOverride
      : this.currentSunIntensity * this.weatherSunMul
    const sunPos = getSunPosition(this.currentSunAngle)
    directional.position.copy(sunPos)

    ambient.color.copy(this.currentAmbientColor).multiply(this.weatherAmbTint)
    ambient.intensity = this.flashActive
      ? this.flashAmbOverride
      : this.currentAmbientIntensity * this.weatherAmbMul

    hemisphere.color.copy(this.currentHemiSkyColor)
    hemisphere.groundColor.copy(this.currentHemiGroundColor)
    hemisphere.intensity = this.currentHemiIntensity

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.currentSkyColor).multiply(this.weatherSkyTint)
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.currentSkyColor).multiply(this.weatherSkyTint)
      this.scene.fog.near = this.currentFogNear + this.weatherFogNearOff
      this.scene.fog.far = this.currentFogFar + this.weatherFogFarOff
    }

    for (const pl of streetLightPoints) {
      pl.intensity = this.currentStreetLight
    }

    for (const pl of windowLights) {
      pl.intensity = this.currentWindowEmissive
    }

    if (this.postProcess) {
      this.postProcess.setBloomStrength(this.currentBloom)
    }
  }
}

function getSunPosition(angleDeg: number): THREE.Vector3 {
  const rad = (angleDeg * Math.PI) / 180
  const sunDistance = 30
  const height = Math.sin(rad) * sunDistance
  const horizontal = Math.cos(rad) * sunDistance
  return new THREE.Vector3(horizontal, Math.max(height, 1), -10)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
