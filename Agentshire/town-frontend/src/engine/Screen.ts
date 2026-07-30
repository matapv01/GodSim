// ────────────────────────────────────────────────────────────
// Screen — Display management
//
// Safe area, fullscreen, orientation lock, wake lock.
// ────────────────────────────────────────────────────────────

export type ScreenOrientation =
  | 'portrait-primary' | 'portrait-secondary'
  | 'landscape-primary' | 'landscape-secondary'
  | 'any'

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ScreenState {
  orientation: ScreenOrientation
  isFullscreen: boolean
  safeArea: SafeAreaInsets
  width: number
  height: number
  devicePixelRatio: number
}

export interface ScreenCallbacks {
  onOrientationChange?: (orientation: ScreenOrientation) => void
  onFullscreenChange?: (isFullscreen: boolean) => void
  onResize?: (width: number, height: number) => void
}

export class Screen {
  private callbacks: ScreenCallbacks = {}
  private boundOrientationHandler: (() => void) | null = null
  private boundFullscreenHandler: (() => void) | null = null
  private boundResizeHandler: (() => void) | null = null
  private _lastError: string | null = null
  private _canLockOrientation = false
  private _canFullscreen = false
  private _canWakeLock = false
  private wakeLockSentinel: WakeLockSentinel | null = null

  get canLockOrientation(): boolean { return this._canLockOrientation }
  get canFullscreen(): boolean { return this._canFullscreen }
  get canWakeLock(): boolean { return this._canWakeLock }
  get lastError(): string | null { return this._lastError }

  get state(): ScreenState {
    return {
      orientation: this.getOrientation(),
      isFullscreen: this.isFullscreen(),
      safeArea: this.getSafeArea(),
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    }
  }

  get orientation(): ScreenOrientation { return this.getOrientation() }
  get fullscreen(): boolean { return this.isFullscreen() }
  get safeArea(): SafeAreaInsets { return this.getSafeArea() }

  constructor() {
    this._canLockOrientation = !!(screen.orientation && 'lock' in screen.orientation)
    this._canFullscreen = !!(
      document.documentElement.requestFullscreen ||
      (document.documentElement as any).webkitRequestFullscreen
    )
    this._canWakeLock = 'wakeLock' in navigator
  }

  init(callbacks?: ScreenCallbacks): void {
    if (callbacks) this.callbacks = callbacks

    this.boundOrientationHandler = this.handleOrientationChange.bind(this)
    if (screen.orientation) {
      screen.orientation.addEventListener('change', this.boundOrientationHandler)
    } else {
      window.addEventListener('orientationchange', this.boundOrientationHandler)
    }

    this.boundFullscreenHandler = this.handleFullscreenChange.bind(this)
    document.addEventListener('fullscreenchange', this.boundFullscreenHandler)
    document.addEventListener('webkitfullscreenchange', this.boundFullscreenHandler)

    this.boundResizeHandler = this.handleResize.bind(this)
    window.addEventListener('resize', this.boundResizeHandler)
  }

  async lockOrientation(orientation: ScreenOrientation): Promise<boolean> {
    if (!this._canLockOrientation) {
      this._lastError = 'orientation lock not supported'
      return false
    }
    try {
      await (screen.orientation as any).lock(orientation)
      return true
    } catch {
      this._lastError = 'failed to lock orientation'
      return false
    }
  }

  unlockOrientation(): void {
    if (this._canLockOrientation) screen.orientation.unlock()
  }

  async requestFullscreen(element?: HTMLElement): Promise<boolean> {
    if (!this._canFullscreen) {
      this._lastError = 'fullscreen not supported'
      return false
    }
    const target = element || document.documentElement
    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen()
      } else if ((target as any).webkitRequestFullscreen) {
        await (target as any).webkitRequestFullscreen()
      }
      return true
    } catch {
      this._lastError = 'failed to enter fullscreen'
      return false
    }
  }

  async exitFullscreen(): Promise<boolean> {
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen()
      return true
    } catch {
      this._lastError = 'failed to exit fullscreen'
      return false
    }
  }

  async toggleFullscreen(element?: HTMLElement): Promise<boolean> {
    return this.isFullscreen() ? this.exitFullscreen() : this.requestFullscreen(element)
  }

  async requestWakeLock(): Promise<boolean> {
    if (!this._canWakeLock) {
      this._lastError = 'wake lock not supported'
      return false
    }
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen')
      this.wakeLockSentinel.addEventListener('release', () => { this.wakeLockSentinel = null })
      return true
    } catch {
      this._lastError = 'failed to request wake lock'
      return false
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      await this.wakeLockSentinel.release()
      this.wakeLockSentinel = null
    }
  }

  hasWakeLock(): boolean { return this.wakeLockSentinel !== null }

  private getOrientation(): ScreenOrientation {
    if (screen.orientation) return screen.orientation.type as ScreenOrientation
    return window.innerWidth > window.innerHeight ? 'landscape-primary' : 'portrait-primary'
  }

  private isFullscreen(): boolean {
    return !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
  }

  private getSafeArea(): SafeAreaInsets {
    const style = getComputedStyle(document.documentElement)
    return {
      top: parseInt(style.getPropertyValue('--sat') || '0'),
      right: parseInt(style.getPropertyValue('--sar') || '0'),
      bottom: parseInt(style.getPropertyValue('--sab') || '0'),
      left: parseInt(style.getPropertyValue('--sal') || '0'),
    }
  }

  private handleOrientationChange(): void {
    this.callbacks.onOrientationChange?.(this.getOrientation())
  }

  private handleFullscreenChange(): void {
    this.callbacks.onFullscreenChange?.(this.isFullscreen())
  }

  private handleResize(): void {
    this.callbacks.onResize?.(window.innerWidth, window.innerHeight)
  }

  destroy(): void {
    if (this.boundOrientationHandler) {
      if (screen.orientation) screen.orientation.removeEventListener('change', this.boundOrientationHandler)
      else window.removeEventListener('orientationchange', this.boundOrientationHandler)
    }
    if (this.boundFullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.boundFullscreenHandler)
      document.removeEventListener('webkitfullscreenchange', this.boundFullscreenHandler)
    }
    if (this.boundResizeHandler) window.removeEventListener('resize', this.boundResizeHandler)
    this.releaseWakeLock()
    this.callbacks = {}
    this._lastError = null
  }
}
