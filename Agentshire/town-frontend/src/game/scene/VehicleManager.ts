import * as THREE from 'three'
import { AssetLoader } from '../visual/AssetLoader'
import { GameClock } from '../GameClock'
import { t } from '../../i18n'
import type { CollisionActor } from '../physics/CollisionWorld'

const CAR_MODELS = ['car_sedan', 'car_hatchback', 'car_taxi'] as const

const ROAD_Y = 0.06
const LANE_OFFSET = 0.32

interface RoadPoint { x: number; z: number }
interface VehicleRoute {
  id: string
  ownerNpcId: string
  owner: string
  appearance: string
  modelKey: typeof CAR_MODELS[number]
  homeParking: RoadPoint
  travelHours: [number, number]
  automatic: boolean
  from: string
  to: string
  purpose: string
  points: RoadPoint[]
}

export interface VehiclePedestrian {
  id: string
  x: number
  z: number
}

export interface VehicleIncident {
  vehicle: THREE.Object3D
  vehicleId: string
  victimNpcId: string
  driverName: string
  ownerName: string
  position: RoadPoint
  speed: number
}

export interface VehicleCrash {
  vehicleAId: string
  vehicleBId: string
  vehicleA: THREE.Object3D
  vehicleB: THREE.Object3D
  position: RoadPoint
  playerInvolved: boolean
}

export interface TrafficStopInfo {
  offenderOwnerName: string
  offenderOwnerNpcId: string
  offenderVehicleId: string
  offenderVehicle: THREE.Object3D
  patrolVehicle: THREE.Object3D
  position: RoadPoint
}

interface VehicleCallbacks {
  canBoard?: (npcId: string, position: RoadPoint) => boolean
  onBoard?: (npcId: string) => void
  onLeave?: (npcId: string, position: RoadPoint) => void
  onMove?: (npcIds: string[], position: RoadPoint) => void
  resolveVehicleMove?: (
    vehicleId: string,
    vehicle: THREE.Object3D,
    from: RoadPoint,
    desired: RoadPoint,
  ) => RoadPoint
  getPedestrians?: () => VehiclePedestrian[]
  onPedestrianHit?: (incident: VehicleIncident) => boolean
  onVehicleCrash?: (crash: VehicleCrash) => void
  onTrafficStop?: (info: TrafficStopInfo) => void
}

export const TRAFFIC_INCIDENT_DURATION_MS = 18_000
const VEHICLE_HIT_RADIUS = 1.05
const VEHICLE_COLLISION_RADIUS = 0.95
const VICTIM_HIT_COOLDOWN_MS = 60_000
const VEHICLE_CRASH_DISTANCE = 2.0
const VEHICLE_CRASH_DURATION_S = 4
const VEHICLE_CRASH_COOLDOWN_MS = 30_000
const WRONG_LANE_PROBABILITY = 0.16
const TRAFFIC_STOP_DISTANCE = 5.5
const TRAFFIC_STOP_DURATION_S = 9
const TRAFFIC_STOP_COOLDOWN_MS = 40_000
const TRAFFIC_STOP_GAP_MS = 35_000
const PATROL_ROUTE_ID = 'khoi_patrol'

const VEHICLE_ROUTES: VehicleRoute[] = [
  {
    id: 'user_sedan',
    ownerNpcId: 'user',
    owner: 'Người chơi',
    appearance: 'sedan riêng',
    modelKey: 'car_sedan',
    homeParking: { x: 6.15, z: 30.2 },
    travelHours: [0, 24],
    automatic: false,
    from: 'Nhà người chơi',
    to: 'Quảng trường',
    purpose: 'đi lại trong thị trấn',
    points: [{ x: 7.6, z: 30.5 }, { x: 16, z: 30.5 }, { x: 16, z: 26.75 }, { x: 24, z: 26.75 }],
  },
  {
    id: 'minh_sedan',
    ownerNpcId: 'citizen_1',
    owner: 'Minh',
    appearance: 'sedan',
    modelKey: 'car_sedan',
    homeParking: { x: 4.65, z: 8.25 },
    travelHours: [6, 9],
    automatic: true,
    from: 'Nhà Minh',
    to: 'Công ty chính',
    purpose: 'đi làm',
    points: [{ x: 6.0, z: 7.5 }, { x: 16, z: 7.5 }, { x: 16, z: 10.5 }, { x: 24.4, z: 10.5 }, { x: 24.4, z: 13.0 }],
  },
  {
    id: 'lan_hatchback',
    ownerNpcId: 'citizen_2',
    owner: 'Lan',
    appearance: 'hatchback nhỏ',
    modelKey: 'car_hatchback',
    homeParking: { x: 4.65, z: 13.75 },
    travelHours: [8, 11],
    automatic: true,
    from: 'Nhà Lan',
    to: 'Khu chợ',
    purpose: 'mua đồ',
    points: [{ x: 6.0, z: 13.0 }, { x: 16, z: 13.0 }, { x: 16, z: 18.0 }, { x: 38.8, z: 18.0 }, { x: 38.8, z: 10.5 }],
  },
  {
    id: 'vy_city_car',
    ownerNpcId: 'citizen_6',
    owner: 'Vy',
    appearance: 'xe đô thị',
    modelKey: 'car_taxi',
    homeParking: { x: 12.65, z: 19.25 },
    travelHours: [14, 23],
    automatic: true,
    from: 'Nhà Vy',
    to: 'Quán cà phê',
    purpose: 'gặp người quen',
    points: [{ x: 14.0, z: 18.5 }, { x: 16, z: 18.5 }, { x: 16, z: 26.75 }, { x: 38.8, z: 26.75 }, { x: 38.8, z: 18.0 }],
  },
  {
    id: 'khoi_patrol',
    ownerNpcId: 'citizen_5',
    owner: 'Khôi',
    appearance: 'xe tuần tra',
    modelKey: 'car_sedan',
    homeParking: { x: 14.0, z: 22.5 },
    travelHours: [7, 24],
    automatic: true,
    from: 'Nhà Khôi',
    to: 'Đường tuần tra',
    purpose: 'đi tuần ban đêm',
    points: [{ x: 16, z: 24 }, { x: 16, z: 26.75 }, { x: 38.8, z: 26.75 }, { x: 38.8, z: 18 }, { x: 16, z: 18 }, { x: 16, z: 24 }],
  },
]

