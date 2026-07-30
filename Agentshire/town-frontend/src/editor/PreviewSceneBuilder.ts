import * as THREE from 'three'
import { EditorAssetLoader } from './EditorAssetLoader'
import type { TownMapConfig, LightPointDef } from './TownMapConfig'
import { TERRAIN_COLORS_HEX } from './TownMapConfig'

export interface PreviewLightingRefs {
  ambient: THREE.AmbientLight
  directional: THREE.DirectionalLight
  hemisphere: THREE.HemisphereLight
  streetLightPoints: THREE.PointLight[]
  windowLights: THREE.PointLight[]
}

export class PreviewSceneBuilder {
  private assets: EditorAssetLoader
  private scene: THREE.Scene
  private lightingRefs: PreviewLightingRefs | null = null
  private groundGroup = new THREE.Group()
  private modelGroup = new THREE.Group()

  constructor(scene: THREE.Scene, assets: EditorAssetLoader) {
    this.scene = scene
    this.assets = assets
  }

  async build(config: TownMapConfig): Promise<PreviewLightingRefs> {
    this.groundGroup.name = 'preview-ground'
    this.modelGroup.name = 'preview-models'
    this.scene.add(this.groundGroup)
    this.scene.add(this.modelGroup)

    this.buildSkyAndFog(config)
    this.lightingRefs = this.buildLighting()
    this.buildTerrain(config)
    await this.buildModels(config)
    return this.lightingRefs
  }

  private buildSkyAndFog(config: TownMapConfig): void {
    this.scene.background = new THREE.Color(0x87ceeb)
    const maxDim = Math.max(config.grid.cols, config.grid.rows)
    this.scene.fog = new THREE.Fog(0x87ceeb, maxDim * 0.8, maxDim * 2)
  }

  private buildLighting(): PreviewLightingRefs {
    const ambient = new THREE.AmbientLight(0xd8e0f0, 0.55)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff5e0, 1.0)
    dir.position.set(20, 30, -10)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -40
    dir.shadow.camera.right = 40
    dir.shadow.camera.top = 40
    dir.shadow.camera.bottom = -40
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 80
    this.scene.add(dir)

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a6830, 0.35)
    this.scene.add(hemi)

    return {
      ambient,
      directional: dir,
      hemisphere: hemi,
      streetLightPoints: [],
      windowLights: [],
    }
  }

  private buildTerrain(config: TownMapConfig): void {
    const { cols, rows } = config.grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = config.terrain[r]?.[c]
        const terrainType = cell?.type ?? 'grass'
        const color = TERRAIN_COLORS_HEX[terrainType] ?? 0x7ec850
        const geo = new THREE.PlaneGeometry(1, 1)
        const mat = new THREE.MeshLambertMaterial({ color })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(c + 0.5, 0, r + 0.5)
        mesh.receiveShadow = true
        this.groundGroup.add(mesh)
      }
    }
  }

  private async buildModels(config: TownMapConfig): Promise<void> {
    const allItems = [
      ...config.buildings.map(d => ({ data: d, kind: 'building' as const })),
      ...config.props.filter(p => !p.animated).map(d => ({ data: d, kind: 'prop' as const })),
      ...config.roads.map(d => ({ data: d, kind: 'road' as const })),
    ]

    for (const item of allItems) {
      const d = item.data
      const url = (d as any).modelUrl
      if (!url) continue

      const model = await this.assets.loadModel(url)
      if (!model) continue

      model.position.set(d.gridX, (d as any).elevation ?? 0, d.gridZ)

      const scale = (d as any).scale ?? 1
      const flipX = (d as any).flipX ? -1 : 1
      const flipZ = (d as any).flipZ ? -1 : 1
      model.scale.set(scale * flipX, scale, scale * flipZ)

      const rotY = ((d.rotationY ?? 0) * Math.PI) / 180
      const fixRX = ((d as any).fixRotationX ?? 0) * Math.PI / 180
      const fixRY = ((d as any).fixRotationY ?? 0) * Math.PI / 180
      const fixRZ = ((d as any).fixRotationZ ?? 0) * Math.PI / 180
      model.rotation.set(fixRX, rotY + fixRY, fixRZ)

      model.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      this.modelGroup.add(model)

      const lights = (d as any).lights as LightPointDef[] | undefined
      if (lights && this.lightingRefs) {
        for (const lp of lights) {
          const pl = new THREE.PointLight(lp.color, 0, lp.distance, 2)
          pl.position.set(lp.offsetX, lp.offsetY, lp.offsetZ)
          model.add(pl)
          if (lp.type === 'window' || lp.type === 'vehicle_tail') {
            this.lightingRefs.windowLights.push(pl)
          } else {
            this.lightingRefs.streetLightPoints.push(pl)
          }
        }
      }
    }
  }

  dispose(): void {
    this.groundGroup.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        m.geometry.dispose()
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose())
        else m.material.dispose()
      }
    })
    this.modelGroup.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        m.geometry.dispose()
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose())
        else m.material.dispose()
      }
    })
    this.scene.remove(this.groundGroup)
    this.scene.remove(this.modelGroup)
  }
}
