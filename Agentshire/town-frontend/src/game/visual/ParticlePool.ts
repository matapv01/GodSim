// @desc GPU particle pool — shared across all VFX sub-modules.
import * as THREE from 'three'

export interface Particle {
  active: boolean
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
  size: number
  life: number
  maxLife: number
  emissive: number
}

export const MAX_PARTICLES = 512
export const TEMP_VEC = new THREE.Vector3()

export interface EmitConfig {
  velocity?: () => THREE.Vector3
  color?: () => THREE.Color
  size?: () => number
  life?: () => number
  emissive?: number
}

export class ParticlePool {
  private positions!: Float32Array
  private colors!: Float32Array
  private sizes!: Float32Array
  private particles: Particle[] = []
  private pointsMesh!: THREE.Points

  init(scene: THREE.Scene): void {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 4)
    this.sizes = new Float32Array(MAX_PARTICLES)

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        size: 0.1,
        life: 0,
        maxLife: 1,
        emissive: 0,
      })
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4))
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))

    const mat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.pointsMesh = new THREE.Points(geo, mat)
    this.pointsMesh.frustumCulled = false
    scene.add(this.pointsMesh)
  }

  allocParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p
    }
    return null
  }

  emitParticles(count: number, origin: THREE.Vector3, config: EmitConfig): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle()
      if (!p) break
      p.active = true
      p.position.copy(origin)
      p.velocity.copy(config.velocity?.() ?? new THREE.Vector3(0, 1, 0))
      p.color.copy(config.color?.() ?? new THREE.Color(1, 1, 1))
      p.size = config.size?.() ?? 0.1
      p.life = 0
      p.maxLife = config.life?.() ?? 1
      p.emissive = config.emissive ?? 1
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]
      if (p.active) {
        p.life += dt
        if (p.life >= p.maxLife) {
          p.active = false
        } else {
          p.position.addScaledVector(p.velocity, dt)
          p.velocity.y -= dt * 3
          const alpha = 1 - p.life / p.maxLife
          this.positions[i * 3] = p.position.x
          this.positions[i * 3 + 1] = p.position.y
          this.positions[i * 3 + 2] = p.position.z
          this.colors[i * 4] = p.color.r * p.emissive
          this.colors[i * 4 + 1] = p.color.g * p.emissive
          this.colors[i * 4 + 2] = p.color.b * p.emissive
          this.colors[i * 4 + 3] = alpha
          this.sizes[i] = p.size * (0.5 + alpha * 0.5)
          continue
        }
      }
      this.positions[i * 3] = 0
      this.positions[i * 3 + 1] = -1000
      this.positions[i * 3 + 2] = 0
      this.colors[i * 4 + 3] = 0
      this.sizes[i] = 0
    }

    const geo = this.pointsMesh.geometry
    ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(geo.attributes.color as THREE.BufferAttribute).needsUpdate = true
    ;(geo.attributes.size as THREE.BufferAttribute).needsUpdate = true
  }

  setScene(scene: THREE.Scene): void {
    if (this.pointsMesh.parent) this.pointsMesh.parent.remove(this.pointsMesh)
    scene.add(this.pointsMesh)
  }

  clear(): void {
    for (const p of this.particles) p.active = false
  }
}