interface TrafficDensity {
  startHour: number
  endHour: number
  intervalMin: number
  intervalMax: number
}

const TRAFFIC_TABLE: TrafficDensity[] = [
  { startHour: 0,  endHour: 5,  intervalMin: 22, intervalMax: 38 },
  { startHour: 5,  endHour: 7,  intervalMin: 10, intervalMax: 16 },
  { startHour: 7,  endHour: 9,  intervalMin: 7,  intervalMax: 12 },
  { startHour: 9,  endHour: 12, intervalMin: 10, intervalMax: 16 },
  { startHour: 12, endHour: 14, intervalMin: 8,  intervalMax: 14 },
  { startHour: 14, endHour: 17, intervalMin: 10, intervalMax: 16 },
  { startHour: 17, endHour: 19, intervalMin: 7,  intervalMax: 12 },
  { startHour: 19, endHour: 22, intervalMin: 12, intervalMax: 20 },
  { startHour: 22, endHour: 24, intervalMin: 18, intervalMax: 30 },
]

function getSpawnInterval(hour: number): number {
  for (const row of TRAFFIC_TABLE) {
    const inRange = row.endHour > row.startHour
      ? hour >= row.startHour && hour < row.endHour
      : hour >= row.startHour || hour < row.endHour
    if (inRange) {
      return row.intervalMin + Math.random() * (row.intervalMax - row.intervalMin)
    }
  }
  return 20
}

interface PooledVehicle {
  id: string
  wrapper: THREE.Group
  active: boolean
  phase: 'driving' | 'visiting' | 'returning' | 'incident' | 'crash' | 'parked' | 'manual'
  incidentResumePhase: 'driving' | 'returning'
  incidentTimer: number
  occupantNpcId?: string
  guestNpcIds: Set<string>
  distance: number
  duration: number
  parkTimer: number
  nextTripAt: number
  driverless: boolean
  wrongLane: boolean
  pulledOver: boolean
  homeRoute: VehicleRoute
  route: VehicleRoute | null
  routePoints: RoadPoint[]
  segmentLengths: number[]
  totalLength: number
  headlight: THREE.PointLight
  taillightMat: THREE.MeshBasicMaterial
  label: THREE.Sprite
  labelTexture: THREE.CanvasTexture | null
}

export class VehicleManager {
  private scene: THREE.Scene
  private callbacks: VehicleCallbacks
  private group = new THREE.Group()
  private pool: PooledVehicle[] = []
  private templates: THREE.Group[] = []
  private spawnTimer = 4
  private yOffsets: number[] = [] // per-template Y offset to fix wheel sinking
  private ridingNpcIds = new Set<string>()
  private victimHitAt = new Map<string, number>()
  private crashAt = new Map<string, number>()
  private trafficStopCooldown = new Map<string, number>()
  private activeTrafficStop: { offenderId: string } | null = null
  private lastTrafficStopAt = 0

  private static readonly POOL_SIZE = VEHICLE_ROUTES.length

  constructor(scene: THREE.Scene, callbacks: VehicleCallbacks = {}) {
    this.scene = scene
    this.callbacks = callbacks
    this.group.name = 'vehicles'
    this.scene.add(this.group)
  }

  build(assets: AssetLoader) {
    this.buildTemplates(assets)
    this.buildPool()
  }

