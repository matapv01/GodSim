// @desc Celebration VFX: deploy fireworks, confetti, light pillar, skill learn ceremony.
import * as THREE from 'three'
import { TEMP_VEC, type ParticlePool } from './ParticlePool'
import type { EffectRegistry } from './EffectRegistry'
import { SpawnEffects } from './SpawnEffects'

export class CelebrationEffects {
  constructor(
    private pool: ParticlePool,
    private registry: EffectRegistry,
    private spawn: SpawnEffects,
  ) {}

  deployFireworks(position: THREE.Vector3): void {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          0,
          (Math.random() - 0.5) * 8,
        )
        this.spawn.completionFirework(position.clone().add(offset))
      }, i * 600 + Math.random() * 400)
    }
  }

  confetti(center: THREE.Vector3, count = 200, durationMs = 3000): void {
    const COLORS = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181]
    const ceiling = center.clone(); ceiling.y = 5
    const spreadX = 10, spreadZ = 10
    const batches = 10
    const perBatch = Math.ceil(count / batches)

    for (let b = 0; b < batches; b++) {
      setTimeout(() => {
        for (let i = 0; i < perBatch; i++) {
          const origin = ceiling.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * spreadX, Math.random() * 0.5, (Math.random() - 0.5) * spreadZ,
          ))
          this.pool.emitParticles(1, origin, {
            velocity: () => new THREE.Vector3(
              (Math.random() - 0.5) * 1.5, -1.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.5,
            ),
            color: () => new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]),
            size: () => 0.05 + Math.random() * 0.1,
            life: () => 3.0 + Math.random() * 2.0,
            emissive: 1.5,
          })
        }
      }, (b / batches) * durationMs)
    }
  }

  lightPillar(center: THREE.Vector3, durationMs = 1500): void {
    const scene = this.registry.getScene()
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 8, 16)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF, transparent: true, opacity: 0,
    })
    const pillar = new THREE.Mesh(geo, mat)
    pillar.position.set(center.x, 4, center.z)
    scene.add(pillar)

    let life = 0
    this.registry.addMeshEffect({
      mesh: pillar,
      update: (dt) => {
        life += dt
        const t = life / (durationMs / 1000)
        if (t < 0.2) {
          mat.opacity = (t / 0.2) * 0.4
        } else if (t < 0.7) {
          mat.opacity = 0.4
        } else if (t < 1) {
          mat.opacity = 0.4 * (1 - (t - 0.7) / 0.3)
        } else {
          mat.opacity = 0
          scene.remove(pillar)
          geo.dispose(); mat.dispose()
          return false
        }
        return true
      },
    })
  }

  skillLearnCeremony(target: THREE.Object3D): void {
    const pos = new THREE.Vector3()
    target.getWorldPosition(pos)
    const scene = this.registry.getScene()

    const SKY_Y = 8
    const ICON_SIZE = 0.9
    const LAND_Y = pos.y + 2.0

    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 128, 128)
    grad.addColorStop(0, '#ffd700'); grad.addColorStop(1, '#ff6b00')
    const cr = 24
    ctx.beginPath()
    ctx.moveTo(cr, 0); ctx.lineTo(128 - cr, 0)
    ctx.quadraticCurveTo(128, 0, 128, cr); ctx.lineTo(128, 128 - cr)
    ctx.quadraticCurveTo(128, 128, 128 - cr, 128); ctx.lineTo(cr, 128)
    ctx.quadraticCurveTo(0, 128, 0, 128 - cr); ctx.lineTo(0, cr)
    ctx.quadraticCurveTo(0, 0, cr, 0)
    ctx.fillStyle = grad; ctx.fill()
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 12
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 52px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✦', 64, 64)

    const tex = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 })
    const iconSprite = new THREE.Sprite(spriteMat)
    iconSprite.scale.set(ICON_SIZE, ICON_SIZE, 1)
    iconSprite.position.set(pos.x, SKY_Y, pos.z)
    scene.add(iconSprite)

    const ringColors = [0xffd700, 0xff6b00, 0x00d4ff]
    const rings: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }[] = []
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(0.5 + i * 0.25, 0.03, 8, 32)
      const mat = new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(iconSprite.position)
      mesh.rotation.x = Math.PI * 0.3 * (i - 1)
      scene.add(mesh)
      rings.push({ mesh, geo, mat })
    }

    const shockwaves: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial; born: number }[] = []

    let life = 0
    let impactDone = false
    let shockwavesDone = false

    this.registry.addMeshEffect({
      mesh: iconSprite,
      update: (dt) => {
        life += dt
        target.getWorldPosition(pos)

        if (life < 2.0) {
          const t = life / 2.0
          spriteMat.opacity = Math.min(t * 2, 1)
          const pulse = 1 + Math.sin(life * 8) * 0.12
          iconSprite.scale.set(ICON_SIZE * pulse, ICON_SIZE * pulse, 1)

          for (let i = 0; i < rings.length; i++) {
            const r = rings[i]
            r.mat.opacity = Math.min(t * 2, 0.7)
            r.mesh.position.copy(iconSprite.position)
            r.mesh.rotation.z += dt * (3 + i * 2)
            r.mesh.rotation.y += dt * (1 + i * 0.5)
          }

          if (Math.random() < dt * 18) {
            const angle = life * 5 + Math.random() * Math.PI
            const radius = 1.5 + Math.random() * 0.5
            const origin = iconSprite.position.clone().add(
              new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 1.5, Math.sin(angle) * radius)
            )
            this.pool.emitParticles(2, origin, {
              velocity: () => {
                const toCenter = iconSprite.position.clone().sub(origin).normalize().multiplyScalar(2.5 + Math.random())
                return toCenter
              },
              color: () => new THREE.Color().setHSL(0.08 + Math.random() * 0.12, 1, 0.6 + Math.random() * 0.3),
              size: () => 0.07 + Math.random() * 0.05,
              life: () => 0.4 + Math.random() * 0.3,
              emissive: 3.5,
            })
          }
        }

        if (life >= 2.0 && life < 3.5) {
          const t = (life - 2.0) / 1.5
          const ease = t * t * t
          const curY = SKY_Y + (LAND_Y - SKY_Y) * ease
          iconSprite.position.set(pos.x, curY, pos.z)

          const speedFactor = 1 + t * 8
          for (let i = 0; i < rings.length; i++) {
            const r = rings[i]
            r.mesh.position.copy(iconSprite.position)
            r.mesh.rotation.z += dt * speedFactor * (3 + i * 2)
            r.mesh.rotation.y += dt * speedFactor
            const shrink = 1 - t * 0.6
            r.mesh.scale.set(shrink, shrink, shrink)
            r.mat.opacity = Math.max(0, 0.7 * (1 - t * 0.8))
          }

          const trailCount = Math.floor(dt * 25 * (1 + t * 3))
          for (let i = 0; i < trailCount; i++) {
            this.pool.emitParticles(1, iconSprite.position.clone(), {
              velocity: () => new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                2 + Math.random() * 3,
                (Math.random() - 0.5) * 1.5,
              ),
              color: () => new THREE.Color().setHSL(
                [0.08, 0.12, 0.55, 0.0][Math.floor(Math.random() * 4)],
                1, 0.5 + Math.random() * 0.4,
              ),
              size: () => 0.06 + Math.random() * 0.05,
              life: () => 0.3 + Math.random() * 0.4,
              emissive: 3,
            })
          }
        }

        if (life >= 3.5 && !impactDone) {
          impactDone = true
          spriteMat.opacity = 0
          for (const r of rings) { r.mat.opacity = 0 }

          this.pool.emitParticles(60, pos.clone().add(new THREE.Vector3(0, 1.5, 0)), {
            velocity: () => {
              const theta = Math.random() * Math.PI * 2
              const phi = Math.acos(2 * Math.random() - 1)
              const speed = 4 + Math.random() * 6
              return new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.abs(Math.sin(phi) * Math.sin(theta)) * speed,
                Math.cos(phi) * speed,
              )
            },
            color: () => {
              const hues = [0.08, 0.12, 0.55, 0.72, 0.0]
              return new THREE.Color().setHSL(hues[Math.floor(Math.random() * hues.length)], 1, 0.55 + Math.random() * 0.35)
            },
            size: () => 0.08 + Math.random() * 0.07,
            life: () => 1.0 + Math.random() * 0.8,
            emissive: 4.5,
          })

          this.registry.shakeIntensity = Math.max(this.registry.shakeIntensity, 0.2)
        }

        if (life >= 3.5 && !shockwavesDone) {
          shockwavesDone = true
          for (let w = 0; w < 3; w++) {
            setTimeout(() => {
              const swGeo = new THREE.RingGeometry(0.1, 0.25, 32)
              const swMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
              const swMesh = new THREE.Mesh(swGeo, swMat)
              swMesh.rotation.x = -Math.PI / 2
              target.getWorldPosition(TEMP_VEC)
              swMesh.position.set(TEMP_VEC.x, TEMP_VEC.y + 0.5 + w * 0.4, TEMP_VEC.z)
              scene.add(swMesh)
              shockwaves.push({ mesh: swMesh, geo: swGeo, mat: swMat, born: life })
            }, w * 150)
          }
        }

        for (const sw of shockwaves) {
          const age = life - sw.born
          if (age < 0) continue
          const expand = 1 + age * 8
          sw.mesh.scale.set(expand, expand, 1)
          sw.mat.opacity = Math.max(0, 0.8 - age * 1.2)
          if (sw.mat.opacity <= 0 && sw.mesh.parent) {
            scene.remove(sw.mesh)
            sw.geo.dispose(); sw.mat.dispose()
          }
        }

        if (life >= 3.8 && life < 5.5) {
          if (Math.random() < dt * 20) {
            const a = Math.random() * Math.PI * 2
            const r = Math.random() * 0.4
            this.pool.emitParticles(1, pos.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.random() * 2.5, Math.sin(a) * r)), {
              velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.3, 3 + Math.random() * 2, (Math.random() - 0.5) * 0.3),
              color: () => new THREE.Color().setHSL(0.12 + Math.random() * 0.06, 1, 0.6 + Math.random() * 0.3),
              size: () => 0.05 + Math.random() * 0.04,
              life: () => 0.5 + Math.random() * 0.4,
              emissive: 3,
            })
          }
        }

        if (life > 8.0) {
          scene.remove(iconSprite)
          for (const r of rings) {
            scene.remove(r.mesh); r.geo.dispose(); r.mat.dispose()
          }
          for (const sw of shockwaves) {
            if (sw.mesh.parent) scene.remove(sw.mesh)
            sw.geo.dispose(); sw.mat.dispose()
          }
          tex.dispose(); spriteMat.dispose()
          return false
        }
        return true
      },
    })

    setTimeout(() => {
      target.getWorldPosition(pos)
      this.lightPillar(pos, 2000)
    }, 3800)
  }
}
