// @desc Shared effect registration / update loop used by all VFX sub-modules.
import * as THREE from 'three'

export interface ActiveEffect {
  id: number
  type: string
  target?: THREE.Object3D
  targetB?: THREE.Object3D
  elapsed: number
  duration: number
  params: Record<string, unknown>
  update: (dt: number, effect: ActiveEffect, registry: EffectRegistry) => boolean
}

export interface MeshEffect {
  mesh: THREE.Object3D
  update: (dt: number) => boolean
}

export class EffectRegistry {
  private scene!: THREE.Scene
  effects: ActiveEffect[] = []
  meshEffects: MeshEffect[] = []
  private nextEffectId = 0
  shakeIntensity = 0
  cameraRef: THREE.Camera | null = null

  setScene(scene: THREE.Scene): void {
    this.scene = scene
  }

  getScene(): THREE.Scene {
    return this.scene
  }

  setCamera(camera: THREE.Camera): void {
    this.cameraRef = camera
  }

  nextId(): number {
    return this.nextEffectId++
  }

  addEffect(effect: ActiveEffect): void {
    this.effects.push(effect)
  }

  addMeshEffect(meshEffect: MeshEffect): void {
    this.meshEffects.push(meshEffect)
  }

  addMeshToScene(mesh: THREE.Object3D): void {
    this.scene.add(mesh)
  }

  removeMeshFromScene(mesh: THREE.Object3D): void {
    this.scene.remove(mesh)
  }

  findEffect(id: number): ActiveEffect | undefined {
    return this.effects.find(e => e.id === id)
  }

  removeEffectsByFilter(predicate: (e: ActiveEffect) => boolean): void {
    this.effects = this.effects.filter(e => !predicate(e))
  }

  stopEffectById(id: number): void {
    const idx = this.effects.findIndex(e => e.id === id)
    if (idx >= 0) {
      const eff = this.effects[idx]
      const ring = eff.params.ring as THREE.Mesh | undefined
      if (ring) {
        this.scene.remove(ring)
        ;(eff.params.ringGeo as THREE.BufferGeometry)?.dispose()
        ;(eff.params.ringMat as THREE.Material)?.dispose()
      }
      this.effects.splice(idx, 1)
    }
  }

  update(dt: number): void {
    this.effects = this.effects.filter(e => e.update(dt, e, this))
    this.meshEffects = this.meshEffects.filter(e => e.update(dt))

    if (this.shakeIntensity > 0 && this.cameraRef) {
      this.cameraRef.position.x += (Math.random() - 0.5) * this.shakeIntensity
      this.cameraRef.position.y += (Math.random() - 0.5) * this.shakeIntensity
      this.shakeIntensity *= 0.9
      if (this.shakeIntensity < 0.005) this.shakeIntensity = 0
    }
  }

  clear(): void {
    for (const e of this.meshEffects) this.scene.remove(e.mesh)
    this.meshEffects = []
    for (const e of this.effects) {
      const ring = e.params.ring as THREE.Mesh | undefined
      if (ring) this.scene.remove(ring)
    }
    this.effects = []
  }
}
