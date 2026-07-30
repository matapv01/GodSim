import { describe, expect, it, vi } from 'vitest'
import { NPCManager } from './NPCManager'

describe('NPCManager active scene updates', () => {
  it('skips animation and movement work for NPCs outside the active scene', () => {
    const activeScene = {}
    const npc = {
      mesh: { parent: {}, userData: {} },
      isInActiveScene: true,
      update: vi.fn(),
      updateLabel: vi.fn(),
    }
    const manager = new NPCManager({} as any, {} as any)
    ;(manager as any).npcs.set('citizen_1', npc)

    manager.update(0.016, {} as any, {} as any, activeScene as any)

    expect(npc.isInActiveScene).toBe(false)
    expect(npc.update).not.toHaveBeenCalled()
    expect(npc.updateLabel).toHaveBeenCalledOnce()
  })

  it('continues updating NPCs in the active scene', () => {
    const activeScene = {}
    const npc = {
      mesh: { parent: activeScene, userData: {} },
      isInActiveScene: false,
      update: vi.fn(),
      updateLabel: vi.fn(),
    }
    const manager = new NPCManager({} as any, {} as any)
    ;(manager as any).npcs.set('citizen_1', npc)

    manager.update(0.016, {} as any, {} as any, activeScene as any)

    expect(npc.isInActiveScene).toBe(true)
    expect(npc.update).toHaveBeenCalledWith(0.016)
  })
})
