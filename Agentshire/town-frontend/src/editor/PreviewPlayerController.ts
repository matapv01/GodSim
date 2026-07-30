import * as THREE from 'three'

export interface PreviewPlayerTarget {
  mesh: THREE.Group
  moveTo(target: { x: number; z: number }, speed?: number): Promise<'arrived' | 'interrupted'>
  playAnim(name: string): void
  update(dt: number): void
}

export class PreviewPlayerController {
  private target: PreviewPlayerTarget | null = null
  private keys = { w: false, a: false, s: false, d: false }
  private moveDir = new THREE.Vector3()
  private _isWalking = false
  private speed = 3
  private container: HTMLElement
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private camera: THREE.PerspectiveCamera | null = null
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private clickMoving = false

  get isWalking(): boolean { return this._isWalking }

  constructor(container: HTMLElement) {
    this.container = container
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    this.onClick = this.onClick.bind(this)
  }

  setTarget(target: PreviewPlayerTarget): void {
    this.target = target
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('click', this.onClick)
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('click', this.onClick)
    this.keys = { w: false, a: false, s: false, d: false }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') this.keys.w = true
    if (k === 'a' || k === 'arrowleft') this.keys.a = true
    if (k === 's' || k === 'arrowdown') this.keys.s = true
    if (k === 'd' || k === 'arrowright') this.keys.d = true
    if (k in this.keys || ['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
      this.clickMoving = false
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') this.keys.w = false
    if (k === 'a' || k === 'arrowleft') this.keys.a = false
    if (k === 's' || k === 'arrowdown') this.keys.s = false
    if (k === 'd' || k === 'arrowright') this.keys.d = false
  }

  private onClick(e: MouseEvent): void {
    if (!this.camera || !this.target) return
    const rect = this.container.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hit = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      this.clickMoving = true
      this.target.moveTo({ x: hit.x, z: hit.z }, this.speed)
    }
  }

  update(dt: number): void {
    if (!this.target) return

    this.moveDir.set(0, 0, 0)
    if (this.keys.w) this.moveDir.z -= 1
    if (this.keys.s) this.moveDir.z += 1
    if (this.keys.a) this.moveDir.x -= 1
    if (this.keys.d) this.moveDir.x += 1

    const hasKeyInput = this.moveDir.lengthSq() > 0

    if (hasKeyInput) {
      this.moveDir.normalize()
      const pos = this.target.mesh.position
      pos.x += this.moveDir.x * this.speed * dt
      pos.z += this.moveDir.z * this.speed * dt

      if (this.moveDir.lengthSq() > 0) {
        const angle = Math.atan2(this.moveDir.x, this.moveDir.z)
        this.target.mesh.rotation.y = angle
      }
    }

    const wasWalking = this._isWalking
    this._isWalking = hasKeyInput

    if (this._isWalking && !wasWalking) {
      this.target.playAnim('walk')
    } else if (!this._isWalking && wasWalking && !this.clickMoving) {
      this.target.playAnim('idle')
    }
  }

  destroy(): void {
    this.stop()
    this.target = null
    this.camera = null
  }
}
