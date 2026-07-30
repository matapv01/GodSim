import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CollisionWorld,
  type CollisionActor,
  type CollisionObstacle,
} from '../physics/CollisionWorld'

function actor(id: string, scene: THREE.Scene, x: number, z: number): CollisionActor {
  const mesh = new THREE.Group()
  mesh.position.set(x, 0, z)
  scene.add(mesh)
  return {
    id,
    mesh,
    collisionRadius: 0.45,
    isInActiveScene: true,
  }
}

function setup(obstacles: CollisionObstacle[] = []) {
  const scene = new THREE.Scene()
  const world = new CollisionWorld()
  const actors: CollisionActor[] = []
  world.registerScene(scene, obstacles)
  world.setActorsProvider(() => actors)
  return { scene, world, actors }
}

describe('CollisionWorld', () => {
  it('uses swept movement so an actor cannot tunnel through a solid object', () => {
    const { scene, world, actors } = setup([{
      type: 'box',
      id: 'building',
      minX: 4,
      maxX: 6,
      minZ: -2,
      maxZ: 2,
    }])
    const npc = actor('npc', scene, 0, 0)
    actors.push(npc)

    const next = world.moveActor(npc, npc.mesh.position, { x: 10, z: 0 })

    expect(next.x).toBeLessThanOrEqual(3.56)
    expect(next.z).toBeCloseTo(0)
  })

  it('slides along an obstacle instead of cancelling all diagonal movement', () => {
    const { scene, world, actors } = setup([{
      type: 'box',
      id: 'wall',
      minX: 2,
      maxX: 3,
      minZ: -10,
      maxZ: 10,
    }])
    const npc = actor('npc', scene, 0, 0)
    actors.push(npc)

    const next = world.moveActor(npc, npc.mesh.position, { x: 5, z: 2 })

    expect(next.x).toBeLessThanOrEqual(1.56)
    expect(next.z).toBeGreaterThan(1.5)
  })

  it('projects destinations out of props so movement promises can still arrive', () => {
    const { scene, world, actors } = setup([{
      type: 'circle',
      id: 'fountain',
      x: 5,
      z: 0,
      radius: 1.5,
    }])
    const npc = actor('npc', scene, 0, 0)
    actors.push(npc)

    const target = world.projectTarget(npc, { x: 5, z: 0 })

    expect(target.x).toBeLessThan(3.1)
    expect(target.z).toBeCloseTo(0)
  })

  it('plans waypoints around blocking buildings instead of walking into them', () => {
    const { scene, world, actors } = setup([{
      type: 'box',
      id: 'shop',
      minX: 3,
      maxX: 7,
      minZ: -2,
      maxZ: 2,
    }])
    const npc = actor('npc', scene, 0, 0)
    actors.push(npc)

    const path = world.planPath(npc, { x: 10, z: 0 })

    expect(path.length).toBeGreaterThan(1)
    expect(path[path.length - 1].x).toBeCloseTo(10)
    expect(path.some(point => Math.abs(point.z) > 2.45)).toBe(true)
  })

  it('prevents one person from walking through another person', () => {
    const { scene, world, actors } = setup()
    const moving = actor('moving', scene, 0, 0)
    const standing = actor('standing', scene, 2, 0)
    actors.push(moving, standing)

    const next = world.moveActor(moving, moving.mesh.position, { x: 5, z: 0 })

    expect(next.x).toBeLessThanOrEqual(1.11)
  })

  it('separates actors that spawn or teleport into an overlapping position', () => {
    const { scene, world, actors } = setup()
    const a = actor('a', scene, 1, 1)
    const b = actor('b', scene, 1, 1)
    actors.push(a, b)

    world.resolveOverlaps(actors, scene)

    expect(a.mesh.position.distanceTo(b.mesh.position)).toBeGreaterThanOrEqual(0.9)
  })
})
