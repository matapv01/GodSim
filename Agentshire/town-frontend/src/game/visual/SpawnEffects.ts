// @desc Spawn-related VFX: summon shockwave, persona transform, error lightning, exclamation, completion firework.
import * as THREE from 'three'
import type { ParticlePool } from './ParticlePool'
import type { EffectRegistry } from './EffectRegistry'
import type { Effects } from './Effects'

export class SpawnEffects {
  constructor(
    private pool: ParticlePool,
    private registry: EffectRegistry,
    private fallback: Effects,
  ) {}

  summonShockwave(position: THREE.Vector3): void {
    this.fallback.summonRipple(position)

    const scene = this.registry.getScene()
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.4, 6, 8)
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6 })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.copy(position)
    pillar.position.y = 3
    scene.add(pillar)

    let life = 0
    this.registry.addMeshEffect({
      mesh: pillar,
      update: (dt) => {
        life += dt
        pillar.scale.y = 1 + Math.sin(life * 4) * 0.15
        pillarMat.opacity = Math.max(0, 0.6 - life * 0.25)
        if (life > 2.5) {
          scene.remove(pillar)
          pillarGeo.dispose(); pillarMat.dispose()
          return false
        }
        return true
      },
    })

    this.pool.emitParticles(30, position.clone().add(new THREE.Vector3(0, 0.5, 0)), {
      velocity: () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 3
        return new THREE.Vector3(Math.cos(angle) * speed, 2 + Math.random() * 3, Math.sin(angle) * speed)
      },
      color: () => new THREE.Color().setHSL(0.12 + Math.random() * 0.08, 1, 0.6 + Math.random() * 0.3),
      size: () => 0.08 + Math.random() * 0.06,
      life: () => 0.8 + Math.random() * 0.6,
      emissive: 3,
    })
  }

  completionFirework(position: THREE.Vector3): void {
    this.pool.emitParticles(3, position.clone().add(new THREE.Vector3(0, 1, 0)), {
      velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.5, 6 + Math.random() * 2, (Math.random() - 0.5) * 0.5),
      color: () => new THREE.Color(1, 0.9, 0.5),
      size: () => 0.12,
      life: () => 0.6,
      emissive: 4,
    })

    setTimeout(() => {
      const burstPos = position.clone().add(new THREE.Vector3(0, 5, 0))
      const hue = Math.random()
      this.pool.emitParticles(40, burstPos, {
        velocity: () => {
          const theta = Math.random() * Math.PI * 2
          const phi = Math.random() * Math.PI
          const speed = 2 + Math.random() * 4
          return new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed - 1,
            Math.cos(phi) * speed,
          )
        },
        color: () => new THREE.Color().setHSL(hue + (Math.random() - 0.5) * 0.15, 1, 0.6),
        size: () => 0.06 + Math.random() * 0.06,
        life: () => 1.0 + Math.random() * 0.8,
        emissive: 3,
      })
    }, 500)
  }

  errorLightning(position: THREE.Vector3): void {
    this.fallback.errorSparks(position)
    const scene = this.registry.getScene()

    this.pool.emitParticles(15, position.clone().add(new THREE.Vector3(0, 1, 0)), {
      velocity: () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 1.5 + Math.random() * 2
        return new THREE.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 2, Math.sin(angle) * speed)
      },
      color: () => new THREE.Color().setHSL(0, 0.9, 0.5 + Math.random() * 0.3),
      size: () => 0.05 + Math.random() * 0.05,
      life: () => 0.5 + Math.random() * 0.4,
      emissive: 2,
    })

    const points: THREE.Vector3[] = []
    let cur = position.clone(); cur.y += 2.5
    for (let i = 0; i < 6; i++) {
      points.push(cur.clone())
      cur = cur.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.4, (Math.random() - 0.5) * 0.8))
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 1 })
    const line = new THREE.Line(lineGeo, lineMat)
    scene.add(line)

    let life = 0
    this.registry.addMeshEffect({
      mesh: line,
      update: (dt) => {
        life += dt
        lineMat.opacity = Math.max(0, 1 - life * 3)
        if (life > 0.4) {
          scene.remove(line)
          lineGeo.dispose(); lineMat.dispose()
          return false
        }
        return true
      },
    })

    this.registry.shakeIntensity = Math.max(this.registry.shakeIntensity, 0.15)
  }

  personaTransform(target: THREE.Object3D): void {
    const pos = new THREE.Vector3()
    target.getWorldPosition(pos)
    const scene = this.registry.getScene()

    const TOTAL_DURATION = 4.2

    const circleGeo = new THREE.RingGeometry(0.6, 0.75, 48)
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0xaa66ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    })
    const circle = new THREE.Mesh(circleGeo, circleMat)
    circle.rotation.x = -Math.PI / 2
    circle.position.set(pos.x, 0.05, pos.z)
    scene.add(circle)

    const innerGeo = new THREE.RingGeometry(0.25, 0.35, 6)
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xddaaff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    })
    const innerCircle = new THREE.Mesh(innerGeo, innerMat)
    innerCircle.rotation.x = -Math.PI / 2
    innerCircle.position.set(pos.x, 0.06, pos.z)
    scene.add(innerCircle)

    const cocoonGeo = new THREE.CylinderGeometry(0.55, 0.45, 2.8, 24, 1, true)
    const cocoonMat = new THREE.MeshBasicMaterial({
      color: 0xcc88ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    })
    const cocoon = new THREE.Mesh(cocoonGeo, cocoonMat)
    cocoon.position.set(pos.x, 1.4, pos.z)
    cocoon.visible = false
    scene.add(cocoon)

    const burstGeo = new THREE.RingGeometry(0.1, 0.3, 32)
    const burstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    })
    const burstRing = new THREE.Mesh(burstGeo, burstMat)
    burstRing.rotation.x = -Math.PI / 2
    burstRing.position.set(pos.x, 1.0, pos.z)
    burstRing.visible = false
    scene.add(burstRing)

    const savedRotY = target.rotation.y
    let life = 0
    let spiralTimer = 0
    let burstEmitted = false

    const meshGroup = new THREE.Group()
    meshGroup.add(circle)

    this.registry.addMeshEffect({
      mesh: meshGroup,
      update: (dt) => {
        life += dt
        spiralTimer += dt
        target.getWorldPosition(pos)

        if (life < 1.5) {
          const t1 = life / 1.5
          circleMat.opacity = Math.min(t1 * 1.5, 0.7)
          innerMat.opacity = Math.min(t1 * 1.5, 0.5)
          circle.position.set(pos.x, 0.05, pos.z)
          circle.rotation.z += dt * 2
          innerCircle.position.set(pos.x, 0.06, pos.z)
          innerCircle.rotation.z -= dt * 3.5

          target.rotation.y += dt * (2 + t1 * 6)

          if (spiralTimer > 0.06) {
            spiralTimer = 0
            const angle = life * 8 + Math.random() * 0.5
            const radius = 1.8 * (1 - t1 * 0.5)
            const origin = pos.clone().add(
              new THREE.Vector3(Math.cos(angle) * radius, 0.2 + Math.random() * 2, Math.sin(angle) * radius),
            )
            this.pool.emitParticles(2, origin, {
              velocity: () => {
                const toCenter = pos.clone().sub(origin).normalize().multiplyScalar(2 + Math.random())
                toCenter.y = 0.5 + Math.random() * 0.5
                return toCenter
              },
              color: () => new THREE.Color().setHSL(0.72 + Math.random() * 0.12, 0.85, 0.55 + Math.random() * 0.2),
              size: () => 0.05 + Math.random() * 0.04,
              life: () => 0.6 + Math.random() * 0.4,
              emissive: 2.5,
            })
          }
        }

        if (life >= 1.5 && life < 2.8) {
          const t2 = (life - 1.5) / 1.3
          cocoon.visible = true
          cocoon.position.set(pos.x, 1.4, pos.z)
          cocoon.rotation.y += dt * 10
          cocoonMat.opacity = t2 < 0.3 ? t2 / 0.3 * 0.7 : 0.7
          cocoonMat.color.setHSL(0.75 + Math.sin(life * 12) * 0.05, 0.8, 0.5 + t2 * 0.2)
          cocoon.scale.set(1 + Math.sin(life * 15) * 0.08, 1, 1 + Math.sin(life * 15) * 0.08)

          circleMat.opacity = 0.7 + 0.3 * Math.sin(life * 10)
          circle.position.set(pos.x, 0.05, pos.z)
          circle.rotation.z += dt * 5
          innerCircle.position.set(pos.x, 0.06, pos.z)
          innerCircle.rotation.z -= dt * 8

          target.rotation.y += dt * 14

          if (spiralTimer > 0.04) {
            spiralTimer = 0
            const a = Math.random() * Math.PI * 2
            this.pool.emitParticles(1, pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.5, Math.random() * 2.5, Math.sin(a) * 0.5)), {
              velocity: () => new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.5 + Math.random(), (Math.random() - 0.5) * 0.3),
              color: () => new THREE.Color().setHSL(0.78 + Math.random() * 0.08, 1, 0.7),
              size: () => 0.06,
              life: () => 0.5 + Math.random() * 0.3,
              emissive: 3,
            })
          }
        }

        if (life >= 2.8) {
          if (!burstEmitted) {
            burstEmitted = true
            burstRing.visible = true
            cocoonMat.opacity = 0
            cocoon.visible = false

            this.pool.emitParticles(50, pos.clone().add(new THREE.Vector3(0, 1.2, 0)), {
              velocity: () => {
                const theta = Math.random() * Math.PI * 2
                const phi = Math.acos(2 * Math.random() - 1)
                const speed = 3 + Math.random() * 4
                return new THREE.Vector3(
                  Math.sin(phi) * Math.cos(theta) * speed,
                  Math.sin(phi) * Math.sin(theta) * speed,
                  Math.cos(phi) * speed,
                )
              },
              color: () => {
                const hues = [0.72, 0.78, 0.85, 0.12, 0.55]
                return new THREE.Color().setHSL(hues[Math.floor(Math.random() * hues.length)], 1, 0.6 + Math.random() * 0.3)
              },
              size: () => 0.07 + Math.random() * 0.06,
              life: () => 0.8 + Math.random() * 0.6,
              emissive: 4,
            })

            this.registry.shakeIntensity = Math.max(this.registry.shakeIntensity, 0.12)

            target.rotation.y = savedRotY
          }

          const t3 = (life - 2.8) / (TOTAL_DURATION - 2.8)
          burstRing.position.set(pos.x, 1.0, pos.z)
          const bScale = 1 + t3 * 8
          burstRing.scale.set(bScale, bScale, bScale)
          burstMat.opacity = Math.max(0, 0.9 - t3 * 1.2)

          circleMat.opacity = Math.max(0, 0.5 * (1 - t3))
          innerMat.opacity = Math.max(0, 0.3 * (1 - t3))
        }

        if (life > TOTAL_DURATION) {
          scene.remove(circle)
          scene.remove(innerCircle)
          scene.remove(cocoon)
          scene.remove(burstRing)
          circleGeo.dispose(); circleMat.dispose()
          innerGeo.dispose(); innerMat.dispose()
          cocoonGeo.dispose(); cocoonMat.dispose()
          burstGeo.dispose(); burstMat.dispose()
          return false
        }
        return true
      },
    })
  }
}
