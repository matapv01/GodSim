import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModeManager } from '../workflow/ModeManager'

describe('ModeManager', () => {
  let mm: ModeManager

  beforeEach(() => {
    mm = new ModeManager()
  })

  // ── F3.1: 默认生活模式 ──

  it('defaults to life mode', () => {
    expect(mm.getMode()).toBe('life')
    expect(mm.isWorkMode()).toBe(false)
    expect(mm.getWorkSubState()).toBeNull()
    expect(mm.getSummonedNpcIds()).toEqual([])
  })

  // ── F3.2: 进入工作模式 ──

  it('enterWorkMode transitions to work/summoning', () => {
    mm.enterWorkMode('做贪吃蛇')
    expect(mm.getMode()).toBe('work')
    expect(mm.isWorkMode()).toBe(true)
    expect(mm.getWorkSubState()).toBe('summoning')
    expect(mm.getState().taskDescription).toBe('做贪吃蛇')
  })

  it('enterWorkMode is idempotent', () => {
    mm.enterWorkMode('任务A')
    mm.enterWorkMode('任务B')
    expect(mm.getState().taskDescription).toBe('任务A')
  })

  // ── 工作子状态推进 ──

  it('advances through valid work sub-states in order', () => {
    mm.enterWorkMode('test')
    const sequence: Array<import('../../types').WorkSubState> = [
      'assigning', 'going_to_office', 'working', 'publishing', 'celebrating', 'returning',
    ]
    for (const next of sequence) {
      mm.advanceWorkState(next)
      expect(mm.getWorkSubState()).toBe(next)
    }
  })

  it('rejects invalid state transition', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mm.enterWorkMode('test')
    mm.advanceWorkState('working') // invalid: summoning → working
    expect(mm.getWorkSubState()).toBe('summoning')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('advanceWorkState is no-op in life mode', () => {
    mm.advanceWorkState('summoning')
    expect(mm.getMode()).toBe('life')
  })

  // ── isWorkSubState helper ──

  it('isWorkSubState returns correct results', () => {
    expect(mm.isWorkSubState('summoning')).toBe(false)
    mm.enterWorkMode('test')
    expect(mm.isWorkSubState('summoning')).toBe(true)
    expect(mm.isWorkSubState('working')).toBe(false)
  })

  // ── 召唤 NPC 管理 ──

  it('setSummonedNpcs stores and retrieves NPC IDs', () => {
    mm.enterWorkMode('test')
    mm.setSummonedNpcs(['citizen_1', 'citizen_2'])
    expect(mm.getSummonedNpcIds()).toEqual(['citizen_1', 'citizen_2'])
    expect(mm.isSummoned('citizen_1')).toBe(true)
    expect(mm.isSummoned('citizen_3')).toBe(false)
  })

  it('setSummonedNpcs creates a defensive copy', () => {
    mm.enterWorkMode('test')
    const ids = ['citizen_1']
    mm.setSummonedNpcs(ids)
    ids.push('citizen_2')
    expect(mm.getSummonedNpcIds()).toEqual(['citizen_1'])
  })

  // ── F3.7: 返回生活模式 ──

  it('returnToLifeMode resets to life mode', () => {
    mm.enterWorkMode('test')
    mm.setSummonedNpcs(['citizen_1'])
    mm.advanceWorkState('assigning')
    mm.returnToLifeMode()
    expect(mm.getMode()).toBe('life')
    expect(mm.getWorkSubState()).toBeNull()
    expect(mm.getSummonedNpcIds()).toEqual([])
  })

  it('returnToLifeMode is idempotent', () => {
    mm.returnToLifeMode()
    expect(mm.getMode()).toBe('life')
  })

  // ── 观察者模式 ──

  it('notifies observers on mode change', () => {
    const cb = vi.fn()
    mm.onModeChange('test', cb)
    mm.enterWorkMode('test')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0].mode).toBe('work')
    expect(cb.mock.calls[0][0].workSubState).toBe('summoning')
  })

  it('notifies on every state advance', () => {
    const cb = vi.fn()
    mm.onModeChange('test', cb)
    mm.enterWorkMode('test')
    mm.advanceWorkState('assigning')
    mm.advanceWorkState('going_to_office')
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('offModeChange removes the listener', () => {
    const cb = vi.fn()
    mm.onModeChange('test', cb)
    mm.offModeChange('test')
    mm.enterWorkMode('test')
    expect(cb).not.toHaveBeenCalled()
  })

  it('observer errors are caught and do not break other observers', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const badCb = vi.fn(() => { throw new Error('boom') })
    const goodCb = vi.fn()
    mm.onModeChange('bad', badCb)
    mm.onModeChange('good', goodCb)
    mm.enterWorkMode('test')
    expect(badCb).toHaveBeenCalled()
    expect(goodCb).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('observer receives a snapshot (not a reference)', () => {
    const snapshots: any[] = []
    mm.onModeChange('test', (state) => { snapshots.push(state) })
    mm.enterWorkMode('test')
    mm.setSummonedNpcs(['citizen_1'])
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].summonedNpcIds).toEqual([])
    expect(snapshots[1].summonedNpcIds).toEqual(['citizen_1'])
    snapshots[1].summonedNpcIds.push('hacked')
    expect(mm.getSummonedNpcIds()).toEqual(['citizen_1'])
  })

  // ── destroy ──

  it('destroy clears all observers', () => {
    const cb = vi.fn()
    mm.onModeChange('test', cb)
    mm.destroy()
    mm.enterWorkMode('test')
    expect(cb).not.toHaveBeenCalled()
  })

  // ── 完整工作流循环 ──

  it('supports full work → life → work cycle', () => {
    mm.enterWorkMode('第一次')
    mm.setSummonedNpcs(['a', 'b'])
    mm.advanceWorkState('assigning')
    mm.advanceWorkState('going_to_office')
    mm.advanceWorkState('working')
    mm.advanceWorkState('publishing')
    mm.advanceWorkState('celebrating')
    mm.advanceWorkState('returning')
    mm.returnToLifeMode()

    expect(mm.getMode()).toBe('life')
    expect(mm.getSummonedNpcIds()).toEqual([])

    mm.enterWorkMode('第二次')
    expect(mm.getMode()).toBe('work')
    expect(mm.getWorkSubState()).toBe('summoning')
  })
})
