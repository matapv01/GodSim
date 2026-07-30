// @desc Debug visualization effects: route path overlay with markers.
import * as THREE from 'three'
import type { EffectRegistry } from './EffectRegistry'

export class DebugEffects {
  constructor(private registry: EffectRegistry) {}

  routeDebugPath(
    points: Array<{ x: number; y?: number; z: number }>,
    colorHex = 0x33e0ff,
    ttlMs = 5000,
  ): void {
    if (!points || points.length < 2) return
    const scene = this.registry.getScene()

    const linePoints = points.map((p) => new THREE.Vector3(p.x, p.y ?? 0.06, p.z))
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
    const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 })
    const line = new THREE.Line(lineGeo, lineMat)
    scene.add(line)

    const markerGroup = new THREE.Group()
    const markerGeo = new THREE.SphereGeometry(0.08, 10, 10)
    const markerMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 })
    for (const p of linePoints) {
      const m = new THREE.Mesh(markerGeo, markerMat)
      m.position.copy(p)
      markerGroup.add(m)
    }
    scene.add(markerGroup)

    const ttlSec = Math.max(0.6, ttlMs / 1000)
    let life = 0
    this.registry.addMeshEffect({
      mesh: markerGroup,
      update: (dt) => {
        life += dt
        const fade = Math.max(0, 1 - life / ttlSec)
        lineMat.opacity = 0.8 * fade
        markerMat.opacity = 0.9 * fade
        if (life >= ttlSec) {
          scene.remove(line)
          scene.remove(markerGroup)
          lineGeo.dispose()
          lineMat.dispose()
          markerGeo.dispose()
          markerMat.dispose()
          return false
        }
        return true
      },
    })
  }
}
