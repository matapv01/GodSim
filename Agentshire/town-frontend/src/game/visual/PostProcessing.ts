import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export class PostProcessManager {
  private composer: EffectComposer
  private renderPass: RenderPass
  private bloomPass: UnrealBloomPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer)

    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)

    const size = renderer.getSize(new THREE.Vector2())
    this.bloomPass = new UnrealBloomPass(size, 0.4, 0.3, 0.85)
    this.composer.addPass(this.bloomPass)
  }

  setScene(scene: THREE.Scene): void {
    this.renderPass.scene = scene
  }

  setCamera(camera: THREE.Camera): void {
    this.renderPass.camera = camera
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
  }

  render(): void {
    this.composer.render()
  }

  getComposer(): EffectComposer {
    return this.composer
  }

  setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength
  }

  getBloomStrength(): number {
    return this.bloomPass.strength
  }

  dispose(): void {
    this.composer.dispose()
  }
}
