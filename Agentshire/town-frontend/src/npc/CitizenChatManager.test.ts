import { describe, expect, it, vi } from 'vitest'
import { CitizenChatManager } from './CitizenChatManager'

describe('CitizenChatManager indoor conversations', () => {
  it('keeps a nearby citizen chat active inside a house', () => {
    const user = {
      mesh: { position: { x: 12, z: 14 } },
      getPosition: () => ({ x: 12, z: 14 }),
      moveTo: vi.fn(),
    }
    const citizen = {
      id: 'citizen_1',
      name: 'Minh',
      label: 'Minh',
      characterKey: 'char-male-a',
      mesh: { position: { x: 12, z: 12 }, visible: true },
      isInActiveScene: true,
      getPosition: () => ({ x: 12, z: 12 }),
      stopMoving: vi.fn(),
      smoothLookAt: vi.fn(),
    }
    const behavior = {
      pauseForDialogue: vi.fn(),
      resumeFromDialogue: vi.fn(),
      inDialogue: true,
    }
    const manager = new CitizenChatManager({
      npcManager: { get: vi.fn((id: string) => id === 'citizen_1' ? citizen : id === 'user' ? user : undefined) } as any,
      getBehavior: vi.fn(() => behavior as any),
      getUser: () => user as any,
      getSteward: () => undefined,
      getCameraCtrl: () => ({ follow: vi.fn() }) as any,
      getFollowBehavior: () => ({ setTarget: vi.fn(), isActive: () => false, start: vi.fn() }) as any,
      getSceneType: () => 'house_a',
      getAvatarUrl: () => undefined,
      onDialogTargetChange: vi.fn(),
      onInputTargetChange: vi.fn(),
    })

    manager.startChat('citizen_1')
    manager.update(1000)

    expect(manager.isActive()).toBe(true)
    expect(manager.getActiveNpcId()).toBe('citizen_1')
  })
})