  private buildTemplates(assets: AssetLoader) {
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd })
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 })
    const bodyGeo = new THREE.BoxGeometry(1.5, 0.5, 0.7)
    const cabinGeo = new THREE.BoxGeometry(0.8, 0.35, 0.6)
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8)

    const fallbackColors = [0xcc3333, 0x3366cc, 0x44aa44]

    for (let i = 0; i < CAR_MODELS.length; i++) {
      const key = CAR_MODELS[i]
      const assetModel = assets.getPropModel(key)
      const template = new THREE.Group()
      let yOffset = 0

      if (assetModel) {
        assetModel.scale.setScalar(2.0)
        assetModel.rotation.y = Math.PI / 2
        assetModel.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // Measure bounding box AFTER scaling to fix wheel sinking
        const box = new THREE.Box3().setFromObject(assetModel)
        yOffset = -box.min.y
        assetModel.position.y = yOffset

        template.add(assetModel)
      } else {
        const carMat = new THREE.MeshLambertMaterial({ color: fallbackColors[i] })
        const body = new THREE.Mesh(bodyGeo, carMat)
        body.position.set(0, 0.35, 0)
        body.castShadow = true
        template.add(body)

        const cabin = new THREE.Mesh(cabinGeo, windowMat)
        cabin.position.set(0, 0.72, 0)
        cabin.castShadow = true
        template.add(cabin)

        for (const ox of [-0.5, 0.5]) {
          for (const oz of [-0.3, 0.3]) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat)
            wheel.rotation.x = Math.PI / 2
            wheel.position.set(ox, 0.12, oz)
            template.add(wheel)
          }
        }
      }

      this.templates.push(template)
      this.yOffsets.push(yOffset)
    }
  }

  private buildPool() {
    for (let i = 0; i < VehicleManager.POOL_SIZE; i++) {
      const homeRoute = VEHICLE_ROUTES[i]
      const templateIdx = Math.max(0, CAR_MODELS.indexOf(homeRoute.modelKey))
      const wrapper = this.templates[templateIdx].clone()
      wrapper.name = `vehicle_${homeRoute.id}`
      wrapper.userData.vehicleId = homeRoute.id
      wrapper.userData.ownerNpcId = homeRoute.ownerNpcId
      wrapper.userData.ownerName = homeRoute.owner
      wrapper.userData.appearance = homeRoute.appearance
      wrapper.visible = true
      this.group.add(wrapper)

      // Headlight (cheap PointLight instead of SpotLight)
      const headlight = new THREE.PointLight(0xffeeba, 0, 8)
      headlight.position.set(1.2, 0.6, 0)
      wrapper.add(headlight)

      // Taillight
      const tailGeo = new THREE.PlaneGeometry(0.3, 0.15)
      const taillightMat = new THREE.MeshBasicMaterial({
        color: 0xff2200, transparent: true, opacity: 0,
      })
      const tailMesh = new THREE.Mesh(tailGeo, taillightMat)
      tailMesh.position.set(-1.0, 0.5, 0)
      tailMesh.rotation.y = Math.PI
      wrapper.add(tailMesh)

      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }))
      label.position.set(0, 2.2, 0)
      label.scale.set(3.4, 0.9, 1)
      label.renderOrder = 24
      label.visible = false
      wrapper.add(label)

      this.pool.push({
        id: `vehicle_${i}`,
        wrapper,
        active: false,
        phase: 'parked',
        incidentResumePhase: 'driving',
        incidentTimer: 0,
        occupantNpcId: undefined,
        guestNpcIds: new Set<string>(),
        distance: 0,
        duration: 0,
        parkTimer: 0,
        nextTripAt: 0,
        driverless: false,
        wrongLane: false,
        pulledOver: false,
        homeRoute,
        route: homeRoute,
        routePoints: [],
        segmentLengths: [],
        totalLength: 0,
        headlight,
        taillightMat,
        label,
        labelTexture: null,
      })
      this.placeParkedAtHome(this.pool[this.pool.length - 1])
    }
  }

  private getAvailableAutoVehicle(hour: number, isNight: boolean): PooledVehicle | null {
    const now = performance.now() / 1000
    const eligible = this.pool.filter(v =>
      !v.active
      && v.phase === 'parked'
      && v.homeRoute.automatic
      && now >= v.nextTripAt
      && !this.ridingNpcIds.has(v.homeRoute.ownerNpcId)
      && this.canStartAutoTrip(v, hour, isNight)
    )
    if (!eligible.length) return null
    return eligible[Math.floor(Math.random() * eligible.length)]
  }

  private canStartAutoTrip(v: PooledVehicle, hour: number, isNight: boolean): boolean {
    const route = v.homeRoute
    const inWindow = hour >= route.travelHours[0] && hour < route.travelHours[1]
    if (route.id === PATROL_ROUTE_ID && inWindow) return true
    const ownerAvailable = this.callbacks.canBoard?.(route.ownerNpcId, this.getHomeParkingPoint(route)) !== false
    if (inWindow && ownerAvailable) return true
    return isNight
  }

  private spawn(isNight: boolean, hour: number) {
    const vehicle = this.getAvailableAutoVehicle(hour, isNight)
    if (!vehicle) return

    this.startAutomaticTrip(vehicle, isNight, true)
  }

  private startAutomaticTrip(vehicle: PooledVehicle, isNight: boolean, fromAutoSpawn = false): void {
    const route = vehicle.homeRoute
    const wrongLane = fromAutoSpawn
      && route.id !== PATROL_ROUTE_ID
      && Math.random() < WRONG_LANE_PROBABILITY
    vehicle.wrongLane = wrongLane
    vehicle.pulledOver = false
    const start = { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z }
    const routed = [start, ...this.applyLaneOffset(route.points, wrongLane)]
    vehicle.route = route
    vehicle.routePoints = routed
    vehicle.segmentLengths = this.getSegmentLengths(routed)
    vehicle.totalLength = vehicle.segmentLengths.reduce((sum, n) => sum + n, 0)
    vehicle.distance = 0
    vehicle.duration = Math.max(12, vehicle.totalLength / (2.2 + Math.random() * 0.8))
    vehicle.parkTimer = 0
    vehicle.phase = 'driving'
    vehicle.incidentResumePhase = 'driving'
    vehicle.incidentTimer = 0
    vehicle.active = true
    vehicle.driverless = this.callbacks.canBoard?.(route.ownerNpcId, this.getHomeParkingPoint(route)) === false
    if (!vehicle.driverless) this.boardOccupant(vehicle)

    vehicle.wrapper.visible = true
    vehicle.label.visible = true
    this.setVehicleLabel(vehicle, route, Math.max(2, Math.round(vehicle.duration / 2)))

    const first = routed[0]
    const second = routed[1] ?? first
    vehicle.wrapper.position.set(first.x, ROAD_Y, first.z)
    vehicle.wrapper.rotation.y = Math.atan2(second.x - first.x, second.z - first.z) - Math.PI / 2

    vehicle.headlight.intensity = isNight ? 1.5 : 0
    vehicle.taillightMat.opacity = isNight ? 0.9 : 0
    this.syncOccupants(vehicle)
  }

  getNearbyParkedVehicle(position: RoadPoint, maxDistance = 3.2): {
    id: string
    ownerNpcId: string
    ownerName: string
    appearance: string
    destination: string
    isPlayerVehicle: boolean
  } | null {
    let nearest: PooledVehicle | null = null
    let nearestDistance = maxDistance
    for (const vehicle of this.pool) {
      if (vehicle.phase !== 'parked' || vehicle.active) continue
      const dx = vehicle.wrapper.position.x - position.x
      const dz = vehicle.wrapper.position.z - position.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance >= nearestDistance) continue
      nearest = vehicle
      nearestDistance = distance
    }
    if (!nearest) return null
    return {
      id: nearest.homeRoute.id,
      ownerNpcId: nearest.homeRoute.ownerNpcId,
      ownerName: nearest.homeRoute.owner,
      appearance: nearest.homeRoute.appearance,
      destination: nearest.homeRoute.to,
      isPlayerVehicle: nearest.homeRoute.ownerNpcId === 'user',
    }
  }

  getPlayerOwnedVehicleNear(position: RoadPoint, maxDistance = 6): { id: string; distance: number } | null {
    const vehicle = this.pool.find(v => v.homeRoute.ownerNpcId === 'user' && v.phase === 'parked' && !v.active)
    if (!vehicle) return null
    const dx = vehicle.wrapper.position.x - position.x
    const dz = vehicle.wrapper.position.z - position.z
    const distance = Math.sqrt(dx * dx + dz * dz)
    return distance <= maxDistance ? { id: vehicle.homeRoute.id, distance } : null
  }

  boardPlayer(vehicleId: string, isNight: boolean, _dayCount: number): {
    ok: boolean
    ownerNpcId?: string
    ownerName?: string
    destination?: string
  } {
    const vehicle = this.pool.find(v => v.homeRoute.id === vehicleId)
    if (!vehicle || vehicle.phase !== 'parked' || vehicle.active) return { ok: false }

    if (vehicle.homeRoute.ownerNpcId === 'user') {
      vehicle.active = true
      vehicle.phase = 'manual'
      this.boardNpc(vehicle, 'user', true)
      this.setVehicleLabel(vehicle, vehicle.homeRoute, 0, 'manual')
      this.syncOccupants(vehicle)
      return { ok: true, ownerNpcId: 'user', ownerName: vehicle.homeRoute.owner }
    }

    this.boardNpc(vehicle, 'user', false)
    this.startAutomaticTrip(vehicle, isNight)
    return {
      ok: true,
      ownerNpcId: vehicle.homeRoute.ownerNpcId,
      ownerName: vehicle.homeRoute.owner,
      destination: vehicle.homeRoute.to,
    }
  }

  addGuestToPlayerVehicle(npcId: string): boolean {
    const vehicle = this.pool.find(v =>
      v.homeRoute.ownerNpcId === 'user'
      && v.phase === 'manual'
      && v.occupantNpcId === 'user'
    )
    if (!vehicle || vehicle.guestNpcIds.has(npcId)) return false
    this.boardNpc(vehicle, npcId, false)
    this.syncOccupants(vehicle)
    return true
  }

  hasPlayerAboard(): boolean {
    return this.pool.some(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))
  }

  isPlayerDriving(): boolean {
    return this.pool.some(v => v.phase === 'manual' && v.occupantNpcId === 'user')
  }

  canPlayerExit(): boolean {
    const vehicle = this.pool.find(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))
    if (!vehicle) return false
    return vehicle.occupantNpcId === 'user'
      || (vehicle.phase !== 'driving' && vehicle.phase !== 'returning')
  }

  getPlayerVehicleObject(): THREE.Object3D | null {
    return this.pool.find(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))?.wrapper ?? null
  }

  getCollisionActors(): CollisionActor[] {
    return this.pool
      .filter(vehicle => vehicle.wrapper.visible)
      .map(vehicle => ({
        id: `vehicle:${vehicle.id}`,
        mesh: vehicle.wrapper,
        collisionRadius: VEHICLE_COLLISION_RADIUS,
        isInActiveScene: true,
        scene: this.scene,
      }))
  }

  getPlayerVehicleInfo(): { id: string; position: RoadPoint; ownerNpcId: string } | null {
    const vehicle = this.pool.find(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))
    if (!vehicle) return null
    return {
      id: vehicle.homeRoute.id,
      position: { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z },
      ownerNpcId: vehicle.homeRoute.ownerNpcId,
    }
  }

  getVehicleOwnerName(vehicleId: string): string | null {
    const vehicle = this.pool.find(v => v.id === vehicleId)
    return vehicle?.homeRoute.owner ?? null
  }

  getStoppedNpcVehicleNear(position: RoadPoint, maxDistance = 6): {
    id: string
    ownerNpcId: string
    ownerName: string
    x: number
    z: number
    parkTimer: number
  } | null {
    let nearest: PooledVehicle | null = null
    let nearestDistance = maxDistance
    for (const vehicle of this.pool) {
      if (!vehicle.active || vehicle.phase !== 'visiting') continue
      if (vehicle.homeRoute.ownerNpcId === 'user') continue
      const dx = vehicle.wrapper.position.x - position.x
      const dz = vehicle.wrapper.position.z - position.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance >= nearestDistance) continue
      nearest = vehicle
      nearestDistance = distance
    }
    if (!nearest) return null
    return {
      id: nearest.homeRoute.id,
      ownerNpcId: nearest.homeRoute.ownerNpcId,
      ownerName: nearest.homeRoute.owner,
      x: nearest.wrapper.position.x,
      z: nearest.wrapper.position.z,
      parkTimer: nearest.parkTimer,
    }
  }

  getStoppedNpcVehicles(): Array<{
    id: string
    ownerNpcId: string
    ownerName: string
    x: number
    z: number
    parkTimer: number
  }> {
    const result: Array<{
      id: string
      ownerNpcId: string
      ownerName: string
      x: number
      z: number
      parkTimer: number
    }> = []
    for (const vehicle of this.pool) {
      if (!vehicle.active || vehicle.phase !== 'visiting') continue
      if (vehicle.homeRoute.ownerNpcId === 'user') continue
      result.push({
        id: vehicle.homeRoute.id,
        ownerNpcId: vehicle.homeRoute.ownerNpcId,
        ownerName: vehicle.homeRoute.owner,
        x: vehicle.wrapper.position.x,
        z: vehicle.wrapper.position.z,
        parkTimer: vehicle.parkTimer,
      })
    }
    return result
  }

  addGuestToNpcVehicle(vehicleId: string, npcId: string): boolean {
    const vehicle = this.pool.find(v => v.homeRoute.id === vehicleId)
    if (!vehicle || !vehicle.active || vehicle.phase === 'manual') return false
    if (vehicle.homeRoute.ownerNpcId === 'user') return false
    if (this.ridingNpcIds.has(npcId)) return false
    this.boardNpc(vehicle, npcId, false)
    this.syncOccupants(vehicle)
    return true
  }

  boardNpcVehicleAsPassenger(vehicleId: string): {
    ok: boolean
    ownerNpcId?: string
    ownerName?: string
    destination?: string
  } {
    const vehicle = this.pool.find(v => v.homeRoute.id === vehicleId)
    if (!vehicle || !vehicle.active || vehicle.phase !== 'visiting') return { ok: false }
    if (vehicle.homeRoute.ownerNpcId === 'user') return { ok: false }
    this.boardNpc(vehicle, 'user', false)
    this.boardOccupant(vehicle)
    vehicle.parkTimer = Math.min(vehicle.parkTimer, 2.5)
    this.syncOccupants(vehicle)
    this.setVehicleLabel(vehicle, vehicle.homeRoute, Math.max(1, Math.round(vehicle.parkTimer / 2)), 'parking')
    return {
      ok: true,
      ownerNpcId: vehicle.homeRoute.ownerNpcId,
      ownerName: vehicle.homeRoute.owner,
      destination: vehicle.homeRoute.to,
    }
  }

  getPlayerCabinInfo(): {
    id: string
    ownerNpcId: string
    ownerName: string
    appearance: string
    destination: string
    phase: PooledVehicle['phase']
    position: RoadPoint
    driverNpcId?: string
    passengerNpcIds: string[]
  } | null {
    const vehicle = this.pool.find(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))
    if (!vehicle) return null
    return {
      id: vehicle.homeRoute.id,
      ownerNpcId: vehicle.homeRoute.ownerNpcId,
      ownerName: vehicle.homeRoute.owner,
      appearance: vehicle.homeRoute.appearance,
      destination: vehicle.homeRoute.to,
      phase: vehicle.phase,
      position: { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z },
      driverNpcId: vehicle.occupantNpcId,
      passengerNpcIds: [...vehicle.guestNpcIds],
    }
  }

  getNpcVehicleInfo(npcId: string): {
    id: string
    ownerNpcId: string
    ownerName: string
    appearance: string
    destination: string
    phase: PooledVehicle['phase']
    position: RoadPoint
    driverNpcId?: string
    passengerNpcIds: string[]
  } | null {
    const vehicle = this.pool.find(v => v.occupantNpcId === npcId || v.guestNpcIds.has(npcId))
    if (!vehicle) return null
    return {
      id: vehicle.homeRoute.id,
      ownerNpcId: vehicle.homeRoute.ownerNpcId,
      ownerName: vehicle.homeRoute.owner,
      appearance: vehicle.homeRoute.appearance,
      destination: vehicle.homeRoute.to,
      phase: vehicle.phase,
      position: { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z },
      driverNpcId: vehicle.occupantNpcId,
      passengerNpcIds: [...vehicle.guestNpcIds],
    }
  }

  movePlayerVehicle(dx: number, dz: number, delta: number, clamp: (x: number, z: number) => RoadPoint): boolean {
    const vehicle = this.pool.find(v => v.phase === 'manual' && v.occupantNpcId === 'user')
    if (!vehicle) return false
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len <= 0.001) return true
    const speed = 8.2
    const previous = { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z }
    const next = clamp(
      vehicle.wrapper.position.x + (dx / len) * speed * delta,
      vehicle.wrapper.position.z + (dz / len) * speed * delta,
    )
    const resolved = this.callbacks.resolveVehicleMove?.(vehicle.id, vehicle.wrapper, previous, next) ?? next
    vehicle.wrapper.position.x = resolved.x
    vehicle.wrapper.position.z = resolved.z
    vehicle.wrapper.rotation.y = Math.atan2(dx / len, dz / len) - Math.PI / 2
    this.syncOccupants(vehicle)

    const victim = this.findHitPedestrian(vehicle, previous, resolved)
    if (victim && this.callbacks.onPedestrianHit?.({
      vehicle: vehicle.wrapper,
      vehicleId: vehicle.id,
      victimNpcId: victim.id,
      driverName: vehicle.homeRoute.owner,
      ownerName: vehicle.homeRoute.owner,
      position: { x: resolved.x, z: resolved.z },
      speed,
    }) !== false) {
      this.victimHitAt.set(victim.id, Date.now())
    }
    return true
  }

  exitPlayer(): RoadPoint | null {
    const vehicle = this.pool.find(v => v.occupantNpcId === 'user' || v.guestNpcIds.has('user'))
    if (!vehicle) return null
    if (vehicle.guestNpcIds.has('user') && (vehicle.phase === 'driving' || vehicle.phase === 'returning')) {
      return null
    }
    const exit = { x: vehicle.wrapper.position.x + 1.4, z: vehicle.wrapper.position.z + 0.8 }
    if (vehicle.occupantNpcId === 'user') {
      this.leaveOccupant(vehicle, exit)
      for (const guestId of [...vehicle.guestNpcIds]) this.leaveGuest(vehicle, guestId, exit)
      vehicle.active = false
      vehicle.phase = 'parked'
      vehicle.routePoints = []
      vehicle.segmentLengths = []
      vehicle.totalLength = 0
      vehicle.distance = 0
      this.setVehicleLabel(vehicle, vehicle.homeRoute, 0, 'parking')
    } else {
      this.leaveGuest(vehicle, 'user', exit)
    }
    return exit
  }

  private placeParkedAtHome(vehicle: PooledVehicle): void {
    const route = vehicle.homeRoute
    const home = this.getHomeParkingPoint(route)
    const next = route.points[1] ?? home
    vehicle.wrapper.visible = true
    vehicle.wrapper.position.set(home.x, ROAD_Y, home.z)
    vehicle.wrapper.rotation.y = Math.atan2(next.x - home.x, next.z - home.z) - Math.PI / 2
    vehicle.label.scale.set(2.6, 0.68, 1)
    vehicle.label.visible = true
    this.setVehicleLabel(vehicle, route, 0, 'home')
    vehicle.headlight.intensity = 0
    vehicle.taillightMat.opacity = 0
  }

  private getHomeParkingPoint(route: VehicleRoute): RoadPoint {
    return route.homeParking
  }

  private parkAtHome(vehicle: PooledVehicle) {
    const route = vehicle.homeRoute
    if (route) {
      this.leaveOccupant(vehicle, route.points[0])
      this.leaveAllGuests(vehicle, route.points[0])
    }
    vehicle.active = false
    vehicle.phase = 'parked'
    this.placeParkedAtHome(vehicle)
    vehicle.route = route
    vehicle.occupantNpcId = undefined
    vehicle.routePoints = []
    vehicle.segmentLengths = []
    vehicle.totalLength = 0
    vehicle.distance = 0
    vehicle.parkTimer = 0
    vehicle.incidentTimer = 0
    vehicle.driverless = false
    vehicle.wrongLane = false
    vehicle.pulledOver = false
    if (this.activeTrafficStop?.offenderId === vehicle.id) this.activeTrafficStop = null
    vehicle.nextTripAt = performance.now() / 1000 + 20 + Math.random() * 40
  }

  private boardOccupant(vehicle: PooledVehicle): void {
    if (vehicle.driverless) return
    const npcId = vehicle.route?.ownerNpcId
    if (!npcId) return
    this.boardNpc(vehicle, npcId, true)
  }

  private boardNpc(vehicle: PooledVehicle, npcId: string, driver: boolean): void {
    if (this.ridingNpcIds.has(npcId)) return
    if (driver) vehicle.occupantNpcId = npcId
    else vehicle.guestNpcIds.add(npcId)
    this.ridingNpcIds.add(npcId)
    this.callbacks.onBoard?.(npcId)
  }

  private leaveOccupant(vehicle: PooledVehicle, position: RoadPoint): void {
    const npcId = vehicle.occupantNpcId
    if (!npcId) return
    vehicle.occupantNpcId = undefined
    this.ridingNpcIds.delete(npcId)
    this.callbacks.onLeave?.(npcId, position)
  }

  private leaveGuest(vehicle: PooledVehicle, npcId: string, position: RoadPoint): void {
    if (!vehicle.guestNpcIds.delete(npcId)) return
    this.ridingNpcIds.delete(npcId)
    this.callbacks.onLeave?.(npcId, position)
  }

  private leaveAllGuests(vehicle: PooledVehicle, position: RoadPoint): void {
    for (const npcId of [...vehicle.guestNpcIds]) this.leaveGuest(vehicle, npcId, position)
  }

  private syncOccupants(vehicle: PooledVehicle): void {
    const ids = [
      ...(vehicle.occupantNpcId ? [vehicle.occupantNpcId] : []),
      ...vehicle.guestNpcIds,
    ]
    if (!ids.length) return
    this.callbacks.onMove?.(ids, {
      x: vehicle.wrapper.position.x,
      z: vehicle.wrapper.position.z,
    })
  }

  update(gameClock: GameClock, delta: number) {
    const hour = gameClock.getGameHour()
    const period = gameClock.getPeriod()
    const needLights = period === 'night' || period === 'dusk' || period === 'dawn'
    const time = performance.now() / 1000

    // Spawn timer
    this.spawnTimer -= delta
    if (this.spawnTimer <= 0) {
      this.spawn(needLights, hour)
      this.spawnTimer = getSpawnInterval(hour)
    }

    // Update active vehicles
    for (const v of this.pool) {
      if (!v.active) continue
      if (v.phase === 'manual') continue

      if (!v.route) {
        this.parkAtHome(v)
        continue
      }

      if (v.phase === 'incident') {
        v.incidentTimer -= delta
        v.headlight.intensity = needLights ? 0.65 : 0
        v.taillightMat.opacity = 1
        if (v.incidentTimer > 0) continue
        if (v.pulledOver) {
          v.pulledOver = false
          v.wrongLane = false
          if (this.activeTrafficStop?.offenderId === v.id) this.activeTrafficStop = null
          this.rebuildRoutePoints(v)
        }
        v.phase = v.incidentResumePhase
        v.taillightMat.opacity = needLights ? 0.9 : 0
        this.setVehicleLabel(
          v,
          v.route,
          Math.max(2, Math.round((v.totalLength - v.distance) / Math.max(0.1, v.totalLength / v.duration) / 2)),
          v.phase === 'returning' ? 'returning' : 'driving',
        )
      }

      if (v.phase === 'crash') {
        v.incidentTimer -= delta
        v.headlight.intensity = needLights ? 0.65 : 0
        v.taillightMat.opacity = 1
        if (v.incidentTimer > 0) continue
        v.phase = v.incidentResumePhase
        v.taillightMat.opacity = needLights ? 0.9 : 0
        this.setVehicleLabel(
          v,
          v.route,
          Math.max(2, Math.round((v.totalLength - v.distance) / Math.max(0.1, v.totalLength / v.duration) / 2)),
          v.phase === 'returning' ? 'returning' : 'driving',
        )
      }

      if (v.phase === 'visiting') {
        v.parkTimer -= delta
        v.headlight.intensity = 0
        v.taillightMat.opacity = needLights ? 0.55 : 0
        if (v.parkTimer > 0) continue

        const returning = [
          ...this.applyLaneOffset([...v.route.points].reverse(), v.wrongLane),
          this.getHomeParkingPoint(v.route),
        ]
        v.routePoints = returning
        v.segmentLengths = this.getSegmentLengths(returning)
        v.totalLength = v.segmentLengths.reduce((sum, n) => sum + n, 0)
        v.distance = 0
        v.duration = Math.max(14, v.totalLength / (1.9 + Math.random() * 0.6))
        v.phase = 'returning'
        this.boardOccupant(v)
        this.setVehicleLabel(v, v.route, Math.max(2, Math.round(v.duration / 2)), 'returning')
      }

      v.distance += delta * (v.totalLength / v.duration)
      if (v.distance >= v.totalLength) {
        if (v.phase === 'driving') {
          const last = v.routePoints[v.routePoints.length - 1]
          v.distance = v.totalLength
          v.phase = 'visiting'
          v.parkTimer = 14 + Math.random() * 24
          v.wrapper.position.set(last.x, ROAD_Y, last.z)
          v.wrapper.rotation.y = this.sampleRoute(v.routePoints, v.segmentLengths, v.totalLength).rotationY
          this.leaveOccupant(v, last)
          this.leaveAllGuests(v, last)
          v.label.visible = true
          this.setVehicleLabel(v, v.route, Math.max(1, Math.round(v.parkTimer / 2)), 'parking')
        } else {
          this.parkAtHome(v)
        }
        continue
      }

      const previous = { x: v.wrapper.position.x, z: v.wrapper.position.z }
      const pose = this.sampleRoute(v.routePoints, v.segmentLengths, v.distance)
      const bump = Math.sin(time * 12 + v.distance) * 0.015
      const resolved = this.callbacks.resolveVehicleMove
        ? this.callbacks.resolveVehicleMove(v.id, v.wrapper, previous, { x: pose.x, z: pose.z })
        : { x: pose.x, z: pose.z }
      const moved = Math.hypot(resolved.x - previous.x, resolved.z - previous.z)
      if (moved > 1e-4) {
        v.wrapper.position.x = resolved.x
        v.wrapper.position.z = resolved.z
      } else {
        // Blocked (pedestrian / object / another vehicle): hold position and
        // rewind route progress so the vehicle resumes from where it actually is.
        v.distance = Math.max(0, v.distance - delta * (v.totalLength / v.duration))
      }
      v.wrapper.position.y = ROAD_Y + bump
      v.wrapper.rotation.y = pose.rotationY
      this.syncOccupants(v)

      v.headlight.intensity = needLights ? 1.5 : 0
      v.taillightMat.opacity = needLights ? 0.9 : 0

      const victim = this.findHitPedestrian(v, previous, pose)
      if (victim && this.callbacks.onPedestrianHit?.({
        vehicle: v.wrapper,
        vehicleId: v.id,
        victimNpcId: victim.id,
        driverName: v.route.owner,
        ownerName: v.route.owner,
        position: { x: pose.x, z: pose.z },
        speed: v.totalLength / Math.max(0.1, v.duration),
      }) !== false) {
        this.victimHitAt.set(victim.id, Date.now())
        v.incidentResumePhase = v.phase === 'returning' ? 'returning' : 'driving'
        v.phase = 'incident'
        v.incidentTimer = TRAFFIC_INCIDENT_DURATION_MS / 1000
        v.taillightMat.opacity = 1
        this.setVehicleLabel(v, v.route, Math.ceil(v.incidentTimer / 2), 'incident')
      }
    }

    this.checkVehicleCrashes(needLights)
    this.checkTrafficStops(needLights)
  }

  private rebuildRoutePoints(vehicle: PooledVehicle): void {
    const route = vehicle.route
    if (!route) return
    const start = { x: vehicle.wrapper.position.x, z: vehicle.wrapper.position.z }
    const routed = [start, ...this.applyLaneOffset(route.points, vehicle.wrongLane)]
    vehicle.routePoints = routed
    vehicle.segmentLengths = this.getSegmentLengths(routed)
    vehicle.totalLength = vehicle.segmentLengths.reduce((sum, n) => sum + n, 0)
    vehicle.distance = 0
    vehicle.duration = Math.max(12, vehicle.totalLength / (2.2 + Math.random() * 0.8))
  }

  private checkTrafficStops(needLights: boolean): void {
    if (this.activeTrafficStop) return
    const patrol = this.pool.find(v =>
      v.homeRoute.id === PATROL_ROUTE_ID
      && v.active
      && (v.phase === 'driving' || v.phase === 'returning'),
    )
    if (!patrol) return
    const now = Date.now()
    if (now - this.lastTrafficStopAt < TRAFFIC_STOP_GAP_MS) return
    for (const v of this.pool) {
      if (!v.active || !v.wrongLane || (v.phase !== 'driving' && v.phase !== 'returning')) continue
      if (now - (this.trafficStopCooldown.get(v.id) ?? 0) < TRAFFIC_STOP_COOLDOWN_MS) continue
      const dx = v.wrapper.position.x - patrol.wrapper.position.x
      const dz = v.wrapper.position.z - patrol.wrapper.position.z
      if (Math.sqrt(dx * dx + dz * dz) > TRAFFIC_STOP_DISTANCE) continue

      this.trafficStopCooldown.set(v.id, now)
      this.lastTrafficStopAt = now
      this.activeTrafficStop = { offenderId: v.id }
      const offenderPhase = v.phase as 'driving' | 'returning'

      v.incidentResumePhase = offenderPhase
      v.phase = 'incident'
      v.incidentTimer = TRAFFIC_STOP_DURATION_S
      v.pulledOver = true
      v.taillightMat.opacity = 1
      if (v.route) this.setVehicleLabel(v, v.route, Math.ceil(v.incidentTimer / 2), 'incident')

      patrol.incidentResumePhase = patrol.phase as 'driving' | 'returning'
      patrol.phase = 'incident'
      patrol.incidentTimer = TRAFFIC_STOP_DURATION_S
      patrol.headlight.intensity = needLights ? 0.65 : 0
      patrol.taillightMat.opacity = 1
      if (patrol.route) this.setVehicleLabel(patrol, patrol.route, Math.ceil(patrol.incidentTimer / 2), 'incident')

      this.callbacks.onTrafficStop?.({
        offenderOwnerName: v.route?.owner ?? v.id,
        offenderOwnerNpcId: v.route?.ownerNpcId ?? v.id,
        offenderVehicleId: v.id,
        offenderVehicle: v.wrapper,
        patrolVehicle: patrol.wrapper,
        position: { x: v.wrapper.position.x, z: v.wrapper.position.z },
      })
      break
    }
  }

  private checkVehicleCrashes(needLights: boolean): void {
    const candidates = this.pool.filter(v =>
      v.wrapper.visible && (v.active || v.phase === 'parked'),
    )
    const now = Date.now()
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i]
      for (let j = i + 1; j < candidates.length; j++) {
        const b = candidates[j]
        if (a.phase === 'crash' && b.phase === 'crash') continue
        const dx = a.wrapper.position.x - b.wrapper.position.x
        const dz = a.wrapper.position.z - b.wrapper.position.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        if (distance > VEHICLE_CRASH_DISTANCE) continue
        const key = [a.id, b.id].sort().join('|')
        if (now - (this.crashAt.get(key) ?? 0) < VEHICLE_CRASH_COOLDOWN_MS) continue
        this.crashAt.set(key, now)

        this.callbacks.onVehicleCrash?.({
          vehicleAId: a.id,
          vehicleBId: b.id,
          vehicleA: a.wrapper,
          vehicleB: b.wrapper,
          position: {
            x: (a.wrapper.position.x + b.wrapper.position.x) / 2,
            z: (a.wrapper.position.z + b.wrapper.position.z) / 2,
          },
          playerInvolved: a.phase === 'manual' || b.phase === 'manual',
        })

        for (const v of [a, b]) {
          if (v.phase !== 'manual' && v.active) {
            v.incidentResumePhase = v.phase === 'returning' ? 'returning' : 'driving'
            v.phase = 'crash'
            v.incidentTimer = VEHICLE_CRASH_DURATION_S
            v.taillightMat.opacity = 1
            if (v.route) this.setVehicleLabel(v, v.route, Math.ceil(v.incidentTimer / 2), 'crash')
          }
        }
      }
    }
  }

  private findHitPedestrian(
    vehicle: PooledVehicle,
    from: RoadPoint,
    to: RoadPoint,
  ): VehiclePedestrian | null {
    const now = Date.now()
    let best: VehiclePedestrian | null = null
    let bestDistanceSq = VEHICLE_HIT_RADIUS * VEHICLE_HIT_RADIUS
    for (const pedestrian of this.callbacks.getPedestrians?.() ?? []) {
      if (pedestrian.id === vehicle.occupantNpcId) continue
      if (now - (this.victimHitAt.get(pedestrian.id) ?? 0) < VICTIM_HIT_COOLDOWN_MS) continue
      const distanceSq = distancePointToSegmentSquared(pedestrian, from, to)
      if (distanceSq >= bestDistanceSq) continue
      best = pedestrian
      bestDistanceSq = distanceSq
    }
    return best
  }

  private applyLaneOffset(points: RoadPoint[], wrongLane = false): RoadPoint[] {
    if (points.length < 2) return points
    const sign = wrongLane ? -1 : 1
    return points.map((p, i) => {
      const prev = points[Math.max(0, i - 1)]
      const next = points[Math.min(points.length - 1, i + 1)]
      const dx = next.x - prev.x
      const dz = next.z - prev.z
      const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz))
      return {
        x: p.x + (-dz / len) * LANE_OFFSET * sign,
        z: p.z + (dx / len) * LANE_OFFSET * sign,
      }
    })
  }

  private getSegmentLengths(points: RoadPoint[]): number[] {
    const lengths: number[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x
      const dz = points[i + 1].z - points[i].z
      lengths.push(Math.sqrt(dx * dx + dz * dz))
    }
    return lengths
  }

  private sampleRoute(points: RoadPoint[], lengths: number[], distance: number): { x: number; z: number; rotationY: number } {
    let remaining = distance
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i]
      if (remaining <= len) {
        const a = points[i]
        const b = points[i + 1]
        const t = len > 0 ? remaining / len : 1
        return {
          x: THREE.MathUtils.lerp(a.x, b.x, t),
          z: THREE.MathUtils.lerp(a.z, b.z, t),
          rotationY: Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2,
        }
      }
      remaining -= len
    }
    const last = points[points.length - 1]
    const prev = points[points.length - 2] ?? last
    return {
      x: last.x,
      z: last.z,
      rotationY: Math.atan2(last.x - prev.x, last.z - prev.z) - Math.PI / 2,
    }
  }

  private setVehicleLabel(
    vehicle: PooledVehicle,
    route: VehicleRoute,
    minutes: number,
    state: 'driving' | 'returning' | 'parking' | 'home' | 'manual' | 'incident' | 'crash' = 'driving',
  ): void {
    if (vehicle.labelTexture) {
      vehicle.labelTexture.dispose()
      vehicle.labelTexture = null
    }
    const canvas = document.createElement('canvas')
    vehicle.label.scale.set(state === 'home' ? 2.6 : 3.4, state === 'home' ? 0.68 : 0.9, 1)
    canvas.width = 512
    canvas.height = 144
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(18,24,32,0.88)'
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(12, 12, 488, 120, 18)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff7dc'
    ctx.font = '700 28px "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(vehicle.driverless ? `Xe của ${route.owner} · tự hành trình` : `Xe của ${route.owner} · ${route.owner} lái`, 256, 52)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '600 22px "Segoe UI", Arial, sans-serif'
    ctx.fillText(`${route.purpose}: ${route.from} → ${route.to} · ~${minutes} phút`, 256, 92)

    ctx.fillStyle = 'rgba(18,24,32,0.94)'
    ctx.fillRect(18, 22, 476, 94)
    ctx.fillStyle = '#fff7dc'
    ctx.font = '700 28px "Segoe UI", Arial, sans-serif'
    const title = state === 'incident'
      ? t('traffic_incident.vehicle_title', { owner: route.owner })
      : state === 'crash'
        ? t('traffic_crash.vehicle_title', { owner: route.owner })
      : state === 'home'
        ? `Xe của ${route.owner}`
      : state === 'manual'
        ? `${route.owner} đang lái`
      : state === 'parking'
        ? `Xe nhà ${route.owner} đang đỗ`
        : `Xe nhà ${route.owner}`
    ctx.fillText(title, 256, 54)
    ctx.fillStyle = 'rgba(255,255,255,0.76)'
    ctx.font = '600 22px "Segoe UI", Arial, sans-serif'
    const detail = state === 'home'
      ? `${route.appearance} · đỗ cạnh ${route.from}`
      : state === 'manual'
        ? `${route.appearance} · W A S D để lái · E để xuống`
      : state === 'returning'
      ? `Đang về nhà cất xe · ~${minutes} phút`
      : state === 'incident'
        ? t('traffic_incident.vehicle_detail')
      : state === 'crash'
        ? t('traffic_crash.vehicle_detail')
      : state === 'parking'
        ? 'Đang đỗ ở điểm đến · lát nữa quay về'
        : `Đang trên đường · ~${minutes} phút`
    ctx.fillText(detail, 256, 94)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    vehicle.labelTexture = texture
    const mat = vehicle.label.material as THREE.SpriteMaterial
    mat.map = texture
    mat.needsUpdate = true
  }

  clear() {
    for (const v of this.pool) {
      if (v.labelTexture) v.labelTexture.dispose()
      const mat = v.label.material as THREE.SpriteMaterial
      mat.map?.dispose()
      mat.dispose()
    }
    this.pool = []
    this.templates = []
    this.yOffsets = []
    this.ridingNpcIds.clear()
    this.victimHitAt.clear()
    this.crashAt.clear()
    this.group.clear()
    this.scene.remove(this.group)
  }
}

export function distancePointToSegmentSquared(
  point: RoadPoint,
  start: RoadPoint,
  end: RoadPoint,
): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSq = dx * dx + dz * dz
  if (lengthSq <= 1e-10) {
    const px = point.x - start.x
    const pz = point.z - start.z
    return px * px + pz * pz
  }
  const t = THREE.MathUtils.clamp(
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq,
    0,
    1,
  )
  const closestX = start.x + dx * t
  const closestZ = start.z + dz * t
  const px = point.x - closestX
  const pz = point.z - closestZ
  return px * px + pz * pz
}
