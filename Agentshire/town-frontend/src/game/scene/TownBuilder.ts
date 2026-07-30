import * as THREE from 'three'
import { AssetLoader } from '../visual/AssetLoader'
import type { CollisionObstacle } from '../physics/CollisionWorld'

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
    id: 'office', modelKey: 'building_A', label: 'Công ty chính', pos: [24.4, 0, 6.75], scale: 3.0, rotationY: 0,
    doorOffset: [0, 0.05, 13.0], size: [8, 12, 6], color: 0x6688aa,
    windows: [
      { pos: [0, 0.95, 1.01] },
    ],
  },
  {
    id: 'coworking', modelKey: 'building_A', label: 'Văn phòng nhỏ', pos: [32.8, 0, 6.75], scale: 1.8, rotationY: 0,
    doorOffset: [31.6, 0.05, 10.5], size: [4, 5, 4], color: 0x6f9fbd,
    windows: [
      { pos: [0, 1.0, 1.01] },
    ],
  },
  {
    id: 'clinic', modelKey: 'building_H', label: 'Phòng khám', pos: [17.2, 0, 6.75], scale: 1.6, rotationY: 0,
    doorOffset: [17.2, 0.05, 9.25], size: [3.5, 3.2, 3], color: 0xf4f7fb, roofColor: 0x74b8d8,
    windows: [
      { pos: [0, 1.0, 1.01] },
    ],
  },
  {
    id: 'house_a', modelKey: 'building_B', label: 'Nhà Minh, An & Bảo', pos: [7.6, 0, 9.25], scale: 1.8, rotationY: 0,
    doorOffset: [0, 0.05, 7.5], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0x44aa44,
    windows: [
      { pos: [0, 0.7, 1.01] },
    ],
  },
  {
    id: 'house_b', modelKey: 'building_C', label: 'Nhà Lan & Khôi', pos: [7.6, 0, 15.5], scale: 1.8, rotationY: 0,
    doorOffset: [0, 0.05, 13.0], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0x4488cc,
    windows: [
      { pos: [0, 0.95, 1.01] },
    ],
  },
  {
    id: 'house_c', modelKey: 'building_D', label: 'Nhà Hà & Vy', pos: [7.6, 0, 21.75], scale: 1.8, rotationY: 0,
    doorOffset: [0, 0.05, 18.5], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0xcc8844,
    windows: [
      { pos: [0, 0.95, 1.01] },
    ],
  },
  {
    id: 'market', modelKey: 'building_E', label: 'Khu chợ', pos: [42.4, 0, 6.75], scale: 2.5, rotationY: 0,
    doorOffset: [0, 0.05, 10.5], size: [8, 4, 5], color: 0xf0f0f0,
    windows: [
      { pos: [0, 1.1, 1.01] },
    ],
  },
  {
    id: 'cafe', modelKey: 'building_F', label: 'Quán cà phê', pos: [42.4, 0, 14.25], scale: 2.0, rotationY: 0,
    doorOffset: [0, 0.05, 18.0], size: [5, 3, 4], color: 0xd4a574,
    windows: [
      { pos: [0, 1.1, 1.01] },
    ],
  },
  {
    id: 'user_home', modelKey: 'building_G', label: 'Nhà người chơi', pos: [7.6, 0, 28.0], scale: 1.8, rotationY: 0,
    doorOffset: [0, 0.05, 30.5], size: [3, 4, 3], color: 0xf5f0e8, roofColor: 0xddaa44,
    windows: [
      { pos: [0, 0.95, 1.01] },
    ],
  },
  {
    id: 'museum', modelKey: 'building_H', label: 'Nhà văn hóa', pos: [42.4, 0, 21.75], scale: 2.5, rotationY: 0,
    doorOffset: [0, 0.05, 25.5], size: [6, 4, 5], color: 0xe8e8e8,
    windows: [
      { pos: [0, 1.4, 1.01] },
    ],
  },
  {
    id: 'restaurant', modelKey: 'building_F', label: 'Quán ăn gia đình', pos: [42.4, 0, 29.25], scale: 1.9, rotationY: 0,
    doorOffset: [42.4, 0.05, 26.75], size: [5, 3, 3], color: 0xe8b06f, roofColor: 0xb85f48,
    windows: [
      { pos: [0, 1.0, 1.01] },
    ],
  },
]

const HOUSE_OVERRIDES: Record<string, Partial<BuildingDef>> = {
  house_a: { label: 'Nhà Minh', pos: [6.0, 0, 5.0], scale: 1.55 },
  house_b: { label: 'Nhà Lan', pos: [6.0, 0, 10.5], scale: 1.55 },
  house_c: { label: 'Nhà Hà', pos: [6.0, 0, 16.0], scale: 1.55 },
}

