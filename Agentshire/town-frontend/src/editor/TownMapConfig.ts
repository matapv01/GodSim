export type TerrainType = 'grass' | 'sand' | 'street' | 'plaza' | 'sidewalk' | 'water'

import { getLocale } from '../i18n'

function l(vi: string, en: string, zh: string): string {
  const locale = getLocale()
  return locale === 'vi' ? vi : locale === 'en' ? en : zh
}

export interface TerrainCell {
  type: TerrainType
  variant?: number
}

export type BuildingRole = 'office' | 'house' | 'commercial' | 'public'
export type DoorSide = 'north' | 'south' | 'east' | 'west'
export type Rotation = 0 | 90 | 180 | 270

export type LightType = 'window' | 'street' | 'vehicle_head' | 'vehicle_tail'

export interface LightPointDef {
  id: string
  offsetX: number
  offsetY: number
  offsetZ: number
  color: number
  intensity: number
  distance: number
  type: LightType
}

export interface VehicleRouteDef {
  waypoints: Array<{ x: number; z: number }>
  speedMin: number
  speedMax: number
  laneOffset: number
  loop?: boolean
  forwardAngle?: number
}

export interface BuildingPlacement {
  id: string
  modelKey: string
  modelUrl?: string
  displayName?: string
  gridX: number
  gridZ: number
  widthCells: number
  depthCells: number
  rotationY: Rotation
  scale: number
  flipX?: boolean
  flipZ?: boolean
  fixRotationX?: number
  fixRotationY?: number
  fixRotationZ?: number
  elevation?: number
  role?: BuildingRole
  doorSide: DoorSide
  lights?: LightPointDef[]
}

export interface PropPlacement {
  id: string
  modelKey: string
  modelUrl?: string
  gridX: number
  gridZ: number
  rotationY: number
  scale: number
  flipX?: boolean
  flipZ?: boolean
  fixRotationX?: number
  fixRotationY?: number
  fixRotationZ?: number
  elevation?: number
  lights?: LightPointDef[]
  animated?: boolean
  vehicleRoute?: VehicleRouteDef
}

export interface RoadPlacement {
  id: string
  modelKey: string
  modelUrl?: string
  gridX: number
  gridZ: number
  rotationY: Rotation
  flipX?: boolean
  flipZ?: boolean
  fixRotationX?: number
  fixRotationY?: number
  fixRotationZ?: number
  elevation?: number
  lights?: LightPointDef[]
}

