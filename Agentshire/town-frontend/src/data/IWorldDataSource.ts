import type { GameEvent, GameAction, NPCPhase } from './GameProtocol'
import type { TownConfig } from './TownConfig'
import type { SceneType, Vec3 } from '../types'

export interface NPCSnapshot {
  npcId: string
  name: string
  phase: NPCPhase
  scene: SceneType
  position: Vec3
}

export interface WorldSnapshot {
  npcs: NPCSnapshot[]
  currentScene: SceneType
  activeWork: boolean
}

export interface ConnectResult {
  hasWorkRestore: boolean
}

export interface IWorldDataSource {
  connect(townConfig: TownConfig): Promise<ConnectResult>
  disconnect(): void
  readonly connected: boolean

  onGameEvent(handler: (event: GameEvent) => void): void
  sendAction(action: GameAction): void
  getSnapshot(): WorldSnapshot | null
}