for (const def of BUILDINGS) {
  Object.assign(def, HOUSE_OVERRIDES[def.id])
}

BUILDINGS.splice(6, 0,
  {
    id: 'house_d', modelKey: 'building_B', label: 'Nhà An', pos: [6.0, 0, 21.5], scale: 1.55, rotationY: 0,
    doorOffset: [0, 0.05, 24.0], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0xb96fd8,
    windows: [{ pos: [0, 0.7, 1.01] }],
  },
  {
    id: 'house_e', modelKey: 'building_C', label: 'Nhà Khôi', pos: [14.0, 0, 21.5], scale: 1.55, rotationY: 0,
    doorOffset: [0, 0.05, 24.0], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0x6688aa,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_f', modelKey: 'building_D', label: 'Nhà Vy', pos: [14.0, 0, 16.0], scale: 1.55, rotationY: 0,
    doorOffset: [0, 0.05, 18.5], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0xd86fa1,
    windows: [{ pos: [0, 0.95, 1.01] }],
  },
  {
    id: 'house_g', modelKey: 'building_B', label: 'Nhà Bảo', pos: [14.0, 0, 10.5], scale: 1.55, rotationY: 0,
    doorOffset: [0, 0.05, 13.0], size: [2.6, 3.4, 2.6], color: 0xf5f0e8, roofColor: 0x777777,
    windows: [{ pos: [0, 0.7, 1.01] }],
  },
)

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

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  getLightingRefs(): TownLightingRefs | null {
    return this.lightingRefs
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
    this.scene.fog = new THREE.Fog(SKY_COLOR, 55, 115)
  }

  /* ───────── Lighting ───────── */

  private buildLighting(): void {
    const ambient = new THREE.AmbientLight(0xc8d8f0, 0.6)
    this.townGroup.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff8e8, 1.0)
    dir.position.set(30, 30, -10)
    dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    dir.shadow.camera.left = -42
    dir.shadow.camera.right = 42
    dir.shadow.camera.top = 42
    dir.shadow.camera.bottom = -42
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 80
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

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(56, 34), grassMat)
    grass.rotation.x = -Math.PI / 2
    grass.position.set(28, 0, 17)
    grass.receiveShadow = true
    this.townGroup.add(grass)

    const sidewalkPositions: [number, number, number, number, number][] = [
      [11.2, 0.05, 18.0, 1.7, 28.0],
      [16.0, 0.05, 18.0, 1.1, 28.0],
      [38.8, 0.05, 18.0, 1.7, 28.0],
      [28.0, 0.05, 29.0, 24.5, 1.1],
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

    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(13, 10), plazaMat)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(25.6, 0.05, 19.25)
    plaza.receiveShadow = true
    this.townGroup.add(plaza)

    const roads: Array<{ x: number; z: number; w: number; d: number }> = [
      { x: 28, z: 32, w: 56, d: 2.4 },
      { x: 16, z: 19.3, w: 2.4, d: 25.4 },
      { x: 38.8, z: 19.3, w: 2.4, d: 25.4 },
      { x: 27.4, z: 10.5, w: 24.0, d: 2.0 },
      { x: 27.4, z: 18.0, w: 24.0, d: 2.0 },
      { x: 27.4, z: 26.75, w: 24.0, d: 2.0 },
    ]
    for (const def of roads) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d), roadMat)
      road.rotation.x = -Math.PI / 2
      road.position.set(def.x, 0.06, def.z)
      road.receiveShadow = true
      this.townGroup.add(road)
    }

    const lineGeo = new THREE.PlaneGeometry(2, 0.15)
    for (let i = 0; i < 8; i++) {
      const line = new THREE.Mesh(lineGeo, whiteMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(18 + i * 3.0, 0.065, 32)
      this.townGroup.add(line)
    }

    const vLineGeo = new THREE.PlaneGeometry(0.15, 2)
    for (const x of [16, 38.8]) {
      for (let i = 0; i < 5; i++) {
        const line = new THREE.Mesh(vLineGeo, whiteMat)
        line.rotation.x = -Math.PI / 2
        line.position.set(x, 0.065, 12.2 + i * 4.2)
        this.townGroup.add(line)
      }
    }

    const crossGeo = new THREE.PlaneGeometry(0.3, 2)
    for (const [cx, cz, horizontal] of [
      [16, 18, false], [38.8, 18, false], [16, 26.75, false], [38.8, 26.75, false],
      [25.6, 32, true],
    ] as Array<[number, number, boolean]>) {
      for (let i = 0; i < 6; i++) {
        const stripe = new THREE.Mesh(crossGeo, whiteMat)
        stripe.rotation.x = -Math.PI / 2
        if (horizontal) {
          stripe.position.set(cx + i * 0.7 - 1.75, 0.065, cz)
        } else {
          stripe.rotation.z = Math.PI / 2
          stripe.position.set(cx, 0.065, cz + i * 0.7 - 1.75)
        }
        this.townGroup.add(stripe)
      }
    }

    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), dirtMat)
    dirt.rotation.x = -Math.PI / 2
    dirt.position.set(18.4, 0.01, 27.0)
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

    this.addPlaceSign('Quảng trường', 25.6, 21.5, 2.6, 0x2f6f68)
    this.addPlaceSign('Công viên', 18.4, 29.2, 2.4, 0x2f6f48)
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
      { x: 12.8, z: 7.0,  rotY: 0 },
      { x: 12.8, z: 17.0, rotY: 0 },
      { x: 12.8, z: 27.0, rotY: 0 },
      { x: 37.2, z: 8.0,  rotY: -180 * DEG },
      { x: 37.2, z: 18.0, rotY: -180 * DEG },
      { x: 37.2, z: 28.0, rotY: -180 * DEG },
      { x: 19.6, z: 14.2, rotY: 135 * DEG },
      { x: 31.6, z: 14.2, rotY: 45 * DEG },
      { x: 19.6, z: 24.0, rotY: -135 * DEG },
      { x: 31.6, z: 24.0, rotY: -45 * DEG },
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
    const treePositions: [number, number, boolean][] = [
      [12.0, 7.0, false], [12.0, 14.0, true], [12.0, 21.0, true],
      [18.8, 15.5, true], [32.4, 15.5, true], [18.8, 23.2, true], [32.4, 23.2, true],
      [36.0, 7.5, false], [36.0, 17.0, true], [36.0, 27.0, true],
      [18.4, 5.0, true], [31.6, 5.0, true],
    ]

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 })
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x55aa33 })
    const darkCrownMat = new THREE.MeshLambertMaterial({ color: 0x338822 })
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6)
    const crownGeo = new THREE.SphereGeometry(0.8, 6, 5)
    const smallCrownGeo = new THREE.SphereGeometry(0.5, 6, 5)

    for (const [x, z, small] of treePositions) {
      this.collisionObstacles.push({
        type: 'circle',
        id: `tree_${x}_${z}`,
        x,
        z,
        radius: small ? 0.48 : 0.68,
      })
      const model = assets.getPropModel('bush')
      if (model) {
        this.placeModel(model, x, 0, z, small ? 5.0 : 7.0)
      } else {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat)
        trunk.position.set(x, 0.75, z)
        trunk.castShadow = true
        this.townGroup.add(trunk)

        const geo = small ? smallCrownGeo : crownGeo
        const mat = small ? darkCrownMat : crownMat
        const crown = new THREE.Mesh(geo, mat)
        crown.position.set(x, small ? 1.9 : 2.2, z)
        crown.castShadow = true
        this.townGroup.add(crown)
      }
    }
  }

  /* ───────── Benches ───────── */

  private buildBenches(assets: AssetLoader): void {
    const plazaBenches: [number, number, number][] = [
      [22.0, 0, 16.5], [29.2, 0, 16.5], [22.0, 0, 22.0], [29.2, 0, 22.0],
    ]
    const parkBenches: [number, number, number][] = [
      // [10, 0, 19], [15, 0, 19], [10, 0, 21], [14, 0, 21],
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
      x: 25.6,
      z: 19.25,
      radius: 1.6,
    })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 12), stoneMat)
    base.position.set(25.6, 0.15, 19.25)
    base.castShadow = true
    base.receiveShadow = true
    this.townGroup.add(base)

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 12), stoneMat)
    wall.position.set(25.6, 0.55, 19.25)
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
      this.placeModel(capybara, 25.6, 0.8 + yOffset, 19.25, scale)
    }
  }

  private buildFlowerBeds(): void {
    const flowerColors = [0xff6688, 0xffaa33, 0xff44aa, 0xaa44ff, 0xffff44]
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x44882c })
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4)
    const petalGeo = new THREE.SphereGeometry(0.08, 5, 4)

    const bedCenters: [number, number][] = [
      [10, 8], [10, 16], [10, 24], [40, 8], [40, 18], [16, 27], [46, 23],
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
      [12, 30],
      [36, 30],
      [25.6, 30],
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
}
