import * as THREE from 'three'
import { AssetLoader } from '../visual/AssetLoader'
import type { CollisionObstacle } from '../physics/CollisionWorld'
import type { TrafficLightRefs } from './TrafficLightSystem'

interface WindowDef {
  pos: [number, number, number]
}

interface BuildingDef {
  id: string
  modelKey: string
  label: string
  pos: [number, number, number]
  scale: number
  rotationY: number
  doorOffset: [number, number, number]
  size: [number, number, number]
  color: number
  roofColor?: number
  windows?: WindowDef[]
}

const BUILDINGS: BuildingDef[] = [
  {
    id: 'office', modelKey: 'building_A', label: 'Công ty chính', pos: [54.0, 0, 8.0], scale: 3.5, rotationY: 0,
    doorOffset: [54.0, 0.05, 14.0], size: [9, 15, 7], color: 0x6688aa,
    windows: [
      { pos: [0, 0.95, 1.01] },
    ],
  },
  {
    id: 'coworking', modelKey: 'building_A', label: 'Văn phòng nhỏ', pos: [64.0, 0, 8.0], scale: 2.2, rotationY: 0,
    doorOffset: [64.0, 0.05, 14.0], size: [5, 6, 5], color: 0x6f9fbd,
    windows: [
      { pos: [0, 1.0, 1.01] },
    ],
  },
  {
    id: 'clinic', modelKey: 'building_H', label: 'Phòng khám', pos: [16.0, 0, 8.0], scale: 1.9, rotationY: 0,
    doorOffset: [16.0, 0.05, 11.0], size: [4, 3.6, 3.6], color: 0xf4f7fb, roofColor: 0x74b8d8,
    windows: [
      { pos: [0, 1.0, 1.01] },
    ],
  },
  {
    id: 'house_a', modelKey: 'building_B', label: 'Nhà Minh', pos: [11.0, 0, 15.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 18.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0x44aa44,
    windows: [{ pos: [0, 0.7, 1.01] }],
  },
  {
    id: 'house_b', modelKey: 'building_C', label: 'Nhà Lan', pos: [17.0, 0, 15.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 18.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0x4488cc,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_c', modelKey: 'building_D', label: 'Nhà Hà', pos: [11.0, 0, 22.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 25.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0xcc8844,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_d', modelKey: 'building_B', label: 'Nhà An', pos: [17.0, 0, 22.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 25.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0xb96fd8,
    windows: [{ pos: [0, 0.7, 1.01] }],
  },
  {
    id: 'house_e', modelKey: 'building_C', label: 'Nhà Khôi', pos: [11.0, 0, 65.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 68.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0x6688aa,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_f', modelKey: 'building_D', label: 'Nhà Vy', pos: [17.0, 0, 65.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 68.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0xd86fa1,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_g', modelKey: 'building_B', label: 'Nhà Bảo', pos: [11.0, 0, 73.0], scale: 1.9, rotationY: 0,
    doorOffset: [0, 0.05, 76.0], size: [3.2, 4, 3.2], color: 0xf5f0e8, roofColor: 0x777777,
    windows: [{ pos: [0, 0.7, 1.01] }],
  },
  {
    id: 'market', modelKey: 'building_E', label: 'Khu chợ', pos: [54.0, 0, 78.0], scale: 2.9, rotationY: 0,
    doorOffset: [54.0, 0.05, 81.0], size: [9, 5, 6], color: 0xf0f0f0,
    windows: [{ pos: [0, 1.1, 1.01] }],
  },
  {
    id: 'cafe', modelKey: 'building_F', label: 'Quán cà phê', pos: [62.0, 0, 78.0], scale: 2.4, rotationY: 0,
    doorOffset: [62.0, 0.05, 81.0], size: [6, 4, 5], color: 0xd4a574,
    windows: [{ pos: [0, 1.1, 1.01] }],
  },
  {
    id: 'restaurant', modelKey: 'building_F', label: 'Quán ăn gia đình', pos: [54.0, 0, 70.0], scale: 2.3, rotationY: 0,
    doorOffset: [54.0, 0.05, 73.0], size: [6, 4, 4], color: 0xe8b06f, roofColor: 0xb85f48,
    windows: [{ pos: [0, 1.0, 1.01] }],
  },
  {
    id: 'museum', modelKey: 'building_H', label: 'Nhà văn hóa', pos: [52.0, 0, 19.0], scale: 2.6, rotationY: 180,
    doorOffset: [52.0, 0.05, 16.0], size: [6.5, 4.5, 4.5], color: 0xe8e8e8,
    windows: [{ pos: [0, 1.4, -1.01] }],
  },
  {
    id: 'user_home', modelKey: 'building_G', label: 'Nhà người chơi', pos: [16.0, 0, 80.0], scale: 2.1, rotationY: 0,
    doorOffset: [0, 0.05, 83.0], size: [3.6, 4.6, 3.6], color: 0xf5f0e8, roofColor: 0xddaa44,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
]

const GRASS_COLOR    = 0x7ec850
const SIDEWALK_COLOR = 0xc4b8a8
const PLAZA_COLOR    = 0xe8dcc8
const ROAD_COLOR     = 0x505050
const DIRT_COLOR     = 0xb89968
const SKY_COLOR      = 0x87ceeb

export interface TownLightingRefs {
  ambient: THREE.AmbientLight
  directional: THREE.DirectionalLight
  hemisphere: THREE.HemisphereLight
  streetLightPoints: THREE.PointLight[]
  windowLights: THREE.PointLight[]
}

export class TownBuilder {
  private scene: THREE.Scene
  private doorMarkers: Map<string, THREE.Mesh> = new Map()
  private townGroup = new THREE.Group()
  private lightingRefs: TownLightingRefs | null = null
  private collisionObstacles: CollisionObstacle[] = []
  private trafficLightRefs: TrafficLightRefs | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  getLightingRefs(): TownLightingRefs | null {
    return this.lightingRefs
  }

  getTrafficLightRefs(): TrafficLightRefs | null {
    return this.trafficLightRefs
  }

  build(assets: AssetLoader): void {
    this.collisionObstacles = []
    this.townGroup.name = 'town'
    this.scene.add(this.townGroup)

    this.buildSkyAndFog()
    this.buildLighting()
    this.buildGround()
    // Location zones are kept in data for AI/logging, but not rendered as debug squares.
    this.buildBuildings(assets)
    this.buildPlaceSigns()
    this.buildStreetLights(assets)
    this.buildTrees(assets)
    this.buildBenches(assets)
    this.buildFountain(assets)
    this.buildFlowerBeds()
    this.buildFireHydrants(assets)
    this.buildTrafficLights()
    this.buildRoadSigns()
  }

  getDoorMarker(buildingId: string): THREE.Mesh | undefined {
    return this.doorMarkers.get(buildingId)
  }

  getDoorMarkers(): Map<string, THREE.Mesh> {
    return this.doorMarkers
  }

  getCollisionObstacles(): CollisionObstacle[] {
    return [...this.collisionObstacles]
  }

  clear(): void {
    this.townGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach(m => m.dispose())
        else mat.dispose()
      } else if (obj instanceof THREE.Sprite) {
        const mat = obj.material
        if (mat.map) mat.map.dispose()
        mat.dispose()
      } else if (obj instanceof THREE.LineSegments) {
        obj.geometry.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach(m => m.dispose())
        else mat.dispose()
      }
    })
    this.scene.remove(this.townGroup)
    this.townGroup = new THREE.Group()
    this.doorMarkers.clear()
    this.collisionObstacles = []
    this.trafficLightRefs = null
  }

  /* ───── Helpers ───── */

  private enableShadows(obj: THREE.Object3D): void {
    obj.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }

  private placeModel(
    model: THREE.Group,
    x: number, y: number, z: number,
    scale: number,
    rotationY = 0,
  ): void {
    model.position.set(x, y, z)
    model.scale.setScalar(scale)
    model.rotation.y = rotationY
    this.enableShadows(model)
    this.townGroup.add(model)
  }

  /* ───────── Sky & Fog ───────── */

  private buildSkyAndFog(): void {
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, 70, 150)
  }

  /* ───────── Lighting ───────── */

  private buildLighting(): void {
    const ambient = new THREE.AmbientLight(0xc8d8f0, 0.6)
    this.townGroup.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff8e8, 1.0)
    dir.position.set(40, 40, -20)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -70
    dir.shadow.camera.right = 70
    dir.shadow.camera.top = 70
    dir.shadow.camera.bottom = -70
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 150
    dir.shadow.bias = -0.001
    this.townGroup.add(dir)

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a6020, 0.35)
    this.townGroup.add(hemi)

    this.lightingRefs = {
      ambient,
      directional: dir,
      hemisphere: hemi,
      streetLightPoints: [],
      windowLights: [],
    }
  }

  /* ───────── Ground ───────── */

  private buildGround(): void {
    const grassMat = new THREE.MeshLambertMaterial({ color: GRASS_COLOR })
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: SIDEWALK_COLOR })
    const plazaMat = new THREE.MeshLambertMaterial({ color: PLAZA_COLOR })
    const roadMat = new THREE.MeshLambertMaterial({ color: ROAD_COLOR })
    const dirtMat = new THREE.MeshLambertMaterial({ color: DIRT_COLOR })
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff })

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 88), grassMat)
    grass.rotation.x = -Math.PI / 2
    grass.position.set(40, 0, 44)
    grass.receiveShadow = true
    this.townGroup.add(grass)

    const sidewalkPositions: [number, number, number, number, number][] = [
      [31, 0.05, 44, 1.4, 80],
      [49, 0.05, 44, 1.4, 80],
      [42, 0.05, 35, 68, 1.4],
      [42, 0.05, 53, 68, 1.4],
    ]
    const swGeo = new THREE.PlaneGeometry(1, 1)
    for (const [x, y, z, w, d] of sidewalkPositions) {
      const sw = new THREE.Mesh(swGeo, sidewalkMat)
      sw.rotation.x = -Math.PI / 2
      sw.scale.set(w, d, 1)
      sw.position.set(x, y, z)
      sw.receiveShadow = true
      this.townGroup.add(sw)
    }

    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), plazaMat)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(76, 0.05, 24)
    plaza.receiveShadow = true
    this.townGroup.add(plaza)

    const roads: Array<{ x: number; z: number; w: number; d: number }> = [
      { x: 40, z: 44, w: 16, d: 80 },
      { x: 42, z: 44, w: 68, d: 16 },
    ]
    for (const def of roads) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d), roadMat)
      road.rotation.x = -Math.PI / 2
      road.position.set(def.x, 0.06, def.z)
      road.receiveShadow = true
      this.townGroup.add(road)
    }

    const vDashGeo = new THREE.PlaneGeometry(0.15, 3)
    for (const z of [8, 14, 20, 26, 32, 54, 60, 66, 72, 78]) {
      const line = new THREE.Mesh(vDashGeo, whiteMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(40, 0.065, z)
      this.townGroup.add(line)
    }

    const hDashGeo = new THREE.PlaneGeometry(3, 0.15)
    for (const x of [10, 16, 22, 28, 52, 58, 64, 70]) {
      const line = new THREE.Mesh(hDashGeo, whiteMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(x, 0.065, 44)
      this.townGroup.add(line)
    }

    const crossGeo = new THREE.PlaneGeometry(0.3, 2)
    for (const [cx, cz, horizontal] of [
      [40, 34, true], [40, 50, true], [30, 44, false], [50, 44, false],
    ] as Array<[number, number, boolean]>) {
      for (let i = 0; i < 16; i++) {
        const stripe = new THREE.Mesh(crossGeo, whiteMat)
        stripe.rotation.x = -Math.PI / 2
        if (horizontal) {
          stripe.position.set(cx + i * 1.0 - 8, 0.065, cz)
        } else {
          stripe.rotation.z = Math.PI / 2
          stripe.position.set(cx, 0.065, cz + i * 1.0 - 8)
        }
        this.townGroup.add(stripe)
      }
    }

    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), dirtMat)
    dirt.rotation.x = -Math.PI / 2
    dirt.position.set(66, 0.01, 24)
    dirt.receiveShadow = true
    // this.townGroup.add(dirt)
  }

  /* ───────── Buildings ───────── */

  private buildLocationZones(): void {
    // No-op: zone geometry is intentionally hidden from the player-facing map.
  }

  private buildBuildings(assets: AssetLoader): void {
    const doorGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8)
    const doorMat = new THREE.MeshLambertMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.4,
      emissive: 0x00ffaa,
      emissiveIntensity: 0.5,
    })

    for (const def of BUILDINGS) {
      const [bx, , bz] = def.pos
      const [width, , depth] = def.size
      this.collisionObstacles.push({
        type: 'box',
        id: `building_${def.id}`,
        minX: bx - width / 2,
        maxX: bx + width / 2,
        minZ: bz - depth / 2,
        maxZ: bz + depth / 2,
      })

      const model = assets.getBuildingModel(def.modelKey)
      if (model) {
        this.placeModel(model, bx, 0, bz, def.scale, def.rotationY)

        if (def.windows && this.lightingRefs) {
          for (const win of def.windows) {
            const pl = new THREE.PointLight(0xffe0a0, 0, 4, 2)
            pl.position.set(...win.pos)
            model.add(pl)
            this.lightingRefs.windowLights.push(pl)
          }
        }
      } else {
        const [w, h, d] = def.size
        const bodyMat = new THREE.MeshLambertMaterial({ color: def.color })
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat)
        body.position.set(bx, h / 2, bz)
        body.castShadow = true
        body.receiveShadow = true
        this.townGroup.add(body)

        if (def.roofColor !== undefined) {
          const roofMat = new THREE.MeshLambertMaterial({ color: def.roofColor })
          const roofW = w + 0.4
          const roofD = d + 0.4
          const roofH = 1.2
          const roof = new THREE.Mesh(new THREE.BoxGeometry(roofW, roofH, roofD), roofMat)
          roof.position.set(bx, h + roofH / 2 - 0.1, bz)
          roof.castShadow = true
          this.townGroup.add(roof)

          const ridgeMat = new THREE.MeshLambertMaterial({ color: def.roofColor })
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(roofW * 0.3, 0.5, roofD + 0.2), ridgeMat)
          ridge.position.set(bx, h + roofH + 0.15, bz)
          ridge.castShadow = true
          this.townGroup.add(ridge)
        }
      }

      const [dx, dy, dz] = def.doorOffset
      const door = new THREE.Mesh(doorGeo, doorMat)
      door.position.set(dx === 0 ? bx : dx, dy, dz)
      door.name = `door_${def.id}`
      this.townGroup.add(door)
      this.doorMarkers.set(def.id, door)
    }
  }

  /* ───────── Place Signs ───────── */

  private buildPlaceSigns(): void {
    for (const def of BUILDINGS) {
      const [dx, , dz] = def.doorOffset
      const x = dx === 0 ? def.pos[0] : dx
      const height = Math.max(2.4, Math.min(5.6, def.size[1] + 0.9))
      this.addPlaceSign(def.label, x, dz, height)
    }

    this.addPlaceSign('Quảng trường', 76, 20.0, 2.6, 0x2f6f68)
    this.addPlaceSign('Công viên', 66, 20.6, 2.4, 0x2f6f48)
  }

  private addPlaceSign(label: string, x: number, z: number, y: number, accent = 0x2f5f8f): void {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x4b5563 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, Math.max(1.2, y - 0.35), 6), poleMat)
    pole.position.set(x, (y - 0.35) / 2, z)
    pole.castShadow = true
    this.townGroup.add(pole)

    const sprite = this.createSignSprite(label, accent)
    sprite.position.set(x, y, z)
    sprite.scale.set(2.9, 0.85, 1)
    sprite.renderOrder = 20
    this.townGroup.add(sprite)
  }

  private createSignSprite(label: string, accent: number, width = 512, height = 160): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const accentColor = `#${accent.toString(16).padStart(6, '0')}`
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(18, 24, 32, 0.92)'
    this.roundRect(ctx, 10, 10, width - 20, height - 20, 22)
    ctx.fill()
    ctx.lineWidth = 10
    ctx.strokeStyle = accentColor
    ctx.stroke()

    ctx.fillStyle = accentColor
    ctx.fillRect(28, 30, 12, height - 60)

    const lines = label.split('\n')
    const titleOnly = lines.length === 1
    ctx.fillStyle = '#fff7dc'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = titleOnly
      ? '800 50px "Segoe UI", Arial, sans-serif'
      : '800 38px "Segoe UI", Arial, sans-serif'

    if (titleOnly) {
      this.fitFillText(ctx, lines[0], width / 2 + 14, height / 2, width - 92)
    } else {
      ctx.fillText(lines[0], width / 2 + 16, 48)
      ctx.font = '700 28px "Segoe UI", Arial, sans-serif'
      ctx.textAlign = 'left'
      for (let i = 1; i < lines.length; i++) {
        ctx.fillText(lines[i], 64, 88 + (i - 1) * 44)
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    return new THREE.Sprite(mat)
  }

  private fitFillText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y)
      return
    }
    let next = text
    while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
      next = next.slice(0, -1)
    }
    ctx.fillText(`${next}...`, x, y)
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  /* ───────── Street Lights ───────── */

  private buildStreetLights(assets: AssetLoader): void {
    const DEG = Math.PI / 180

    const lightDefs: Array<{ x: number; z: number; rotY: number }> = [
      { x: 31, z: 8,  rotY: -180 * DEG },
      { x: 31, z: 16, rotY: -180 * DEG },
      { x: 31, z: 24, rotY: -180 * DEG },
      { x: 31, z: 32, rotY: -180 * DEG },
      { x: 31, z: 52, rotY: -180 * DEG },
      { x: 31, z: 60, rotY: -180 * DEG },
      { x: 31, z: 68, rotY: -180 * DEG },
      { x: 31, z: 76, rotY: -180 * DEG },
      { x: 49, z: 8,  rotY: 0 },
      { x: 49, z: 16, rotY: 0 },
      { x: 49, z: 24, rotY: 0 },
      { x: 49, z: 32, rotY: 0 },
      { x: 49, z: 52, rotY: 0 },
      { x: 49, z: 60, rotY: 0 },
      { x: 49, z: 68, rotY: 0 },
      { x: 49, z: 76, rotY: 0 },
      { x: 14, z: 35, rotY: 90 * DEG },
      { x: 22, z: 35, rotY: 90 * DEG },
      { x: 30, z: 35, rotY: 90 * DEG },
      { x: 50, z: 35, rotY: 90 * DEG },
      { x: 58, z: 35, rotY: 90 * DEG },
      { x: 66, z: 35, rotY: 90 * DEG },
      { x: 14, z: 53, rotY: -90 * DEG },
      { x: 22, z: 53, rotY: -90 * DEG },
      { x: 30, z: 53, rotY: -90 * DEG },
      { x: 50, z: 53, rotY: -90 * DEG },
      { x: 58, z: 53, rotY: -90 * DEG },
      { x: 66, z: 53, rotY: -90 * DEG },
    ]

    const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 })
    const bulbMat = new THREE.MeshLambertMaterial({
      color: 0xffee88,
      emissive: 0xffdd44,
      emissiveIntensity: 0.6,
    })
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3, 6)
    const bulbGeo = new THREE.SphereGeometry(0.15, 6, 6)

    for (const def of lightDefs) {
      const rotY = def.rotY
      this.collisionObstacles.push({
        type: 'circle',
        id: `streetlight_${def.x}_${def.z}`,
        x: def.x,
        z: def.z,
        radius: 0.16,
      })

      const model = assets.getPropModel('streetlight')
      if (model) {
        this.placeModel(model, def.x, 0, def.z, 3.5, rotY)

        if (this.lightingRefs) {
          const pl = new THREE.PointLight(0xffe4b0, 0, 12, 2)
          pl.position.set(-0.22, 0.82, 0)
          model.add(pl)
          this.lightingRefs.streetLightPoints.push(pl)
        }
      } else {
        const pole = new THREE.Mesh(poleGeo, poleMat)
        pole.position.set(def.x, 1.5, def.z)
        pole.castShadow = true
        this.townGroup.add(pole)

        const bulb = new THREE.Mesh(bulbGeo, bulbMat)
        bulb.position.set(def.x, 3.15, def.z)
        this.townGroup.add(bulb)

        if (this.lightingRefs) {
          const pl = new THREE.PointLight(0xffe4b0, 0, 8, 2)
          pl.position.set(def.x, 3.15, def.z)
          this.townGroup.add(pl)
          this.lightingRefs.streetLightPoints.push(pl)
        }
      }
    }
  }

  /* ───────── Trees ───────── */

  private buildTrees(assets: AssetLoader): void {
    type TreeSize = 0 | 1 | 2
    const treePositions: Array<[number, number, TreeSize]> = [
      // West residential block
      [5.5, 10, 0], [21.5, 10, 0], [5.5, 19, 0], [21.5, 19, 0], [13.5, 6, 0],
      [24, 8, 0], [28, 12, 2], [25, 20, 0], [28, 24, 0], [28, 30, 0], [25, 34, 0],
      [24, 56, 0], [28, 62, 2], [25, 70, 0], [28, 80, 0],
      [5.5, 68, 0], [21.5, 68, 0], [5.5, 76, 0], [21.5, 76, 0], [13.5, 61, 0],
      // North center (park / museum / office)
      [50.5, 16, 1], [60.5, 13, 0], [58.5, 17, 1], [50.5, 26, 0],
      [63.5, 22.5, 0], [68.5, 22.5, 0], [63.5, 25.5, 0], [68.5, 25.5, 0],
      [53, 31, 1], [57, 31, 0], [61, 32, 1], [68, 32, 0], [73, 31, 0],
      [70, 6, 2], [71, 17, 0],
      // South band (market / cafe / restaurant)
      [50.5, 66, 1], [58.5, 66, 1], [76.5, 66, 1], [50.5, 74, 1], [76.5, 74, 1], [70, 61.5, 1],
      [52, 58, 2], [60, 58, 0], [68, 59, 0], [74, 60, 0],
      [52, 63, 0], [60, 64, 0], [68, 64, 0], [74, 63, 0],
      // Fringe
      [6, 30, 0], [79, 58, 0],
    ]

    const SIZE_RADIUS = [0.48, 0.68, 0.95]
    const SIZE_SCALE = [5.0, 7.0, 9.5]
    const CROWN_RADIUS = [0.5, 0.8, 1.25]
    const TRUNK_H = [1.5, 1.5, 2.2]

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 })
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x55aa33 })
    const darkCrownMat = new THREE.MeshLambertMaterial({ color: 0x338822 })
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6)

    for (const [x, z, size] of treePositions) {
      this.collisionObstacles.push({
        type: 'circle',
        id: `tree_${x}_${z}`,
        x,
        z,
        radius: SIZE_RADIUS[size],
      })
      const model = assets.getPropModel('bush')
      if (model) {
        this.placeModel(model, x, 0, z, SIZE_SCALE[size])
      } else {
        const trunkH = TRUNK_H[size]
        const trunk = new THREE.Mesh(trunkGeo, trunkMat)
        trunk.scale.set(1, trunkH / 1.5, 1)
        trunk.position.set(x, trunkH / 2, z)
        trunk.castShadow = true
        this.townGroup.add(trunk)

        const mat = size === 0 ? darkCrownMat : crownMat
        const crown = new THREE.Mesh(new THREE.SphereGeometry(CROWN_RADIUS[size], 6, 5), mat)
        crown.position.set(x, trunkH + 0.4, z)
        crown.castShadow = true
        this.townGroup.add(crown)
      }
    }
  }

  /* ───────── Benches ───────── */

  private buildBenches(assets: AssetLoader): void {
    const plazaBenches: [number, number, number][] = [
      [73, 0, 22.5], [73, 0, 25.5],
    ]
    const parkBenches: [number, number, number][] = [
      [63, 0, 24], [69, 0, 24], [52, 0, 26], [58, 0, 26],
    ]

    const seatMat = new THREE.MeshLambertMaterial({ color: 0x8b6c42 })
    const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 })
    const seatGeo = new THREE.BoxGeometry(1.2, 0.08, 0.4)
    const legGeo = new THREE.BoxGeometry(0.06, 0.35, 0.06)
    const backGeo = new THREE.BoxGeometry(1.2, 0.5, 0.06)

    for (const [x, , z] of [...plazaBenches, ...parkBenches]) {
      this.collisionObstacles.push({
        type: 'box',
        id: `bench_${x}_${z}`,
        minX: x - 0.65,
        maxX: x + 0.65,
        minZ: z - 0.25,
        maxZ: z + 0.25,
      })
      const model = assets.getPropModel('bench')
      if (model) {
        this.placeModel(model, x, 0, z, 6.0)
      } else {
        const seat = new THREE.Mesh(seatGeo, seatMat)
        seat.position.set(x, 0.4, z)
        seat.castShadow = true
        this.townGroup.add(seat)

        const back = new THREE.Mesh(backGeo, seatMat)
        back.position.set(x, 0.65, z - 0.17)
        back.castShadow = true
        this.townGroup.add(back)

        for (const ox of [-0.5, 0.5]) {
          for (const oz of [-0.12, 0.12]) {
            const leg = new THREE.Mesh(legGeo, legMat)
            leg.position.set(x + ox, 0.175, z + oz)
            this.townGroup.add(leg)
          }
        }
      }
    }
  }

  /* ───────── Fountain ───────── */

  private buildFountain(assets: AssetLoader): void {
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb })
    this.collisionObstacles.push({
      type: 'circle',
      id: 'plaza_fountain',
      x: 76,
      z: 24,
      radius: 1.4,
    })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 12), stoneMat)
    base.position.set(76, 0.15, 24)
    base.castShadow = true
    base.receiveShadow = true
    this.townGroup.add(base)

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 12), stoneMat)
    wall.position.set(76, 0.55, 24)
    this.townGroup.add(wall)

    const capybara = assets.getPropModel('capybara')
    if (capybara) {
      capybara.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return
        const mats = Array.isArray((child as THREE.Mesh).material)
          ? (child as THREE.Mesh).material as THREE.MeshStandardMaterial[]
          : [(child as THREE.Mesh).material as THREE.MeshStandardMaterial]
        for (const mat of mats) {
          if (mat.color) {
            const hsl = { h: 0, s: 0, l: 0 }
            mat.color.getHSL(hsl)
            mat.color.setHSL(hsl.h, Math.min(hsl.s * 1.6, 1.0), hsl.l)
          }
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
          mat.roughness = Math.max((mat.roughness ?? 1) * 0.75, 0.35)
        }
      })
      const box = new THREE.Box3().setFromObject(capybara)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const targetSize = 4.0
      const scale = maxDim > 0 ? targetSize / maxDim : 8.0
      const yOffset = -box.min.y * scale
      this.placeModel(capybara, 76, 0.8 + yOffset, 24, scale)
    }
  }

  private buildFlowerBeds(): void {
    const flowerColors = [0xff6688, 0xffaa33, 0xff44aa, 0xaa44ff, 0xffff44]
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x44882c })
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4)
    const petalGeo = new THREE.SphereGeometry(0.08, 5, 4)

    const bedCenters: [number, number][] = [
      [62.8, 24.0], [69.2, 24.0], [72.6, 24.0], [79.4, 24.0],
      [50.5, 14.5], [57.5, 14.5],
      [56.0, 34.0], [52.0, 54.0], [64.0, 54.0],
      [5.0, 12.5], [5.0, 17.5], [21.5, 12.5], [21.5, 17.5],
      [5.0, 63.5], [5.0, 70.5], [21.5, 63.5], [21.5, 70.5],
    ]

    for (const [cx, cz] of bedCenters) {
      for (let i = 0; i < 5; i++) {
        const fx = cx + (Math.random() - 0.5) * 1.2
        const fz = cz + (Math.random() - 0.5) * 1.2
        const colorIdx = (cx * 7 + cz * 3 + i) % flowerColors.length

        const stem = new THREE.Mesh(stemGeo, stemMat)
        stem.position.set(fx, 0.125, fz)
        this.townGroup.add(stem)

        const petalMat = new THREE.MeshLambertMaterial({
          color: flowerColors[colorIdx],
          emissive: flowerColors[colorIdx],
          emissiveIntensity: 0.15,
        })
        const petal = new THREE.Mesh(petalGeo, petalMat)
        petal.position.set(fx, 0.28, fz)
        this.townGroup.add(petal)
      }
    }
  }

  /* ───────── Fire Hydrants ───────── */

  private buildFireHydrants(assets: AssetLoader): void {
    const positions: [number, number][] = [
      [22.6, 12],
      [22.6, 66],
      [49.4, 12],
      [49.4, 66],
      [14, 35.6],
      [66, 35.6],
      [14, 52.4],
      [66, 52.4],
    ]

    for (const [x, z] of positions) {
      const model = assets.getPropModel('firehydrant')
      if (model) {
        this.collisionObstacles.push({
          type: 'circle',
          id: `firehydrant_${x}_${z}`,
          x,
          z,
          radius: 0.2,
        })
        this.placeModel(model, x, 0, z, 3.5)
      }
    }
  }

  /* ───────── Traffic Lights ───────── */

  private buildTrafficLights(): void {
    const makeBulb = (color: number) => new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.08,
    })
    const ns = { red: makeBulb(0xff2020), yellow: makeBulb(0xffcc00), green: makeBulb(0x20d060) }
    const ew = { red: makeBulb(0xff2020), yellow: makeBulb(0xffcc00), green: makeBulb(0x20d060) }
    this.trafficLightRefs = { ns, ew }

    const housingMat = new THREE.MeshLambertMaterial({ color: 0x222a33 })
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x4b5563 })
    const armMat = new THREE.MeshLambertMaterial({ color: 0x374151 })
    const capMat = new THREE.MeshLambertMaterial({ color: 0x111111 })
    const housingGeo = new THREE.BoxGeometry(0.9, 1.5, 0.3)
    const bulbGeo = new THREE.SphereGeometry(0.13, 10, 8)
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.4, 8)
    const capGeo = new THREE.SphereGeometry(0.24, 8, 6)

    const addSignalHead = (
      x: number,
      z: number,
      bulbs: typeof ns,
      rotY: number,
    ): void => {
      const head = new THREE.Group()
      const housing = new THREE.Mesh(housingGeo, housingMat)
      housing.castShadow = true
      head.add(housing)

      const cap = new THREE.Mesh(capGeo, capMat)
      cap.position.set(0, 0.85, 0)
      head.add(cap)

      const bulbsDef: Array<[number, THREE.MeshLambertMaterial]> = [
        [0.5, bulbs.red],
        [0, bulbs.yellow],
        [-0.5, bulbs.green],
      ]
      for (const [dy, mat] of bulbsDef) {
        const bulb = new THREE.Mesh(bulbGeo, mat)
        bulb.position.set(0, dy, 0.17)
        head.add(bulb)
      }

      head.position.set(x, 3.2, z)
      head.rotation.y = rotY
      this.townGroup.add(head)
    }

    const addSignalPost = (px: number, pz: number, hx: number, hz: number): void => {
      this.collisionObstacles.push({
        type: 'circle',
        id: `trafficlight_${px}_${pz}`,
        x: px,
        z: pz,
        radius: 0.16,
      })
      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.set(px, 1.7, pz)
      pole.castShadow = true
      this.townGroup.add(pole)

      const dx = hx - px
      const dz = hz - pz
      const len = Math.max(0.01, Math.hypot(dx, dz))
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, len), armMat)
      arm.position.set((px + hx) / 2, 3.2, (pz + hz) / 2)
      arm.rotation.y = Math.atan2(dx, dz)
      arm.castShadow = true
      this.townGroup.add(arm)
    }

    // Southbound (north approach, signal faces -z)
    addSignalPost(51, 31.5, 44, 34)
    addSignalHead(44, 34, ns, Math.PI)
    // Northbound (south approach, signal faces +z)
    addSignalPost(29, 52.5, 36, 50)
    addSignalHead(36, 50, ns, 0)
    // Eastbound (west approach, signal faces -x)
    addSignalPost(31.5, 35, 30, 48)
    addSignalHead(30, 48, ew, -Math.PI / 2)
    // Westbound (east approach, signal faces +x)
    addSignalPost(48.5, 53, 50, 40)
    addSignalHead(50, 40, ew, Math.PI / 2)
  }

  /* ───────── Road Signs ───────── */

  private addRoadSign(kind: 'stop' | 'speed30' | 'lightAhead', x: number, z: number): void {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x4b5563 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), poleMat)
    pole.position.set(x, 1.1, z)
    pole.castShadow = true
    this.townGroup.add(pole)

    const sprite = this.createRoadSignSprite(kind)
    sprite.position.set(x, 2.7, z)
    sprite.scale.set(1.05, 1.05, 1)
    sprite.renderOrder = 20
    this.townGroup.add(sprite)

    this.collisionObstacles.push({
      type: 'circle',
      id: `roadsign_${kind}_${x}_${z}`,
      x,
      z,
      radius: 0.15,
    })
  }

  private buildRoadSigns(): void {
    // All signs stand on the sidewalks, never on the road surface.
    // Vertical road (x 32-48): west sidewalk x=30.9, east sidewalk x=49.1
    this.addRoadSign('speed30', 30.9, 12)
    this.addRoadSign('speed30', 49.1, 76)
    // Horizontal road (z 36-52): north sidewalk z=35.4, south sidewalk z=52.6
    this.addRoadSign('stop', 30.0, 35.4)
    this.addRoadSign('stop', 50.0, 52.6)
    this.addRoadSign('lightAhead', 30.9, 22)
    this.addRoadSign('lightAhead', 49.1, 68)
  }

  private createRoadSignSprite(kind: 'stop' | 'speed30' | 'lightAhead'): THREE.Sprite {
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    const c = size / 2
    const r = size * 0.4

    if (kind === 'stop') {
      ctx.fillStyle = '#d83a2f'
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const ang = Math.PI / 8 + (i * 2 * Math.PI) / 8
        const px = c + Math.cos(ang) * r
        const py = c + Math.sin(ang) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 10
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 54px "Segoe UI", Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('STOP', c, c + 4)
    } else if (kind === 'speed30') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 12
      ctx.strokeStyle = '#d83a2f'
      ctx.stroke()
      ctx.fillStyle = '#111111'
      ctx.font = '900 96px "Segoe UI", Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('30', c, c + 6)
    } else {
      ctx.fillStyle = '#f5c91a'
      ctx.beginPath()
      ctx.moveTo(c, c - r)
      ctx.lineTo(c + r, c)
      ctx.lineTo(c, c + r)
      ctx.lineTo(c - r, c)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 10
      ctx.strokeStyle = '#111111'
      ctx.stroke()
      const ly = c - 44
      ctx.fillStyle = '#111111'
      ctx.fillRect(c - 26, ly - 34, 52, 92)
      for (const [color, y] of [['#ff2d20', ly - 16], ['#ffc200', ly + 4], ['#22c55e', ly + 24]] as Array<[string, number]>) {
        ctx.beginPath()
        ctx.arc(c, y, 13, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    return new THREE.Sprite(mat)
  }
}
