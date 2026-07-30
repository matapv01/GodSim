export class VirtualControls {
  private container: HTMLElement
  private joystickBase: HTMLElement
  private joystickKnob: HTMLElement
  private actionBtnE: HTMLElement
  private actionBtnCam: HTMLElement
  private activePointer: number | null = null
  private joystickCenter = { x: 0, y: 0 }
  private joystickRadius = 0
  private keys: Array<{ key: string; pressed: boolean }> = []
  private onKeyChange: (key: string, pressed: boolean) => void
  private onInteract: () => void
  private onCamera: () => void
  private animFrameId: number | null = null
  private destroyed = false

  constructor(opts: {
    onKeyChange: (key: string, pressed: boolean) => void
    onInteract: () => void
    onCamera: () => void
  }) {
    this.onKeyChange = opts.onKeyChange
    this.onInteract = opts.onInteract
    this.onCamera = opts.onCamera

    this.container = document.createElement('div')
    this.container.className = 'vc-overlay'
    this.container.innerHTML = `
      <div class="vc-joystick-base">
        <div class="vc-joystick-knob"></div>
      </div>
      <div class="vc-actions">
        <button class="vc-btn vc-btn-cam" type="button" aria-label="Camera">◎</button>
        <button class="vc-btn vc-btn-e" type="button" aria-label="Interact">E</button>
      </div>
    `
    document.body.appendChild(this.container)

    this.joystickBase = this.container.querySelector('.vc-joystick-base')!
    this.joystickKnob = this.container.querySelector('.vc-joystick-knob')!
    this.actionBtnE = this.container.querySelector('.vc-btn-e')!
    this.actionBtnCam = this.container.querySelector('.vc-btn-cam')!

    this.bindJoystick()
    this.bindButtons()
  }

  private bindJoystick(): void {
    this.joystickBase.addEventListener('pointerdown', (e) => {
      if (this.activePointer !== null) return
      this.activePointer = e.pointerId
      this.joystickBase.setPointerCapture(e.pointerId)
      const rect = this.joystickBase.getBoundingClientRect()
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      this.joystickRadius = rect.width / 2
      this.updateJoystick(e.clientX, e.clientY)
      this.startLoop()
    })

    this.joystickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer) return
      this.updateJoystick(e.clientX, e.clientY)
    })

    const endJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return
      this.activePointer = null
      this.joystickKnob.style.transform = 'translate(-50%, -50%)'
      this.clearKeys()
      this.stopLoop()
    }

    this.joystickBase.addEventListener('pointerup', endJoystick)
    this.joystickBase.addEventListener('pointercancel', endJoystick)

    const preventScroll = (e: TouchEvent) => { if (e.target && this.container.contains(e.target as Node)) e.preventDefault() }
    document.addEventListener('touchmove', preventScroll, { passive: false })
  }

  private bindButtons(): void {
    this.actionBtnE.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.onInteract()
    })
    this.actionBtnCam.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.onCamera()
    })
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickCenter.x
    const dy = clientY - this.joystickCenter.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = this.joystickRadius - 20
    const clamped = Math.min(dist, maxDist)
    const angle = Math.atan2(dy, dx)
    const nx = Math.cos(angle) * clamped
    const ny = Math.sin(angle) * clamped
    this.joystickKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`

    const deadzone = 12
    if (dist < deadzone) {
      this.clearKeys()
      return
    }
    const norm = dist / maxDist
    const threshold = 0.3
    this.setKey('w', ny < -deadzone && norm > threshold)
    this.setKey('s', ny > deadzone && norm > threshold)
    this.setKey('a', nx < -deadzone && norm > threshold)
    this.setKey('d', nx > deadzone && norm > threshold)
  }

  private setKey(key: string, pressed: boolean): void {
    const existing = this.keys.find(k => k.key === key)
    if (existing) {
      if (existing.pressed !== pressed) {
        existing.pressed = pressed
        this.onKeyChange(key, pressed)
      }
    } else {
      this.keys.push({ key, pressed })
      if (pressed) this.onKeyChange(key, true)
    }
  }

  private clearKeys(): void {
    for (const k of this.keys) {
      if (k.pressed) this.onKeyChange(k.key, false)
    }
    this.keys = []
  }

  private startLoop(): void {
    if (this.animFrameId !== null) return
    const loop = () => {
      if (this.destroyed) return
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stopLoop()
    this.clearKeys()
    this.container.remove()
  }
}
