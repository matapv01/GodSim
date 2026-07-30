// @desc Scene switching logic with fade transitions and NPC repositioning
import * as THREE from 'three'
import { getAudioSystem } from '../../audio/AudioSystem'
import type { UIManager } from '../../ui/UIManager'
import type { NPCManager } from '../../npc/NPCManager'
import type { ChatBubbleSystem } from '../../ui/ChatBubble'
import type { CameraController } from '../visual/CameraController'
import type { VFXSystem } from '../visual/VFXSystem'
import type { OfficeBuilder } from '../scene/OfficeBuilder'
import type { ModeManager } from './ModeManager'
import type { ModeIndicator } from '../../ui/ModeIndicator'
import type { GameClock } from '../GameClock'
import type { Engine } from '../../engine'
import { WAYPOINTS, type SceneType } from '../../types'
import type { WeatherSystem } from '../WeatherSystem'

export interface SceneSwitcherDeps {
  engine: Engine
  ui: UIManager
  npcManager: NPCManager
  bubbles: ChatBubbleSystem
  cameraCtrl: CameraController
  vfx: VFXSystem
  officeBuilder: OfficeBuilder
  modeManager: ModeManager
  getModeIndicator: () => ModeIndicator | undefined
  gameClock: GameClock
  townScene: THREE.Scene
  officeScene: THREE.Scene
  museumScene: THREE.Scene
  weatherSystem?: WeatherSystem
  getActiveOfficeNpcIds: () => string[]
  onRestoreOfficeSceneLayout: () => void
  onStopDailyBehaviors: () => void
  onStopBehaviorForNpcs: (npcIds: string[]) => void
  onScheduleStartDailyBehaviors: (delayMs: number) => void
  onCleanupOfficeWork: () => void
  onSyncTopHudLayout: () => void
  getTownDoorPosition: (buildingId: string) => { x: number; z: number } | null
  getIndoorNpcIds: () => string[]
  getSummonPlayed: () => boolean
  setSummonPlayed: (v: boolean) => void
  getWorkingCitizens: () => Set<string>
  getPendingSummonNpcs: () => string[]
  setPendingSummonNpcs: (v: string[]) => void
  setInputEnabled: (enabled: boolean) => void
}

export class SceneSwitcher {
  private currentSceneType: SceneType = 'town'
  private sceneSwitching = false
  private pendingSceneSwitch: SceneType | null = null
  private visitNpcSnapshots = new Map<string, {
    x: number
    y: number
    z: number
    visible: boolean
  }>()
  private deps: SceneSwitcherDeps

  constructor(deps: SceneSwitcherDeps) {
    this.deps = deps
  }

  getSceneType(): SceneType {
    return this.currentSceneType
  }

  private moveVisitNpcsToScene(
    npcIds: string[],
    scene: THREE.Scene,
    getPosition: (index: number, id: string) => { x: number; z: number },
  ): string[] {
    const uniqueIds = [...new Set(npcIds)]
    this.visitNpcSnapshots.clear()

    for (const id of uniqueIds) {
      const npc = this.deps.npcManager.get(id)
      if (!npc) continue
      this.visitNpcSnapshots.set(id, {
        x: npc.mesh.position.x,
        y: npc.mesh.position.y,
        z: npc.mesh.position.z,
        visible: npc.mesh.visible,
      })
      npc.stopMoving()
    }

    this.deps.npcManager.moveNpcsToScene(uniqueIds, scene)
    uniqueIds.forEach((id, index) => {
      const npc = this.deps.npcManager.get(id)
      if (!npc) return
      const position = getPosition(index, id)
      npc.mesh.position.set(position.x, 0, position.z)
      npc.setVisible(true)
      npc.playAnim('idle')
    })
    return uniqueIds
  }

  private restoreVisitNpcs(): void {
    for (const [id, snapshot] of this.visitNpcSnapshots) {
      if (id === 'user') continue
      const npc = this.deps.npcManager.get(id)
      if (!npc) continue
      npc.mesh.position.set(snapshot.x, snapshot.y, snapshot.z)
      npc.setVisible(snapshot.visible)
    }
    this.visitNpcSnapshots.clear()
  }

