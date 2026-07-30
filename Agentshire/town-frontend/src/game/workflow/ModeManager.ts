import type { GlobalMode, WorkSubState, ModeState } from '../../types'

const VALID_TRANSITIONS: Record<WorkSubState, WorkSubState[]> = {
  summoning:       ['assigning'],
  assigning:       ['going_to_office'],
  going_to_office: ['working'],
  working:         ['publishing'],
  publishing:      ['celebrating'],
  celebrating:     ['returning'],
  returning:       [],
}

export class ModeManager {
  private state: ModeState = {
    mode: 'life',
    summonedNpcIds: [],
    startedAt: Date.now(),
  }

  private callbacks = new Map<string, (state: ModeState) => void>()

  getMode(): GlobalMode {
    return this.state.mode
  }

  getState(): Readonly<ModeState> {
    return this.state
  }

  getWorkSubState(): WorkSubState | null {
    return this.state.mode === 'work' ? this.state.workSubState ?? null : null
  }

  getSummonedNpcIds(): string[] {
    return this.state.summonedNpcIds
  }

  isSummoned(npcId: string): boolean {
    return this.state.summonedNpcIds.includes(npcId)
  }

  isWorkMode(): boolean {
    return this.state.mode === 'work'
  }

  isWorkSubState(sub: WorkSubState): boolean {
    return this.state.mode === 'work' && this.state.workSubState === sub
  }

  enterWorkMode(taskDescription: string, initialSubState?: WorkSubState): void {
    if (this.state.mode === 'work') return
    this.state = {
      mode: 'work',
      workSubState: initialSubState ?? 'summoning',
      taskDescription,
      summonedNpcIds: [],
      startedAt: Date.now(),
    }
    this.notify()
  }

  setSummonedNpcs(npcIds: string[]): void {
    this.state.summonedNpcIds = [...npcIds]
    this.notify()
  }

  advanceWorkState(next: WorkSubState): void {
    if (this.state.mode !== 'work') return
    const current = this.state.workSubState
    if (current && !VALID_TRANSITIONS[current]?.includes(next)) {
      console.warn(`[ModeManager] invalid transition: ${current} → ${next}`)
      return
    }
    this.state.workSubState = next
    this.notify()
  }

  forceWorkSubState(sub: WorkSubState): void {
    if (this.state.mode !== 'work') return
    this.state.workSubState = sub
    this.notify()
  }

  returnToLifeMode(): void {
    if (this.state.mode === 'life') return
    this.state = {
      mode: 'life',
      summonedNpcIds: [],
      startedAt: Date.now(),
    }
    this.notify()
  }

  onModeChange(id: string, cb: (state: ModeState) => void): void {
    this.callbacks.set(id, cb)
  }

  offModeChange(id: string): void {
    this.callbacks.delete(id)
  }

  private notify(): void {
    const snapshot = { ...this.state, summonedNpcIds: [...this.state.summonedNpcIds] }
    for (const cb of this.callbacks.values()) {
      try { cb(snapshot) } catch (e) { console.error('[ModeManager] callback error:', e) }
    }
  }

  destroy(): void {
    this.callbacks.clear()
  }
}
