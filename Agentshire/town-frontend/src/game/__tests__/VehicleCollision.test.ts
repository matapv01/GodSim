import { describe, expect, it } from 'vitest'
import { distancePointToSegmentSquared } from '../scene/VehicleManager'

describe('vehicle collision sweep', () => {
  it('detects a pedestrian crossed by a fast vehicle between frames', () => {
    const distanceSq = distancePointToSegmentSquared(
      { x: 5, z: 0.4 },
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    )

    expect(distanceSq).toBeCloseTo(0.16)
  })

  it('does not report a pedestrian far from the driven segment', () => {
    const distanceSq = distancePointToSegmentSquared(
      { x: 5, z: 4 },
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    )

    expect(distanceSq).toBe(16)
  })

  it('clamps collision distance to the route segment endpoints', () => {
    const distanceSq = distancePointToSegmentSquared(
      { x: 12, z: 0 },
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    )

    expect(distanceSq).toBe(4)
  })
})
