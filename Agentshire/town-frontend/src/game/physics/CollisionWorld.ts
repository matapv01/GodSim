import * as THREE from 'three'

export type CollisionObstacle =
  | {
    type: 'box'
    id: string
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
  | {
    type: 'circle'
    id: string
    x: number
    z: number
    radius: number
  }

export interface CollisionActor {
  id: string
  mesh: THREE.Object3D
  collisionRadius: number
  isInActiveScene: boolean
}

interface MoveOptions {
  allowDetour?: boolean
}

const SWEEP_STEP = 0.12
const COLLISION_EPSILON = 0.01

/**
 * Lightweight 2D collision/avoidance for the walkable XZ plane.
 *
 * The game does not use a rigid-body engine, so this class keeps movement
 * deterministic and inexpensive: swept circle tests prevent tunnelling,
 * axis fallback provides wall sliding, and NPC-only detour candidates keep
 * autonomous walkers from stopping forever behind an obstacle.
 */
export class CollisionWorld {
  private obstaclesByScene = new Map<THREE.Scene, CollisionObstacle[]>()
  private actorsProvider: () => CollisionActor[] = () => []

  setActorsProvider(provider: () => CollisionActor[]): void {
    this.actorsProvider = provider
  }

  registerScene(scene: THREE.Scene, obstacles: CollisionObstacle[]): void {
    this.obstaclesByScene.set(scene, obstacles)
  }

  projectTarget(actor: CollisionActor, target: { x: number; z: number }): { x: number; z: number } {
    const scene = actor.mesh.parent
    if (!(scene instanceof THREE.Scene)) return { ...target }

    const projected = new THREE.Vector2(target.x, target.z)
    const origin = new THREE.Vector2(actor.mesh.position.x, actor.mesh.position.z)
    const obstacles = this.obstaclesByScene.get(scene) ?? []

    // A few passes handle targets that sit inside overlapping obstacle margins.
    for (let pass = 0; pass < 4; pass++) {
      let changed = false
      for (const obstacle of obstacles) {
        changed = this.projectOutsideObstacle(projected, origin, actor.collisionRadius, obstacle) || changed
      }
      for (const other of this.getSceneActors(scene, actor.id)) {
        changed = this.projectOutsideCircle(
          projected,
          origin,
          other.mesh.position.x,
          other.mesh.position.z,
          actor.collisionRadius + other.collisionRadius,
        ) || changed
      }
      if (!changed) break
    }

    return { x: projected.x, z: projected.y }
  }

  moveActor(
    actor: CollisionActor,
    from: { x: number; z: number },
    desired: { x: number; z: number },
    options: MoveOptions = {},
  ): { x: number; z: number } {
    const scene = actor.mesh.parent
    if (!(scene instanceof THREE.Scene)) return { ...desired }

    const start = this.depenetratePoint(
      new THREE.Vector2(from.x, from.z),
      actor.collisionRadius,
      scene,
      actor.id,
    )
    const delta = new THREE.Vector2(desired.x - from.x, desired.z - from.z)
    if (delta.lengthSq() < 1e-10) return { x: start.x, z: start.y }

    const candidates = [delta]
    if (options.allowDetour) {
      const preferredSide = this.hashDirection(actor.id)
      for (const angle of [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
        candidates.push(this.rotate(delta, angle * preferredSide))
      }
    }

    const forward = delta.clone().normalize()
    let best = start.clone()
    let bestScore = -Infinity
    for (let i = 0; i < candidates.length; i++) {
      const end = this.sweepWithSlide(
        start,
        candidates[i],
        actor.collisionRadius,
        scene,
        actor.id,
      )
      const moved = end.clone().sub(start)
      // Forward progress matters most; travelled distance lets an NPC sidestep
      // when the direct candidate is fully blocked.
      const score = moved.dot(forward) * 4 + moved.length() - i * 1e-5
      if (score > bestScore) {
        bestScore = score
        best = end
      }
    }

    return { x: best.x, z: best.y }
  }

  resolveOverlaps(actors: CollisionActor[], activeScene: THREE.Scene): void {
    const active = actors.filter(actor =>
      actor.isInActiveScene
      && actor.mesh.parent === activeScene
      && actor.mesh.visible,
    )

    for (let pass = 0; pass < 3; pass++) {
      for (const actor of active) {
        const p = this.depenetrateStatic(
          new THREE.Vector2(actor.mesh.position.x, actor.mesh.position.z),
          actor.collisionRadius,
          activeScene,
        )
        actor.mesh.position.x = p.x
        actor.mesh.position.z = p.y
      }

      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          this.separatePair(active[i], active[j])
        }
      }
    }
  }

  private sweepWithSlide(
    start: THREE.Vector2,
    delta: THREE.Vector2,
    radius: number,
    scene: THREE.Scene,
    actorId: string,
  ): THREE.Vector2 {
    const distance = delta.length()
    const steps = Math.max(1, Math.ceil(distance / SWEEP_STEP))
    const step = delta.clone().multiplyScalar(1 / steps)
    const current = start.clone()

    for (let i = 0; i < steps; i++) {
      const combined = current.clone().add(step)
      if (!this.isBlocked(combined.x, combined.y, radius, scene, actorId)) {
        current.copy(combined)
        continue
      }

      let moved = false
      if (Math.abs(step.x) > 1e-8) {
        const alongX = new THREE.Vector2(current.x + step.x, current.y)
        if (!this.isBlocked(alongX.x, alongX.y, radius, scene, actorId)) {
          current.copy(alongX)
          moved = true
        }
      }
      if (Math.abs(step.y) > 1e-8) {
        const alongZ = new THREE.Vector2(current.x, current.y + step.y)
        if (!this.isBlocked(alongZ.x, alongZ.y, radius, scene, actorId)) {
          current.copy(alongZ)
          moved = true
        }
      }
      if (!moved) break
    }

    return current
  }

  private isBlocked(
    x: number,
    z: number,
    radius: number,
    scene: THREE.Scene,
    actorId: string,
  ): boolean {
    for (const obstacle of this.obstaclesByScene.get(scene) ?? []) {
      if (this.overlapsObstacle(x, z, radius, obstacle)) return true
    }
    for (const other of this.getSceneActors(scene, actorId)) {
      const dx = x - other.mesh.position.x
      const dz = z - other.mesh.position.z
      const minDistance = radius + other.collisionRadius
      if (dx * dx + dz * dz < minDistance * minDistance) return true
    }
    return false
  }

  private getSceneActors(scene: THREE.Scene, excludeId: string): CollisionActor[] {
    return this.actorsProvider().filter(actor =>
      actor.id !== excludeId
      && actor.mesh.parent === scene
      && actor.mesh.visible
      && actor.isInActiveScene,
    )
  }

  private overlapsObstacle(
    x: number,
    z: number,
    radius: number,
    obstacle: CollisionObstacle,
  ): boolean {
    if (obstacle.type === 'circle') {
      const dx = x - obstacle.x
      const dz = z - obstacle.z
      const minDistance = radius + obstacle.radius
      return dx * dx + dz * dz < minDistance * minDistance
    }

    const closestX = THREE.MathUtils.clamp(x, obstacle.minX, obstacle.maxX)
    const closestZ = THREE.MathUtils.clamp(z, obstacle.minZ, obstacle.maxZ)
    const dx = x - closestX
    const dz = z - closestZ
    return dx * dx + dz * dz < radius * radius
  }

  private depenetratePoint(
    point: THREE.Vector2,
    radius: number,
    scene: THREE.Scene,
    actorId: string,
  ): THREE.Vector2 {
    const result = this.depenetrateStatic(point, radius, scene)
    for (const other of this.getSceneActors(scene, actorId)) {
      this.pushOutsideCircle(
        result,
        other.mesh.position.x,
        other.mesh.position.z,
        radius + other.collisionRadius,
        actorId,
      )
    }
    return result
  }

  private depenetrateStatic(
    point: THREE.Vector2,
    radius: number,
    scene: THREE.Scene,
  ): THREE.Vector2 {
    const result = point.clone()
    for (let pass = 0; pass < 4; pass++) {
      let changed = false
      for (const obstacle of this.obstaclesByScene.get(scene) ?? []) {
        if (obstacle.type === 'circle') {
          changed = this.pushOutsideCircle(
            result,
            obstacle.x,
            obstacle.z,
            radius + obstacle.radius,
            obstacle.id,
          ) || changed
          continue
        }
        changed = this.pushOutsideBox(result, radius, obstacle) || changed
      }
      if (!changed) break
    }
    return result
  }

  private pushOutsideBox(
    point: THREE.Vector2,
    radius: number,
    obstacle: Extract<CollisionObstacle, { type: 'box' }>,
  ): boolean {
    const minX = obstacle.minX - radius
    const maxX = obstacle.maxX + radius
    const minZ = obstacle.minZ - radius
    const maxZ = obstacle.maxZ + radius
    if (point.x <= minX || point.x >= maxX || point.y <= minZ || point.y >= maxZ) return false

    const choices = [
      { distance: point.x - minX, axis: 'x' as const, value: minX - COLLISION_EPSILON },
      { distance: maxX - point.x, axis: 'x' as const, value: maxX + COLLISION_EPSILON },
      { distance: point.y - minZ, axis: 'z' as const, value: minZ - COLLISION_EPSILON },
      { distance: maxZ - point.y, axis: 'z' as const, value: maxZ + COLLISION_EPSILON },
    ].sort((a, b) => a.distance - b.distance)
    if (choices[0].axis === 'x') point.x = choices[0].value
    else point.y = choices[0].value
    return true
  }

  private pushOutsideCircle(
    point: THREE.Vector2,
    centerX: number,
    centerZ: number,
    minDistance: number,
    seed: string,
  ): boolean {
    const dx = point.x - centerX
    const dz = point.y - centerZ
    const distSq = dx * dx + dz * dz
    if (distSq >= minDistance * minDistance) return false

    if (distSq < 1e-10) {
      const angle = this.hashAngle(seed)
      point.set(
        centerX + Math.cos(angle) * (minDistance + COLLISION_EPSILON),
        centerZ + Math.sin(angle) * (minDistance + COLLISION_EPSILON),
      )
      return true
    }
    const scale = (minDistance + COLLISION_EPSILON) / Math.sqrt(distSq)
    point.set(centerX + dx * scale, centerZ + dz * scale)
    return true
  }

  private projectOutsideObstacle(
    point: THREE.Vector2,
    origin: THREE.Vector2,
    radius: number,
    obstacle: CollisionObstacle,
  ): boolean {
    if (obstacle.type === 'circle') {
      return this.projectOutsideCircle(
        point,
        origin,
        obstacle.x,
        obstacle.z,
        radius + obstacle.radius,
      )
    }

    const minX = obstacle.minX - radius
    const maxX = obstacle.maxX + radius
    const minZ = obstacle.minZ - radius
    const maxZ = obstacle.maxZ + radius
    if (point.x <= minX || point.x >= maxX || point.y <= minZ || point.y >= maxZ) return false

    const candidates = [
      new THREE.Vector2(minX - COLLISION_EPSILON, point.y),
      new THREE.Vector2(maxX + COLLISION_EPSILON, point.y),
      new THREE.Vector2(point.x, minZ - COLLISION_EPSILON),
      new THREE.Vector2(point.x, maxZ + COLLISION_EPSILON),
    ]
    candidates.sort((a, b) => a.distanceToSquared(origin) - b.distanceToSquared(origin))
    point.copy(candidates[0])
    return true
  }

  private projectOutsideCircle(
    point: THREE.Vector2,
    origin: THREE.Vector2,
    centerX: number,
    centerZ: number,
    minDistance: number,
  ): boolean {
    const dx = point.x - centerX
    const dz = point.y - centerZ
    if (dx * dx + dz * dz >= minDistance * minDistance) return false

    const fromCenter = origin.clone().sub(new THREE.Vector2(centerX, centerZ))
    if (fromCenter.lengthSq() < 1e-10) fromCenter.set(1, 0)
    fromCenter.setLength(minDistance + COLLISION_EPSILON)
    point.set(centerX + fromCenter.x, centerZ + fromCenter.y)
    return true
  }

  private separatePair(a: CollisionActor, b: CollisionActor): void {
    let dx = b.mesh.position.x - a.mesh.position.x
    let dz = b.mesh.position.z - a.mesh.position.z
    let distance = Math.sqrt(dx * dx + dz * dz)
    const minDistance = a.collisionRadius + b.collisionRadius
    if (distance >= minDistance) return

    if (distance < 1e-8) {
      const angle = this.hashAngle(`${a.id}:${b.id}`)
      dx = Math.cos(angle)
      dz = Math.sin(angle)
      distance = 1
    }
    const push = (minDistance - distance + COLLISION_EPSILON) / 2
    const nx = dx / distance
    const nz = dz / distance
    a.mesh.position.x -= nx * push
    a.mesh.position.z -= nz * push
    b.mesh.position.x += nx * push
    b.mesh.position.z += nz * push
  }

  private rotate(vector: THREE.Vector2, angle: number): THREE.Vector2 {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return new THREE.Vector2(
      vector.x * c - vector.y * s,
      vector.x * s + vector.y * c,
    )
  }

  private hashDirection(value: string): 1 | -1 {
    let hash = 0
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
    return (hash & 1) === 0 ? 1 : -1
  }

  private hashAngle(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
    return (Math.abs(hash) % 360) * Math.PI / 180
  }
}
