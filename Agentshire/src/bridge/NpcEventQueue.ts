// @desc Event queue that protects dialog bubbles from being overridden by rapid phase changes
import type { GameEvent } from '../../town-frontend/src/data/GameProtocol.js'

/** Calculate how long a dialog bubble should stay visible based on text length */
export function calcDialogDuration(textLength: number): number {
  return Math.min(8000, Math.max(1500, textLength * 120))
}

/** Queue that serializes dialog and phase events per NPC, ensuring dialogs display long enough before phase changes take effect */
export class NpcEventQueue {
  private pendingPhase: Array<{ events: GameEvent[] }> = []
  private dialogProtected = false
  private dialogTimer: ReturnType<typeof setTimeout> | null = null
  private dialogTextLength = 0
  private emitFn: (events: GameEvent[]) => void

  constructor(emitFn: (events: GameEvent[]) => void) {
    this.emitFn = emitFn
  }

  /** Emit dialog events immediately and protect the bubble for a duration proportional to text length */
  enqueueDialog(events: GameEvent[], textLength: number): void {
    this.emitFn(events)

    this.dialogTextLength += textLength
    this.dialogProtected = true

    if (this.dialogTimer) clearTimeout(this.dialogTimer)
    const duration = calcDialogDuration(this.dialogTextLength)
    this.dialogTimer = setTimeout(() => {
      this.dialogProtected = false
      this.dialogTimer = null
      this.dialogTextLength = 0
      this.drainPending()
    }, duration)
  }

  /** Emit phase events immediately if no dialog is protected, otherwise buffer until dialog expires */
  enqueuePhase(events: GameEvent[]): void {
    if (this.dialogProtected) {
      this.pendingPhase.push({ events })
    } else {
      this.emitFn(events)
    }
  }

  /** Cancel any active dialog protection and drain all pending phase events */
  flush(): void {
    if (this.dialogTimer) { clearTimeout(this.dialogTimer); this.dialogTimer = null }
    this.dialogProtected = false
    this.dialogTextLength = 0
    this.drainPending()
  }

  private drainPending(): void {
    const pending = this.pendingPhase.splice(0)
    for (const p of pending) {
      this.emitFn(p.events)
    }
  }
}
