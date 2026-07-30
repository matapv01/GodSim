import * as THREE from 'three'
import { AssetLoader } from '../visual/AssetLoader'
import { GameClock } from '../GameClock'
import { t } from '../../i18n'

const CAR_MODELS = ['car_sedan', 'car_hatchback', 'car_taxi'] as const

const ROAD_Y = 0.06
const LANE_OFFSET = 0.32
const PRIVATE_ROUTE_COUNT = 3

interface RoadPoint { x: number; z: number }
interface VehicleRoute {
  owner: string
  driver: string
  occupantNpcId?: string
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

interface VehicleCallbacks {
  canBoard?: (npcId: string, position: RoadPoint) => boolean
  onBoard?: (npcId: string) => void
  onLeave?: (npcId: string, position: RoadPoint) => void
  getPedestrians?: () => VehiclePedestrian[]
  onPedestrianHit?: (incident: VehicleIncident) => boolean
}

export const TRAFFIC_INCIDENT_DURATION_MS = 18_000
const VEHICLE_HIT_RADIUS = 1.05
const VICTIM_HIT_COOLDOWN_MS = 60_000

const VEHICLE_ROUTES: VehicleRoute[] = [
  {
    owner: 'Minh',
    driver: 'Minh',
    occupantNpcId: 'citizen_1',
    from: 'Nhà Minh, An và Bảo',
    to: 'Công ty chính',
    purpose: 'đi làm',
    points: [{ x: 6.0, z: 7.5 }, { x: 16, z: 7.5 }, { x: 16, z: 10.5 }, { x: 24.4, z: 10.5 }, { x: 24.4, z: 13.0 }],
  },
  {
    owner: 'Lan',
    occupantNpcId: 'citizen_2',
    driver: 'Khôi',
    from: 'Nhà Lan và Khôi',
    to: 'Khu chợ',
    purpose: 'mua đồ',
    points: [{ x: 6.0, z: 13.0 }, { x: 16, z: 13.0 }, { x: 16, z: 18.0 }, { x: 38.8, z: 18.0 }, { x: 38.8, z: 10.5 }],
  },
  {
    owner: 'Vy',
    driver: 'Vy',
    occupantNpcId: 'citizen_6',
    from: 'Nhà Hà và Vy',
    to: 'Quán cà phê',
    purpose: 'gặp người quen',
    points: [{ x: 14.0, z: 18.5 }, { x: 16, z: 18.5 }, { x: 16, z: 26.75 }, { x: 38.8, z: 26.75 }, { x: 38.8, z: 18.0 }],
  },
  {
    owner: 'Bảo',
    driver: 'An',
    from: 'Công ty chính',
    to: 'Nhà Minh, An và Bảo',
    purpose: 'về nhà',
    points: [{ x: 11.2, z: 11.75 }, { x: 16, z: 11.75 }, { x: 16, z: 10.5 }, { x: 24.4, z: 10.5 }, { x: 24.4, z: 13.0 }],
  },
  {
    owner: 'Taxi thị trấn',
    driver: 'Bác Tùng',
    from: 'Đường chính',
    to: 'Nhà văn hóa',
    purpose: 'chở khách',
    points: [{ x: -8, z: 32 }, { x: 16, z: 32 }, { x: 16, z: 26.75 }, { x: 38.8, z: 26.75 }, { x: 38.8, z: 25.5 }],
  },
  {
    owner: 'Taxi thị trấn',
    driver: 'Cô Mai',
    from: 'Quán ăn gia đình',
    to: 'Đường chính',
    purpose: 'đón khách xong rời thị trấn',
    points: [{ x: 42.4, z: 26.75 }, { x: 38.8, z: 26.75 }, { x: 38.8, z: 32 }, { x: 64, z: 32 }],
  },
]

interface TrafficDensity {
  startHour: number
  endHour: number
  intervalMin: number
  intervalMax: number
}

const TRAFFIC_TABLE: TrafficDensity[] = [
  { startHour: 0,  endHour: 5,  intervalMin: 35, intervalMax: 55 },
  { startHour: 5,  endHour: 7,  intervalMin: 12, intervalMax: 18 },
  { startHour: 7,  endHour: 9,  intervalMin: 8,  intervalMax: 14 },
  { startHour: 9,  endHour: 12, intervalMin: 12, intervalMax: 20 },
  { startHour: 12, endHour: 14, intervalMin: 10, intervalMax: 16 },
  { startHour: 14, endHour: 17, intervalMin: 12, intervalMax: 20 },
  { startHour: 17, endHour: 19, intervalMin: 8,  intervalMax: 14 },
  { startHour: 19, endHour: 22, intervalMin: 16, intervalMax: 26 },
  { startHour: 22, endHour: 24, intervalMin: 28, intervalMax: 45 },
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
  phase: 'driving' | 'visiting' | 'returning' | 'incident' | 'parked'
  incidentResumePhase: 'driving' | 'returning'
  incidentTimer: number
  occupantNpcId?: string
  distance: number
  duration: number
  parkTimer: number
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

  private static readonly POOL_SIZE = PRIVATE_ROUTE_COUNT

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
      const templateIdx = i % this.templates.length
      const wrapper = this.templates[templateIdx].clone()
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
        distance: 0,
        duration: 0,
        parkTimer: 0,
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

  private getAvailableParkedVehicle(): PooledVehicle | null {
    return this.pool.find(v =>
      !v.active
      && v.phase === 'parked'
      && (!v.homeRoute.occupantNpcId || !this.ridingNpcIds.has(v.homeRoute.occupantNpcId))
      && (!v.homeRoute.occupantNpcId || this.callbacks.canBoard?.(v.homeRoute.occupantNpcId, this.getHomeParkingPoint(v.homeRoute)) !== false)
    ) ?? null
  }

  private spawn(isNight: boolean) {
    const vehicle = this.getAvailableParkedVehicle()
    if (!vehicle) return

    const route = vehicle.homeRoute
    const routed = [this.getHomeParkingPoint(route), ...this.applyLaneOffset(route.points)]
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
    this.boardOccupant(vehicle)

    vehicle.wrapper.visible = true
    vehicle.label.visible = true
    this.setVehicleLabel(vehicle, route, Math.max(2, Math.round(vehicle.duration / 2)))

    const first = routed[0]
    const second = routed[1] ?? first
    vehicle.wrapper.position.set(first.x, ROAD_Y, first.z)
    vehicle.wrapper.rotation.y = Math.atan2(second.x - first.x, second.z - first.z) - Math.PI / 2

    vehicle.headlight.intensity = isNight ? 1.5 : 0
    vehicle.taillightMat.opacity = isNight ? 0.9 : 0
  }

  private placeParkedAtHome(vehicle: PooledVehicle): void {
    const route = vehicle.homeRoute
    const home = this.getHomeParkingPoint(route)
    const next = route.points[1] ?? home
    vehicle.wrapper.visible = true
    vehicle.wrapper.position.set(home.x, ROAD_Y, home.z)
    vehicle.wrapper.rotation.y = Math.atan2(next.x - home.x, next.z - home.z) - Math.PI / 2
    vehicle.label.visible = false
    vehicle.headlight.intensity = 0
    vehicle.taillightMat.opacity = 0
  }

  private getHomeParkingPoint(route: VehicleRoute): RoadPoint {
    const home = route.points[0]
    return { x: home.x - 1.35, z: home.z + 0.75 }
  }

  private parkAtHome(vehicle: PooledVehicle) {
    const route = vehicle.homeRoute
    if (route) this.leaveOccupant(vehicle, route.points[0])
    vehicle.active = false
    vehicle.phase = 'parked'
    this.placeParkedAtHome(vehicle)
    vehicle.label.visible = false
    vehicle.route = route
    vehicle.occupantNpcId = undefined
    vehicle.routePoints = []
    vehicle.segmentLengths = []
    vehicle.totalLength = 0
    vehicle.distance = 0
    vehicle.parkTimer = 0
    vehicle.incidentTimer = 0
  }

  private boardOccupant(vehicle: PooledVehicle): void {
    const npcId = vehicle.route?.occupantNpcId
    if (!npcId) return
    vehicle.occupantNpcId = npcId
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

  update(gameClock: GameClock, delta: number) {
    const hour = gameClock.getGameHour()
    const period = gameClock.getPeriod()
    const needLights = period === 'night' || period === 'dusk' || period === 'dawn'
    const time = performance.now() / 1000

    // Spawn timer
    this.spawnTimer -= delta
    if (this.spawnTimer <= 0) {
      this.spawn(needLights)
      this.spawnTimer = getSpawnInterval(hour)
    }

    // Update active vehicles
    for (const v of this.pool) {
      if (!v.active) continue

      if (!v.route) {
        this.parkAtHome(v)
        continue
      }

      if (v.phase === 'incident') {
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
          ...this.applyLaneOffset([...v.route.points].reverse()),
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
      v.wrapper.position.x = pose.x
      v.wrapper.position.z = pose.z
      v.wrapper.position.y = ROAD_Y + bump
      v.wrapper.rotation.y = pose.rotationY

      v.headlight.intensity = needLights ? 1.5 : 0
      v.taillightMat.opacity = needLights ? 0.9 : 0

      const victim = this.findHitPedestrian(v, previous, pose)
      if (victim && this.callbacks.onPedestrianHit?.({
        vehicle: v.wrapper,
        vehicleId: v.id,
        victimNpcId: victim.id,
        driverName: v.route.driver,
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

  private applyLaneOffset(points: RoadPoint[]): RoadPoint[] {
    if (points.length < 2) return points
    return points.map((p, i) => {
      const prev = points[Math.max(0, i - 1)]
      const next = points[Math.min(points.length - 1, i + 1)]
      const dx = next.x - prev.x
      const dz = next.z - prev.z
      const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz))
      return {
        x: p.x + (-dz / len) * LANE_OFFSET,
        z: p.z + (dx / len) * LANE_OFFSET,
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
    state: 'driving' | 'returning' | 'parking' | 'incident' = 'driving',
  ): void {
    if (vehicle.labelTexture) {
      vehicle.labelTexture.dispose()
      vehicle.labelTexture = null
    }
    const canvas = document.createElement('canvas')
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
    ctx.fillText(`Xe của ${route.owner} · ${route.driver} lái`, 256, 52)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '600 22px "Segoe UI", Arial, sans-serif'
    ctx.fillText(`${route.purpose}: ${route.from} → ${route.to} · ~${minutes} phút`, 256, 92)

    ctx.fillStyle = 'rgba(18,24,32,0.94)'
    ctx.fillRect(18, 22, 476, 94)
    ctx.fillStyle = '#fff7dc'
    ctx.font = '700 28px "Segoe UI", Arial, sans-serif'
    const title = state === 'incident'
      ? t('traffic_incident.vehicle_title', { owner: route.owner })
      : state === 'parking'
        ? `Xe nha ${route.owner} dang do`
        : `Xe nha ${route.owner}`
    ctx.fillText(title, 256, 54)
    ctx.fillStyle = 'rgba(255,255,255,0.76)'
    ctx.font = '600 22px "Segoe UI", Arial, sans-serif'
    const detail = state === 'returning'
      ? `Dang quay ve nha cat xe - ~${minutes} phut`
      : state === 'incident'
        ? t('traffic_incident.vehicle_detail')
      : state === 'parking'
        ? `Dang do tai diem den - lat nua quay ve`
        : `Dang tren duong den diem hen - ~${minutes} phut`
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
