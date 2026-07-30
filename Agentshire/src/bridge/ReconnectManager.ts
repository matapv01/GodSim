// @desc Exponential backoff reconnection manager for WebSocket connections
export type ReconnectCallback = () => void

/** Schedules reconnection attempts with exponential backoff, resettable on success */
export class ReconnectManager {
  private attempt = 0
  private maxDelay = 30_000
  private timer: ReturnType<typeof setTimeout> | null = null
  private onReconnect: ReconnectCallback

  constructor(onReconnect: ReconnectCallback) {
    this.onReconnect = onReconnect
  }

  /** Schedule the next reconnection attempt with exponential backoff */
  scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.attempt), this.maxDelay)
    this.attempt++
    console.log(`[ReconnectManager] Reconnecting in ${delay}ms (attempt ${this.attempt})`)
    this.timer = setTimeout(() => {
      this.onReconnect()
    }, delay)
  }

  /** Reset attempt counter and cancel any pending reconnect timer */
  onSuccess(): void {
    this.attempt = 0
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** Stop all reconnection attempts and reset state */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.attempt = 0
  }
}
