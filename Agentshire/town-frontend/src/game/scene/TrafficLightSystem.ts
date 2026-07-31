import * as THREE from 'three'

export type TrafficSignal = 'red' | 'yellow' | 'green'

export interface TrafficBulbMaterials {
  red: THREE.MeshLambertMaterial
  yellow: THREE.MeshLambertMaterial
  green: THREE.MeshLambertMaterial
}

export interface TrafficLightRefs {
  ns: TrafficBulbMaterials
  ew: TrafficBulbMaterials
}

const CYCLE_S = 40
const NS_GREEN_END = 18
const NS_YELLOW_END = 21
const EW_GREEN_END = 37
const EW_YELLOW_END = 40
const BULB_ON = 1.4
const BULB_OFF = 0.08

/**
 * Drives the shared traffic-light bulb materials on a fixed 40s cycle:
 *  - 0..18s:  N–S green, E–W red
 *  - 18..21s: N–S yellow, E–W red
 *  - 21..37s: N–S red, E–W green
 *  - 37..40s: N–S red, E–W yellow
 *
 * The bulb materials are shared by every signal head of the same axis, so
 * toggling their emissiveIntensity lights all N–S / E–W heads together.
 */
export class TrafficLightSystem {
  private refs: TrafficLightRefs
  private elapsed = 0

  constructor(refs: TrafficLightRefs) {
    this.refs = refs
    this.apply()
  }

  update(delta: number): void {
    this.elapsed = (this.elapsed + delta) % CYCLE_S
    this.apply()
  }

  /**
   * Signal for a vehicle traveling along an axis.
   * 'z' = main N–S road, 'x' = E–W road.
   */
  getSignal(axis: 'x' | 'z'): TrafficSignal {
    const t = this.elapsed
    if (axis === 'z') {
      if (t < NS_GREEN_END) return 'green'
      if (t < NS_YELLOW_END) return 'yellow'
      return 'red'
    }
    if (t < NS_YELLOW_END) return 'red'
    if (t < EW_GREEN_END) return 'green'
    if (t < EW_YELLOW_END) return 'yellow'
    return 'red'
  }

  private apply(): void {
    this.applyBulbs(this.refs.ns, this.getSignal('z'))
    this.applyBulbs(this.refs.ew, this.getSignal('x'))
  }

  private applyBulbs(bulbs: TrafficBulbMaterials, signal: TrafficSignal): void {
    bulbs.red.emissiveIntensity = signal === 'red' ? BULB_ON : BULB_OFF
    bulbs.yellow.emissiveIntensity = signal === 'yellow' ? BULB_ON : BULB_OFF
    bulbs.green.emissiveIntensity = signal === 'green' ? BULB_ON : BULB_OFF
  }
}
