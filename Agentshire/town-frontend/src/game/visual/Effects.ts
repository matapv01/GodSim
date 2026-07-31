import * as THREE from 'three'

export class Effects {
  private scene: THREE.Scene
  private particles: { mesh: THREE.Object3D; update: (dt: number) => boolean }[] = []
  
  constructor(scene: THREE.Scene) { this.scene = scene }
  
  summonRipple(position: THREE.Vector3): void {
    const geo = new THREE.RingGeometry(0.5, 0.7, 32)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(geo, mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(position)
    ring.position.y = 0.1
    this.scene.add(ring)
    
    let scale = 1
    this.particles.push({
      mesh: ring,
      update: (dt) => {
        scale += dt * 8
        ring.scale.set(scale, scale, 1)
        ;(ring.material as THREE.MeshBasicMaterial).opacity -= dt * 1.5
        if ((ring.material as THREE.MeshBasicMaterial).opacity <= 0) {
          this.scene.remove(ring)
          ring.geometry.dispose()
          ;(ring.material as THREE.MeshBasicMaterial).dispose()
          return false
        }
        return true
      }
    })
  }
  
  completionStars(position: THREE.Vector3): void {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.08, 6, 6)
      const mat = new THREE.MeshBasicMaterial({ color: 0x44ff44 })
      const star = new THREE.Mesh(geo, mat)
      star.position.copy(position)
      star.position.y += 1
      this.scene.add(star)
      
      const vx = (Math.random() - 0.5) * 3
      const vy = 2 + Math.random() * 3
      const vz = (Math.random() - 0.5) * 3
      let life = 0
      
      this.particles.push({
        mesh: star,
        update: (dt) => {
          life += dt
          star.position.x += vx * dt
          star.position.y += (vy - life * 5) * dt
          star.position.z += vz * dt
          star.scale.setScalar(Math.max(0, 1 - life))
          if (life > 1.2) {
            this.scene.remove(star)
            geo.dispose(); mat.dispose()
            return false
          }
          return true
        }
      })
    }
  }
  
  errorSparks(position: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06)
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4444 })
      const spark = new THREE.Mesh(geo, mat)
      spark.position.copy(position)
      spark.position.y += 1
      this.scene.add(spark)
      
      const angle = (i / 6) * Math.PI * 2
      const speed = 2 + Math.random() * 2
      const vx = Math.cos(angle) * speed
      const vz = Math.sin(angle) * speed
      let life = 0
      
      this.particles.push({
        mesh: spark,
        update: (dt) => {
          life += dt
          spark.position.x += vx * dt
          spark.position.y += (1 - life * 4) * dt
          spark.position.z += vz * dt
          spark.rotation.x += dt * 10
          spark.rotation.y += dt * 8
          if (life > 0.8) {
            this.scene.remove(spark)
            geo.dispose(); mat.dispose()
            return false
          }
          return true
        }
      })
    }
  }
  
  crashSmoke(position: THREE.Vector3): void {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x9aa0a6,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
    for (let i = 0; i < 10; i++) {
      const radius = 0.22 + Math.random() * 0.18
      const geo = new THREE.SphereGeometry(radius, 7, 7)
      const mat = smokeMat.clone()
      const puff = new THREE.Mesh(geo, mat)
      puff.position.set(
        position.x + (Math.random() - 0.5) * 0.5,
        0.4 + Math.random() * 0.35,
        position.z + (Math.random() - 0.5) * 0.5,
      )
      this.scene.add(puff)

      const vy = 0.7 + Math.random() * 0.8
      const vx = (Math.random() - 0.5) * 0.9
      const vz = (Math.random() - 0.5) * 0.9
      let life = 0
      const grow = 1.3 + Math.random() * 0.7

      this.particles.push({
        mesh: puff,
        update: (dt) => {
          life += dt
          puff.position.x += vx * dt
          puff.position.z += vz * dt
          puff.position.y += vy * dt
          puff.scale.setScalar(Math.max(0.1, 1 + life * grow))
          mat.opacity = Math.max(0, 0.75 - life * 0.28)
          if (life > 2.6 || mat.opacity <= 0) {
            this.scene.remove(puff)
            geo.dispose()
            mat.dispose()
            return false
          }
          return true
        },
      })
    }
    smokeMat.dispose()
  }

  bloodSplash(position: THREE.Vector3): void {
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xb3222a })
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.SphereGeometry(0.045, 5, 5)
      const mat = dropMat.clone()
      const drop = new THREE.Mesh(geo, mat)
      drop.position.set(position.x, 0.25 + Math.random() * 0.15, position.z)
      this.scene.add(drop)

      const angle = Math.random() * Math.PI * 2
      const speed = 1.3 + Math.random() * 2.1
      const vx = Math.cos(angle) * speed
      const vz = Math.sin(angle) * speed
      let life = 0

      this.particles.push({
        mesh: drop,
        update: (dt) => {
          life += dt
          drop.position.x += vx * dt
          drop.position.z += vz * dt
          drop.position.y = Math.max(0.03, drop.position.y - dt * 2.2)
          drop.scale.setScalar(Math.max(0.05, 1 - life * 0.55))
          if (life > 1.4) {
            this.scene.remove(drop)
            geo.dispose()
            mat.dispose()
            return false
          }
          return true
        },
      })
    }
    dropMat.dispose()

    const puddleGeo = new THREE.CircleGeometry(0.42, 20)
    const puddleMat = new THREE.MeshBasicMaterial({
      color: 0x7e151c,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const puddle = new THREE.Mesh(puddleGeo, puddleMat)
    puddle.rotation.x = -Math.PI / 2
    puddle.position.set(position.x, 0.035, position.z)
    this.scene.add(puddle)

    let life = 0
    this.particles.push({
      mesh: puddle,
      update: (dt) => {
        life += dt
        if (life < 0.6) puddle.scale.setScalar(0.4 + (life / 0.6) * 0.6)
        if (life > 4.5) puddleMat.opacity = Math.max(0, 0.55 - (life - 4.5) * 0.4)
        if (life > 6.5) {
          this.scene.remove(puddle)
          puddleGeo.dispose()
          puddleMat.dispose()
          return false
        }
        return true
      },
    })
  }

  goldenPillar(position: THREE.Vector3): void {
    const geo = new THREE.CylinderGeometry(0.3, 0.6, 5, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5 })
    const pillar = new THREE.Mesh(geo, mat)
    pillar.position.copy(position)
    pillar.position.y = 2.5
    this.scene.add(pillar)
    
    let life = 0
    this.particles.push({
      mesh: pillar,
      update: (dt) => {
        life += dt
        pillar.scale.y = 1 + Math.sin(life * 3) * 0.1
        mat.opacity = Math.max(0, 0.5 - life * 0.15)
        if (life > 3) {
          this.scene.remove(pillar)
          geo.dispose(); mat.dispose()
          return false
        }
        return true
      }
    })
    
    this.completionStars(position)
  }
  
  exclamation(target: THREE.Object3D): void {
    const group = new THREE.Group()
    const barGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08)
    const dotGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08)
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4444 })
    const bar = new THREE.Mesh(barGeo, mat)
    bar.position.y = 0.15
    const dot = new THREE.Mesh(dotGeo, mat.clone())
    dot.position.y = -0.1
    group.add(bar, dot)
    
    const pos = new THREE.Vector3()
    target.getWorldPosition(pos)
    group.position.set(pos.x, pos.y + 2.5, pos.z)
    this.scene.add(group)
    
    let life = 0
    this.particles.push({
      mesh: group,
      update: (dt) => {
        life += dt
        target.getWorldPosition(pos)
        group.position.set(pos.x, pos.y + 2.5 + Math.sin(life * 5) * 0.1, pos.z)
        if (life > 1.5) {
          this.scene.remove(group)
          barGeo.dispose(); dotGeo.dispose(); mat.dispose()
          return false
        }
        return true
      }
    })
  }
  
  update(deltaTime: number): void {
    this.particles = this.particles.filter(p => p.update(deltaTime))
  }
  
  setScene(scene: THREE.Scene): void { this.scene = scene }
  
  clear(): void {
    for (const p of this.particles) this.scene.remove(p.mesh)
    this.particles = []
  }
}