  async switchScene(sceneType: SceneType): Promise<void> {
    if (this.sceneSwitching) {
      this.pendingSceneSwitch = sceneType
      return
    }
    this.sceneSwitching = true
    this.pendingSceneSwitch = null
    try {
      await this.doSwitchScene(sceneType)
    } finally {
      this.sceneSwitching = false
      if (this.pendingSceneSwitch !== null && this.pendingSceneSwitch !== this.currentSceneType) {
        const next = this.pendingSceneSwitch
        this.pendingSceneSwitch = null
        this.switchScene(next)
      }
    }
  }

  private async doSwitchScene(sceneType: SceneType): Promise<void> {
    const {
      engine, ui, npcManager, bubbles, cameraCtrl, vfx, officeBuilder,
      modeManager, townScene, officeScene, museumScene, gameClock,
    } = this.deps
    const modeIndicator = this.deps.getModeIndicator()
    const activeOfficeNpcIds = this.deps.getActiveOfficeNpcIds()
    const workSubState = modeManager.getWorkSubState()
    const isWorkMode = modeManager.isWorkMode()
    const indoorNpcIds = !isWorkMode && sceneType !== 'town'
      ? this.deps.getIndoorNpcIds()
      : []

    getAudioSystem().play('scene_switch')
    await ui.fadeToBlack(300)
    bubbles.clear()
    this.currentSceneType = sceneType
    modeIndicator?.setSceneType(sceneType)
    modeIndicator?.update(modeManager.getState())
    this.deps.onSyncTopHudLayout()

    let targetScene: THREE.Scene
    if (sceneType === 'office') {
      if (isWorkMode) {
        this.deps.onStopBehaviorForNpcs(['steward', 'user', ...activeOfficeNpcIds])
      }
      targetScene = officeScene
      vfx.setScene(officeScene)
      this.deps.weatherSystem?.setEnabled(false)

      if (isWorkMode) {
        const OFFICE_DOOR = { x: 15, z: 24 }
        const SUPERVISOR_POS = { steward: { x: 15, z: 12 }, mayor: { x: 18, z: 18 } }

        const assignedWorkerIds = activeOfficeNpcIds
        // 只有恢复已有办公室工作态时，才把旧 worker 摆回工位。
        // fresh summon/going_to_office 由 startOfficeWork() 负责从门口进场和走位。
        if (workSubState === 'working') {
          npcManager.moveNpcsToScene(['steward', 'user', ...assignedWorkerIds], officeScene)
          this.deps.onRestoreOfficeSceneLayout()
        } else {
          npcManager.moveNpcsToScene(['steward', 'user'], officeScene)
        }

        const stewardNpc = npcManager.get('steward')
        const userNpc = npcManager.get('user')

        if (workSubState === 'working' && assignedWorkerIds.length > 0) {
          this.deps.setInputEnabled(false)
          const movePromises: Promise<unknown>[] = []

          if (stewardNpc) {
            stewardNpc.mesh.position.set(OFFICE_DOOR.x, 0, OFFICE_DOOR.z - 1)
            stewardNpc.playAnim('walk')
            movePromises.push(
              stewardNpc.moveTo(SUPERVISOR_POS.steward, 3).then(() => stewardNpc.playAnim('idle')),
            )
          }
          if (userNpc) {
            userNpc.mesh.position.set(OFFICE_DOOR.x + 2, 0, OFFICE_DOOR.z)
            userNpc.playAnim('walk')
            movePromises.push(
              userNpc.moveTo(SUPERVISOR_POS.mayor, 3).then(() => userNpc.playAnim('idle')),
            )
          }

          Promise.allSettled(movePromises).then(() => {
            this.deps.setInputEnabled(true)
          })
        } else if (workSubState === 'working') {
          if (stewardNpc) {
            stewardNpc.mesh.position.set(SUPERVISOR_POS.steward.x, 0, SUPERVISOR_POS.steward.z)
            stewardNpc.playAnim('idle')
          }
          if (userNpc) {
            userNpc.mesh.position.set(SUPERVISOR_POS.mayor.x, 0, SUPERVISOR_POS.mayor.z)
            userNpc.playAnim('idle')
          }
        } else {
          // fresh summon / going_to_office:
          // do not place steward/user here; startOfficeWork() owns their door entrance and walk animation
        }
      } else {
        const visitNpcIds = this.moveVisitNpcsToScene(
          ['user', ...indoorNpcIds],
          officeScene,
          (_index, id) => ({
            x: 15 + (id === 'user' ? 1.5 : -1.5),
            z: 24,
          }),
        )
        this.deps.setInputEnabled(false)

        const OFFICE_DOOR = { x: 15, z: 24 }
        const movePromises: Promise<unknown>[] = []
        for (const id of visitNpcIds) {
          const npc = npcManager.get(id)
          if (npc) {
            npc.mesh.position.set(
              OFFICE_DOOR.x + (id === 'user' ? 1.5 : -1.5),
              0,
              OFFICE_DOOR.z,
            )
            npc.playAnim('walk')
            movePromises.push(
              npc.moveTo({ x: OFFICE_DOOR.x + (id === 'user' ? 1.5 : -1.5), z: 12 }, 2.5)
                .then(() => npc.playAnim('idle')),
            )
          }
        }
        Promise.allSettled(movePromises).then(() => {
          this.deps.setInputEnabled(true)
        })
      }

      ui.showBackButton(!isWorkMode)
      cameraCtrl.enterOfficeMode()
    } else if (sceneType !== 'town') {
      gameClock?.pause()
      targetScene = museumScene
      vfx.setScene(museumScene)
      this.deps.weatherSystem?.setEnabled(false)
      const roomSlots = [
        { x: 8, z: 8 },
        { x: 12, z: 8 },
        { x: 16, z: 8 },
        { x: 8, z: 12 },
        { x: 12, z: 12 },
        { x: 16, z: 12 },
      ]
      this.moveVisitNpcsToScene(
        ['user', ...indoorNpcIds],
        museumScene,
        (index, id) => id === 'user'
          ? { x: 12, z: 16 }
          : roomSlots[(index - 1) % roomSlots.length],
      )
      ui.showBackButton(true)
      cameraCtrl.setAutoPilot(false)
      cameraCtrl.follow(null)
      engine.camera.position.set(12, 20, 18)
      engine.camera.lookAt(12, 0, 9)
    } else {
      gameClock?.resume()
      targetScene = townScene
      vfx.setScene(townScene)
      this.deps.weatherSystem?.setEnabled(true)

      const returnPos = this.deps.getTownDoorPosition('office') ?? WAYPOINTS.office_door

      if (isWorkMode) {
        npcManager.moveNpcsToScene(['steward', 'user'], townScene)
        ui.showBackButton(false)
      } else {
        npcManager.setScene(townScene)
        this.restoreVisitNpcs()
        ui.showBackButton(false)
        this.deps.setSummonPlayed(false)
        this.deps.getWorkingCitizens().clear()
        this.deps.setPendingSummonNpcs([])
        this.deps.onCleanupOfficeWork()
        this.deps.onScheduleStartDailyBehaviors(4500)
      }

      const userNpc = npcManager.get('user')
      const stewardNpc = npcManager.get('steward')
      if (userNpc) {
        userNpc.stopMoving()
        userNpc.mesh.position.set(returnPos.x + 1, 0, returnPos.z + 1)
        userNpc.playAnim('idle')
      }
      if (stewardNpc) {
        stewardNpc.stopMoving()
        stewardNpc.mesh.position.set(returnPos.x - 1, 0, returnPos.z + 1)
        stewardNpc.playAnim('idle')
      }
      cameraCtrl.leaveOfficeMode()
      cameraCtrl.setAutoPilot(false)
      cameraCtrl.moveTo({ x: returnPos.x, z: returnPos.z + 4 })
    }

    engine.world.scene = targetScene
    bubbles.updateCamera(engine.camera)
    await ui.fadeFromBlack(300)
  }
}
