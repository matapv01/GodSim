// @desc Tests for SceneSwitcher: scene transitions with debounce
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneSwitcher, type SceneSwitcherDeps } from '../workflow/SceneSwitcher'

vi.mock('../../audio/AudioSystem', () => ({
  getAudioSystem: () => ({ play: vi.fn() }),
}))

function makeScene() {
  return { add: vi.fn(), remove: vi.fn() } as any
}

function makeDeps(): SceneSwitcherDeps {
  return {
    engine: {
      camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
      world: { scene: null },
    } as any,
    ui: {
      fadeToBlack: vi.fn().mockResolvedValue(undefined),
      fadeFromBlack: vi.fn().mockResolvedValue(undefined),
      showBackButton: vi.fn(),
    } as any,
    npcManager: {
      get: vi.fn(() => ({
        mesh: { position: { set: vi.fn() } },
        playAnim: vi.fn(),
        moveTo: vi.fn().mockResolvedValue(undefined),
        stopMoving: vi.fn(),
        restoreVisual: vi.fn(),
        setVisible: vi.fn(),
        lookAtTarget: vi.fn(),
      })),
      moveNpcsToScene: vi.fn(),
      setScene: vi.fn(),
    } as any,
    bubbles: {
      clear: vi.fn(),
      updateCamera: vi.fn(),
    } as any,
    cameraCtrl: {
      enterOfficeMode: vi.fn(),
      leaveOfficeMode: vi.fn(),
      setAutoPilot: vi.fn(),
      follow: vi.fn(),
      moveTo: vi.fn(),
    } as any,
    vfx: { setScene: vi.fn() } as any,
    officeBuilder: {} as any,
    modeManager: {
      getState: vi.fn(() => ({ mode: 'life' })),
      isWorkMode: vi.fn(() => false),
      getWorkSubState: vi.fn(() => null),
    } as any,
    getModeIndicator: vi.fn(() => ({
      setSceneType: vi.fn(),
      update: vi.fn(),
    })) as any,
    gameClock: { pause: vi.fn(), resume: vi.fn() } as any,
    townScene: makeScene(),
    officeScene: makeScene(),
    museumScene: makeScene(),
    getActiveOfficeNpcIds: vi.fn(() => []),
    onRestoreOfficeSceneLayout: vi.fn(),
    onStopDailyBehaviors: vi.fn(),
    onStopBehaviorForNpcs: vi.fn(),
    onScheduleStartDailyBehaviors: vi.fn(),
    onCleanupOfficeWork: vi.fn(),
    onSyncTopHudLayout: vi.fn(),
    getTownDoorPosition: vi.fn(() => null),
    getIndoorNpcIds: vi.fn(() => []),
    getSummonPlayed: vi.fn(() => false),
    setSummonPlayed: vi.fn(),
    getWorkingCitizens: vi.fn(() => new Set<string>()),
    getPendingSummonNpcs: vi.fn(() => []),
    setPendingSummonNpcs: vi.fn(),
    setInputEnabled: vi.fn(),
  }
}

describe('SceneSwitcher', () => {
  let deps: ReturnType<typeof makeDeps>
  let switcher: SceneSwitcher

  beforeEach(() => {
    deps = makeDeps()
    switcher = new SceneSwitcher(deps)
  })

  it('defaults to town scene', () => {
    expect(switcher.getSceneType()).toBe('town')
  })

  it('switchScene("office") changes currentSceneType to office', async () => {
    await switcher.switchScene('office')
    expect(switcher.getSceneType()).toBe('office')
    expect(deps.cameraCtrl.enterOfficeMode).toHaveBeenCalled()
  })

  it('switchScene("museum") changes to museum', async () => {
    await switcher.switchScene('museum')
    expect(switcher.getSceneType()).toBe('museum')
    expect(deps.gameClock.pause).toHaveBeenCalled()
  })

  it('switchScene back to town resumes clock and resets camera', async () => {
    await switcher.switchScene('office')
    await switcher.switchScene('town')
    expect(switcher.getSceneType()).toBe('town')
    expect(deps.gameClock.resume).toHaveBeenCalled()
    expect(deps.cameraCtrl.leaveOfficeMode).toHaveBeenCalled()
  })

  it('rapid successive switches: only the last one takes effect', async () => {
    const p1 = switcher.switchScene('office')
    const p2 = switcher.switchScene('museum')
    const p3 = switcher.switchScene('town')

    await p1
    await vi.dynamicImportSettled?.() ?? Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    await p2
    await p3

    expect(switcher.getSceneType()).toBe('town')
  })

  it('performs fade transition during switch', async () => {
    await switcher.switchScene('office')
    expect(deps.ui.fadeToBlack).toHaveBeenCalledWith(300)
    expect(deps.ui.fadeFromBlack).toHaveBeenCalledWith(300)
  })

  it('clears bubbles during scene switch', async () => {
    await switcher.switchScene('office')
    expect(deps.bubbles.clear).toHaveBeenCalled()
  })

  it('restores office layout when re-entering office during work mode (working sub-state)', async () => {
    deps.modeManager.isWorkMode = vi.fn(() => true)
    deps.modeManager.getWorkSubState = vi.fn(() => 'working' as const)
    deps.getActiveOfficeNpcIds = vi.fn(() => ['citizen_1'])

    await switcher.switchScene('office')

    expect(deps.onRestoreOfficeSceneLayout).toHaveBeenCalled()
    expect(deps.onStopBehaviorForNpcs).toHaveBeenCalledWith(['steward', 'user', 'citizen_1'])
  })

  it('moves only the player and actual occupants into a visited house', async () => {
    deps.getIndoorNpcIds = vi.fn(() => ['citizen_1'])
    deps.onVisitEntered = vi.fn()

    await switcher.switchScene('house_a')

    expect(deps.npcManager.moveNpcsToScene).toHaveBeenCalledWith(
      ['user', 'citizen_1'],
      deps.museumScene,
    )
    expect(deps.npcManager.moveNpcsToScene).not.toHaveBeenCalledWith(
      expect.arrayContaining(['steward']),
      expect.anything(),
    )
    expect(deps.onStopDailyBehaviors).not.toHaveBeenCalled()
    expect(deps.onVisitEntered).toHaveBeenCalledWith('house_a', ['citizen_1'])
  })

  it('restores an indoor resident to the same town position and visibility on exit', async () => {
    const user = {
      mesh: { position: { x: 10, y: 0, z: 10, set: vi.fn() }, visible: true },
      playAnim: vi.fn(), stopMoving: vi.fn(), setVisible: vi.fn(),
    }
    const resident = {
      mesh: { position: { x: 6, y: 0, z: 7.5, set: vi.fn() }, visible: false },
      playAnim: vi.fn(), stopMoving: vi.fn(), setVisible: vi.fn(),
    }
    deps.npcManager.get = vi.fn(
      (id: string) => id === 'user' ? user : id === 'citizen_1' ? resident : undefined,
    ) as any
    deps.getIndoorNpcIds = vi.fn(() => ['citizen_1'])

    await switcher.switchScene('house_a')
    await switcher.switchScene('town')

    expect(resident.mesh.position.set).toHaveBeenLastCalledWith(6, 0, 7.5)
    expect(resident.setVisible).toHaveBeenLastCalledWith(false)
  })
})
