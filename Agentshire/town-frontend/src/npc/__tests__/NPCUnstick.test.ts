import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { NPC } from '../NPC'
import {
  CollisionWorld,
  type CollisionActor,
  type CollisionObstacle,
} from '../../game/physics/CollisionWorld'

const DT = 1 / 60

function makeNpc(scene: THREE.Scene, x: number, z: number): NPC {
  const npc = new NPC({
    id: 'npc_test',
    name: 'Tester',
    color: 0x3366cc,
    role: 'worker',
    spawn: { x, y: 0, z },
  })
  scene.add(npc.mesh)
  return npc
}

function makeBlocker(scene: THREE.Scene, x: number, z: number): CollisionActor {
  const mesh = new THREE.Group()
  mesh.position.set(x, 0, z)
  scene.add(mesh)
  return { id: 'blocker', mesh, collisionRadius: 0.45, isInActiveScene: true }
}

function wireAdapter(npc: NPC, world: CollisionWorld): void {
  npc.setNavigationAdapter({
    projectTarget: target => world.projectTarget(npc, target),
    planPath: target => world.planPath(npc, target),
    resolveMovement: (from, desired) =>
      world.moveActor(npc, from, desired, { allowDetour: true }),
  })
}

function simulate(npc: NPC, seconds: number): { positions: THREE.Vector3[] } {
  const positions: THREE.Vector3[] = []
  const frames = Math.ceil(seconds / DT)
  for (let i = 0; i < frames; i++) {
    npc.update(DT)
    positions.push(npc.mesh.position.clone())
  }
  return { positions }
}

describe('NPC unstick', () => {
  it('paces instead of staying glued when a person blocks a passable lane', () => {
    const scene = new THREE.Scene()
    const obstacles: CollisionObstacle[] = [
      { type: 'box', id: 'wallL', minX: -1.5, maxX: -0.9, minZ: -1, maxZ: 6 },
      { type: 'box', id: 'wallR', minX: 0.9, maxX: 1.5, minZ: -1, maxZ: 6 },
    ]
    const world = new CollisionWorld()
    world.registerScene(scene, obstacles)
    const actors: CollisionActor[] = []
    world.setActorsProvider(() => actors)

    const npc = makeNpc(scene, 0, 0)
    const blocker = makeBlocker(scene, 0, 1)
    actors.push(npc as unknown as CollisionActor, blocker)
    wireAdapter(npc, world)

    void npc.moveTo({ x: 0, z: 5 })
    const { positions } = simulate(npc, 8)

    let longestStationary = 0
    let currentStationary = 0
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].distanceTo(positions[i - 1]) < 0.005) {
        currentStationary += DT
        longestStationary = Math.max(longestStationary, currentStationary)
      } else {
        currentStationary = 0
      }
    }

    expect(longestStationary).toBeLessThan(2)
  })

  it('retreats out of a narrow lane it cannot pass through', () => {
    const scene = new THREE.Scene()
    const obstacles: CollisionObstacle[] = [
      { type: 'box', id: 'wallL', minX: -1.5, maxX: -0.6, minZ: -0.5, maxZ: 6 },
      { type: 'box', id: 'wallR', minX: 0.6, maxX: 1.5, minZ: -0.5, maxZ: 6 },
    ]
    const world = new CollisionWorld()
    world.registerScene(scene, obstacles)
    const actors: CollisionActor[] = []
    world.setActorsProvider(() => actors)

    const npc = makeNpc(scene, 0, 0)
    const blocker = makeBlocker(scene, 0, 1)
    actors.push(npc as unknown as CollisionActor, blocker)
    wireAdapter(npc, world)

    void npc.moveTo({ x: 0, z: 5 })
    const { positions } = simulate(npc, 8)

    const minZ = Math.min(...positions.map(p => p.z))
    expect(minZ).toBeLessThan(-0.3)
  })

  it('still arrives at the goal in open space despite a standing blocker', () => {
    const scene = new THREE.Scene()
    const world = new CollisionWorld()
    world.registerScene(scene, [])
    const actors: CollisionActor[] = []
    world.setActorsProvider(() => actors)

    const npc = makeNpc(scene, 0, 0)
    const blocker = makeBlocker(scene, 2.3, 0)
    actors.push(npc as unknown as CollisionActor, blocker)
    wireAdapter(npc, world)

    void npc.moveTo({ x: 5, z: 0 })
    const { positions } = simulate(npc, 8)

    const final = positions[positions.length - 1]
    expect(Math.hypot(final.x - 5, final.z)).toBeLessThan(1.2)
  })
})
