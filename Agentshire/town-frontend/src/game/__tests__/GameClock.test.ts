import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameClock } from '../GameClock'

describe('GameClock', () => {
  let clock: GameClock

  beforeEach(() => {
    clock = new GameClock({ startHour: 6, dayDurationRealMs: 300_000, nightSpeedMultiplier: 1.8 })
  })

  // ── F0.1: 时间流逝 ──

  it('time advances on update', () => {
    const before = clock.getState().hour
    clock.update(1)
    const after = clock.getGameHour()
    expect(after).toBeGreaterThan(before)
  })

  it('dayCount starts at 0', () => {
    expect(clock.getState().dayCount).toBe(0)
  })

  // ── F0.2: 6 时段按序切换 ──

  it('returns correct periods for all 6 time ranges', () => {
    const cases: Array<[number, string]> = [
      [5.5, 'dawn'], [8, 'morning'], [13, 'noon'],
      [15, 'afternoon'], [18, 'dusk'], [22, 'night'], [3, 'night'],
    ]
    for (const [hour, expected] of cases) {
      clock.setTime(hour)
      expect(clock.getPeriod()).toBe(expected)
    }
  })

  // ── F0.3: 夜间加速 ──

  it('night period advances faster due to nightSpeedMultiplier', () => {
    const dayDuration = 300_000
    const nightMult = 1.8
    clock.setTime(10) // morning
    const baseBefore = clock.getGameHour()
    clock.update(1)
    const dayAdvance = clock.getGameHour() - baseBefore

    const nightClock = new GameClock({ startHour: 22, dayDurationRealMs: dayDuration, nightSpeedMultiplier: nightMult })
    const nightBefore = nightClock.getGameHour()
    nightClock.update(1)
    const nightAdvance = nightClock.getGameHour() - nightBefore

    expect(nightAdvance / dayAdvance).toBeCloseTo(nightMult, 1)
  })

  // ── F0.4: 暂停/恢复 ──

  it('pause stops time advancement', () => {
    clock.pause()
    const before = clock.getGameHour()
    clock.update(10)
    expect(clock.getGameHour()).toBe(before)
    expect(clock.isPaused()).toBe(true)
  })

  it('resume resumes time advancement', () => {
    clock.pause()
    clock.resume()
    const before = clock.getGameHour()
    clock.update(1)
    expect(clock.getGameHour()).toBeGreaterThan(before)
    expect(clock.isPaused()).toBe(false)
  })

  // ── F0.5: 日计数 ──

  it('dayCount increments after a full cycle', () => {
    clock.setTime(23.9)
    expect(clock.getState().dayCount).toBe(0)
    clock.update(10) // force past midnight
    expect(clock.getState().dayCount).toBeGreaterThanOrEqual(1)
  })

  // ── setTime / advanceTime ──

  it('setTime jumps to specified hour', () => {
    clock.setTime(14)
    expect(clock.getState().hour).toBe(14)
    expect(clock.getPeriod()).toBe('afternoon')
  })

  it('advanceTime moves forward by given hours', () => {
    clock.setTime(10)
    clock.advanceTime(5)
    expect(clock.getState().hour).toBe(15)
  })

  it('advanceTime wraps around midnight and increments dayCount', () => {
    clock.setTime(23)
    clock.advanceTime(3)
    expect(clock.getState().hour).toBe(2)
    expect(clock.getState().dayCount).toBe(1)
  })

  // ── setSpeed ──

  it('setSpeed changes day duration', () => {
    clock.setSpeed(60_000) // 1-minute day
    const before = clock.getGameHour()
    clock.update(1)
    const after = clock.getGameHour()
    const advance = after - before

    const normalClock = new GameClock({ startHour: 6, dayDurationRealMs: 300_000 })
    normalClock.update(1)
    const normalAdvance = normalClock.getGameHour() - 6

    expect(advance).toBeGreaterThan(normalAdvance * 4)
  })

  // ── getFormattedTime ──

  it('getFormattedTime returns HH:MM format', () => {
    clock.setTime(9.5) // 9:30
    const formatted = clock.getFormattedTime()
    expect(formatted).toMatch(/^\d{2}:\d{2}$/)
    expect(formatted).toBe('09:30')
  })

  // ── getNormalizedTime ──

  it('getNormalizedTime returns 0-1 range', () => {
    clock.setTime(0)
    expect(clock.getNormalizedTime()).toBeCloseTo(0, 2)
    clock.setTime(12)
    expect(clock.getNormalizedTime()).toBeCloseTo(0.5, 2)
  })

  // ── isNight ──

  it('isNight is true between 19-5', () => {
    clock.setTime(22)
    expect(clock.isNight()).toBe(true)
    clock.setTime(3)
    expect(clock.isNight()).toBe(true)
    clock.setTime(12)
    expect(clock.isNight()).toBe(false)
  })

  // ── Period change callbacks ──

  it('fires onPeriodChange callback when period changes', () => {
    const cb = vi.fn()
    clock.onPeriodChange('test', cb)
    clock.setTime(6.9) // dawn -> about to become morning

    const baseSpeed = (24 * 3600) / (300_000 / 1000)
    const dtToMorning = (7 * 3600 - 6.9 * 3600) / baseSpeed + 0.1
    clock.update(dtToMorning)

    expect(cb).toHaveBeenCalled()
    expect(cb.mock.calls[0][0].period).toBe('morning')
  })

  it('offPeriodChange removes the listener', () => {
    const cb = vi.fn()
    clock.onPeriodChange('test', cb)
    clock.offPeriodChange('test')
    clock.setTime(6.9)
    const baseSpeed = (24 * 3600) / (300_000 / 1000)
    clock.update((7 * 3600 - 6.9 * 3600) / baseSpeed + 0.5)
    expect(cb).not.toHaveBeenCalled()
  })

  // ── getState consistency ──

  it('getState returns consistent data', () => {
    clock.setTime(13.5) // 1:30 PM
    const state = clock.getState()
    expect(state.hour).toBe(13)
    expect(state.minute).toBe(30)
    expect(state.period).toBe('noon')
    expect(state.isNight).toBe(false)
    expect(state.normalizedTime).toBeCloseTo(13.5 / 24, 2)
  })
})