export const LIGHT_PRESETS: Record<string, LightPointDef[]> = {
  building_A: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_B: [{ id: '', offsetX: 0, offsetY: 0.7, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_C: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_D: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_E: [{ id: '', offsetX: 0, offsetY: 1.1, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_F: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_G: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  building_H: [{ id: '', offsetX: 0, offsetY: 0.95, offsetZ: 1.01, color: 0xffe0a0, intensity: 2.0, distance: 4, type: 'window' }],
  streetlight: [{ id: '', offsetX: -0.22, offsetY: 0.82, offsetZ: 0, color: 0xffe4b0, intensity: 2.0, distance: 12, type: 'street' }],
  car_sedan: [
    { id: '', offsetX: 1.2, offsetY: 0.6, offsetZ: 0, color: 0xffeeba, intensity: 1.5, distance: 8, type: 'vehicle_head' },
    { id: '', offsetX: -1.0, offsetY: 0.5, offsetZ: 0, color: 0xff2200, intensity: 1.0, distance: 3, type: 'vehicle_tail' },
  ],
  car_hatchback: [
    { id: '', offsetX: 1.2, offsetY: 0.6, offsetZ: 0, color: 0xffeeba, intensity: 1.5, distance: 8, type: 'vehicle_head' },
    { id: '', offsetX: -1.0, offsetY: 0.5, offsetZ: 0, color: 0xff2200, intensity: 1.0, distance: 3, type: 'vehicle_tail' },
  ],
  car_taxi: [
    { id: '', offsetX: 1.2, offsetY: 0.6, offsetZ: 0, color: 0xffeeba, intensity: 1.5, distance: 8, type: 'vehicle_head' },
    { id: '', offsetX: -1.0, offsetY: 0.5, offsetZ: 0, color: 0xff2200, intensity: 1.0, distance: 3, type: 'vehicle_tail' },
  ],
}

export function applyLightPresets(modelKey: string): LightPointDef[] | undefined {
  const presets = LIGHT_PRESETS[modelKey]
  if (!presets) return undefined
  return presets.map(p => ({ ...p, id: genId('light') }))
}

export interface GroupDef {
  id: string
  memberIds: string[]
  anchorX: number
  anchorZ: number
  elevation?: number
}

export interface TownMapConfig {
  version: 1
  meta: {
    name: string
    author: string
    createdAt: string
    updatedAt: string
  }
  grid: {
    cols: number
    rows: number
    cellSize: number
  }
  terrain: TerrainCell[][]
  buildings: BuildingPlacement[]
  props: PropPlacement[]
  roads: RoadPlacement[]
  groups: GroupDef[]
  bindings: {
    office: string | null
    museum: string | null
    userHome: string | null
    houses: string[]
    landmarks: Record<string, string>
  }
}

export type PlacedItem =
  | { kind: 'building'; data: BuildingPlacement }
  | { kind: 'prop'; data: PropPlacement }
  | { kind: 'road'; data: RoadPlacement }

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#7ec850',
  sand: '#d4b87a',
  street: '#505050',
  plaza: '#e8dcc8',
  sidewalk: '#c4b8a8',
  water: '#4488cc',
}

export const TERRAIN_COLORS_HEX: Record<TerrainType, number> = {
  grass: 0x7ec850,
  sand: 0xd4b87a,
  street: 0x505050,
  plaza: 0xe8dcc8,
  sidewalk: 0xc4b8a8,
  water: 0x4488cc,
}

let _nextId = 1
export function genId(prefix: string): string {
  return `${prefix}_${_nextId++}`
}

export function createDefaultConfig(): TownMapConfig {
  const cols = 40
  const rows = 24
  const terrain: TerrainCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: TerrainCell[] = []
    for (let c = 0; c < cols; c++) {
      row.push({ type: 'grass' })
    }
    terrain.push(row)
  }

  return {
    version: 1,
    meta: {
      name: l('Thị trấn của tôi', 'My Town', '我的小镇'),
      author: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    grid: { cols, rows, cellSize: 1 },
    terrain,
    buildings: [],
    props: [],
    roads: [],
    groups: [],
    bindings: {
      office: null,
      museum: null,
      userHome: null,
      houses: [],
      landmarks: {},
    },
  }
}

export type BindingSlot = 'office' | 'museum' | 'userHome' | 'houses'

const SLOT_LABELS: Record<BindingSlot, string> = {
  office: '办公室',
  museum: '博物馆',
  userHome: '用户住宅',
  houses: 'NPC 住宅',
}

const SLOT_LABELS_EN: Record<BindingSlot, string> = {
  office: 'Office',
  museum: 'Museum',
  userHome: 'User Home',
  houses: 'NPC Homes',
}

const SLOT_LABELS_VI: Record<BindingSlot, string> = {
  office: 'Văn phòng',
  museum: 'Bảo tàng',
  userHome: 'Nhà người chơi',
  houses: 'Nhà NPC',
}

function getBindingSlotLabel(slot: BindingSlot): string {
  const locale = getLocale()
  return locale === 'vi' ? SLOT_LABELS_VI[slot] : locale === 'en' ? SLOT_LABELS_EN[slot] : SLOT_LABELS[slot]
}

export function getBuildingBindingSlot(config: TownMapConfig, buildingId: string): { slot: BindingSlot; label: string } | null {
  if (config.bindings.office === buildingId) return { slot: 'office', label: getBindingSlotLabel('office') }
  if (config.bindings.museum === buildingId) return { slot: 'museum', label: getBindingSlotLabel('museum') }
  if (config.bindings.userHome === buildingId) return { slot: 'userHome', label: getBindingSlotLabel('userHome') }
  if (config.bindings.houses.includes(buildingId)) return { slot: 'houses', label: getBindingSlotLabel('houses') }
  return null
}

export interface ValidationError {
  field: string
  message: string
}

export function validateConfig(config: TownMapConfig): ValidationError[] {
  const errors: ValidationError[] = []

  if (!config.bindings.office) {
    errors.push({ field: 'bindings.office', message: l('Phải gán một tòa nhà làm văn phòng', 'An office building must be bound', '必须绑定一个办公室建筑') })
  } else {
    const officeExists = config.buildings.some(b => b.id === config.bindings.office)
    if (!officeExists) {
      errors.push({ field: 'bindings.office', message: l('Tòa nhà văn phòng đã gán không tồn tại', 'The bound office building does not exist', '绑定的办公室建筑不存在') })
    }
  }

  if (config.bindings.museum) {
    const museumExists = config.buildings.some(b => b.id === config.bindings.museum)
    if (!museumExists) {
      errors.push({ field: 'bindings.museum', message: l('Tòa nhà bảo tàng đã gán không tồn tại', 'The bound museum building does not exist', '绑定的博物馆建筑不存在') })
    }
  }

  if (config.bindings.userHome) {
    const homeExists = config.buildings.some(b => b.id === config.bindings.userHome)
    if (!homeExists) {
      errors.push({ field: 'bindings.userHome', message: l('Nhà người chơi đã gán không tồn tại', 'The bound user home does not exist', '绑定的用户住宅建筑不存在') })
    }
  }

  const boundIds: string[] = []
  if (config.bindings.office) boundIds.push(config.bindings.office)
  if (config.bindings.museum) boundIds.push(config.bindings.museum)
  if (config.bindings.userHome) boundIds.push(config.bindings.userHome)
  boundIds.push(...config.bindings.houses)
  const seen = new Set<string>()
  for (const id of boundIds) {
    if (seen.has(id)) {
      errors.push({ field: 'bindings', message: l(`Tòa nhà ${id} bị gán trùng nhiều chức năng`, `Building ${id} is bound to multiple roles`, `建筑 ${id} 被重复绑定到多个功能`) })
    }
    seen.add(id)
  }

  if (config.grid.cols < 20 || config.grid.rows < 16) {
    errors.push({ field: 'grid', message: l('Kích thước map tối thiểu là 20×16', 'Minimum map size is 20×16', '地图最小尺寸为 20×16') })
  }
  if (config.grid.cols > 80 || config.grid.rows > 60) {
    errors.push({ field: 'grid', message: l('Kích thước map tối đa là 80×60', 'Maximum map size is 80×60', '地图最大尺寸为 80×60') })
  }

  const ids = new Set<string>()
  for (const b of config.buildings) {
    if (ids.has(b.id)) errors.push({ field: `buildings.${b.id}`, message: l(`ID tòa nhà bị trùng: ${b.id}`, `Duplicate building ID: ${b.id}`, `重复的建筑 ID: ${b.id}`) })
    ids.add(b.id)
  }

  return errors
}
