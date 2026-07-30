export interface Command {
  execute(): void
  undo(): void
  description?: string
}

const MAX_STACK = 50

export class UndoStack {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private onChange?: () => void

  constructor(onChange?: () => void) {
    this.onChange = onChange
  }

  push(cmd: Command): void {
    cmd.execute()
    this.undoStack.push(cmd)
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift()
    this.redoStack.length = 0
    this.onChange?.()
  }

  undo(): void {
    const cmd = this.undoStack.pop()
    if (!cmd) return
    cmd.undo()
    this.redoStack.push(cmd)
    this.onChange?.()
  }

  redo(): void {
    const cmd = this.redoStack.pop()
    if (!cmd) return
    cmd.execute()
    this.undoStack.push(cmd)
    this.onChange?.()
  }

  get canUndo(): boolean { return this.undoStack.length > 0 }
  get canRedo(): boolean { return this.redoStack.length > 0 }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
    this.onChange?.()
  }
}
