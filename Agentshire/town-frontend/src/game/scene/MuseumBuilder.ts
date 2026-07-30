import * as THREE from 'three'
import { AssetLoader } from '../visual/AssetLoader'

export interface ExhibitStand {
  index: number
  position: THREE.Vector3
  pedestalMesh: THREE.Mesh
  panelMesh: THREE.Mesh
  panelMaterial: THREE.MeshBasicMaterial
  spotlight: THREE.SpotLight
  unlocked: boolean
}

export class MuseumBuilder {
  private scene: THREE.Scene
  private objects: THREE.Object3D[] = []
  public stands: ExhibitStand[] = []
  public doorPos = new THREE.Vector3(12, 0, 18)

  constructor(scene: THREE.Scene) { this.scene = scene }

  build(assets: AssetLoader): void {
    this.buildFloor()
    this.buildWalls()
    this.buildStands()
    this.addLighting()
    this.addFurniture(assets)
  }

  private add(obj: THREE.Object3D): void {
    this.scene.add(obj)
    this.objects.push(obj)
  }

  private box(
    w: number, h: number, d: number,
    color: number,
    x: number, y: number, z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color }),
    )
    mesh.position.set(x, y, z)
    this.add(mesh)
    return mesh
  }

  private buildFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(12, 0, 9)
    this.add(floor)

    const borderMat = new THREE.MeshStandardMaterial({ color: 0xcccccc })
    for (const z of [0.1, 17.9]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 0.15), borderMat)
      strip.rotation.x = -Math.PI / 2
      strip.position.set(12, 0.005, z)
      this.add(strip)
    }
    for (const x of [0.1, 23.9]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 17.6), borderMat)
      strip.rotation.x = -Math.PI / 2
      strip.position.set(x, 0.005, 9)
      this.add(strip)
    }
  }

  private buildWalls(): void {
    const c = 0xffffff
    const h = 3.5
    const t = 0.2

    this.box(24, h, t, c, 12, h / 2, 0)

    this.box(10.5, h, t, c, 5.25, h / 2, 18)
    this.box(10.5, h, t, c, 18.75, h / 2, 18)

    this.box(0.12, h, t, 0xdddddd, 10.5, h / 2, 18)
    this.box(0.12, h, t, 0xdddddd, 13.5, h / 2, 18)
    this.box(3, 0.12, t, 0xdddddd, 12, h, 18)

    this.box(t, h, 18, c, 0, h / 2, 9)
    this.box(t, h, 18, c, 24, h / 2, 9)

    const trim = 0xf5f5f5
    this.box(24, 0.15, 0.05, trim, 12, 0.075, 0.15)
    this.box(0.05, 0.15, 18, trim, 0.15, 0.075, 9)
    this.box(0.05, 0.15, 18, trim, 23.85, 0.075, 9)
  }

  private buildStands(): void {
    const positions: [number, number][] = [
      [4, 5], [12, 5], [20, 5],
      [4, 12], [12, 12], [20, 12],
    ]

    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i]

      const pedestalMesh = this.box(1.5, 1, 1.5, 0xffffff, x, 0.5, z)

      this.box(1.6, 0.04, 1.6, 0xeeeeee, x, 1.02, z)

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }),
      )
      pole.position.set(x, 1.75, z)
      this.add(pole)

      const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 })
      const panelMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 0.05),
        panelMaterial,
      )
      panelMesh.position.set(x, 2.5, z)
      this.add(panelMesh)

      const frame = new THREE.MeshStandardMaterial({ color: 0x999999 })
      const fb = (w: number, fh: number, fd: number, fx: number, fy: number, fz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, fh, fd), frame)
        m.position.set(fx, fy, fz)
        this.add(m)
      }
      fb(1.26, 0.04, 0.06, x, 2.92, z)
      fb(1.26, 0.04, 0.06, x, 2.08, z)
      fb(0.04, 0.8, 0.06, x - 0.62, 2.5, z)
      fb(0.04, 0.8, 0.06, x + 0.62, 2.5, z)

      const spotlight = new THREE.SpotLight(0xffffff, 0.3, 8, Math.PI / 6, 0.5)
      spotlight.position.set(x, 3.4, z)
      spotlight.target.position.set(x, 0.5, z)
      this.add(spotlight)
      this.add(spotlight.target)

      this.stands.push({
        index: i,
        position: new THREE.Vector3(x, 0, z),
        pedestalMesh,
        panelMesh,
        panelMaterial,
        spotlight,
        unlocked: false,
      })
    }
  }

  private addLighting(): void {
    const ambient = new THREE.AmbientLight(0xf0f0ff, 0.5)
    this.add(ambient)

    const over1 = new THREE.PointLight(0xf0f0ff, 0.8, 25)
    over1.position.set(8, 3.3, 9)
    this.add(over1)

    const over2 = new THREE.PointLight(0xf0f0ff, 0.8, 25)
    over2.position.set(16, 3.3, 9)
    this.add(over2)
  }

  private placeFurniture(
    assets: AssetLoader,
    key: string,
    x: number, y: number, z: number,
    rotY = 0,
    scale = 1,
  ): void {
    const model = assets.getFurnitureModel(key)
    if (!model) return
    model.position.set(x, y, z)
    model.rotation.y = rotY
    model.scale.setScalar(scale)
    this.add(model)
  }

  private addFurniture(assets: AssetLoader): void {
    this.placeFurniture(assets, 'table_medium_long', 12, 0, 16, 0, 1.5)

    this.placeFurniture(assets, 'armchair', 4, 0, 9, Math.PI, 1)
    this.placeFurniture(assets, 'armchair', 20, 0, 9, Math.PI, 1)

    this.placeFurniture(assets, 'shelf_B_large_decorated', 4, 0, 1, 0, 1)
    this.placeFurniture(assets, 'shelf_B_large_decorated', 20, 0, 1, 0, 1)

    this.placeFurniture(assets, 'lamp_standing', 1, 0, 1, 0, 1)
    this.placeFurniture(assets, 'lamp_standing', 23, 0, 1, 0, 1)
    this.placeFurniture(assets, 'lamp_standing', 1, 0, 17, 0, 1)
    this.placeFurniture(assets, 'lamp_standing', 23, 0, 17, 0, 1)

    this.placeFurniture(assets, 'rug_oval_A', 4, 0.01, 5, 0, 2)
    this.placeFurniture(assets, 'rug_oval_A', 12, 0.01, 5, 0, 2)
    this.placeFurniture(assets, 'rug_oval_A', 20, 0.01, 5, 0, 2)

    this.placeFurniture(assets, 'cactus_small_A', 2, 0, 16, 0, 1.5)
    this.placeFurniture(assets, 'cactus_small_A', 22, 0, 16, 0, 1.5)
    this.placeFurniture(assets, 'cactus_small_A', 2, 0, 2, 0, 1.5)
    this.placeFurniture(assets, 'cactus_small_A', 22, 0, 2, 0, 1.5)

    this.placeFurniture(assets, 'pictureframe_large_B', 0.15, 1.8, 5, Math.PI / 2, 1)
    this.placeFurniture(assets, 'pictureframe_large_B', 0.15, 1.8, 13, Math.PI / 2, 1)
    this.placeFurniture(assets, 'pictureframe_large_B', 23.85, 1.8, 5, -Math.PI / 2, 1)
    this.placeFurniture(assets, 'pictureframe_large_B', 23.85, 1.8, 13, -Math.PI / 2, 1)
  }

  unlockStand(index: number): void {
    const stand = this.stands[index]
    if (!stand || stand.unlocked) return
    stand.unlocked = true
    stand.panelMaterial.color.setHex(0xffd700)
    stand.spotlight.intensity = 2
    stand.spotlight.color.setHex(0xffd700)
  }

  clear(): void {
    for (const obj of this.objects) this.scene.remove(obj)
    this.objects = []
    this.stands = []
  }
}
