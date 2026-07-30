import * as THREE from 'three'
import type { Engine, GameScene } from '../engine'
import { UIManager } from '../ui/UIManager'
import { TownSetupUI } from '../ui/TownSetupUI'
import { ChatBubbleSystem, cleanBubbleText, getBubbleDurationMs } from '../ui/ChatBubble'
import { AssetLoader } from './visual/AssetLoader'
import { TownBuilder } from './scene/TownBuilder'
import { OfficeBuilder } from './scene/OfficeBuilder'
import { MuseumBuilder } from './scene/MuseumBuilder'
import { VehicleManager } from './scene/VehicleManager'
import { CameraController } from './visual/CameraController'
import { Effects } from './visual/Effects'
import { VFXSystem } from './visual/VFXSystem'
import { getAudioSystem } from '../audio/AudioSystem'
import { AmbientSoundManager } from '../audio/AmbientSoundManager'
import { BGMManager } from '../audio/BGMManager'
import { NPC } from '../npc/NPC'
import { NPCManager } from '../npc/NPCManager'
import { EncounterManager } from '../npc/EncounterManager'
import { CasualEncounter } from '../npc/CasualEncounter'
import { FollowBehavior } from '../npc/FollowBehavior'
import { PersonaStore } from '../npc/PersonaStore'
import { TownJournal } from '../npc/TownJournal'
import { getCharacterKeyForNpc } from '../data/CharacterRoster'
import { createDefaultTownConfig, getNpcProfiles, type NPCProfile } from '../data/TownConfig'
import { getGodSimNpcProfile } from '../data/god-sim-npc-profiles'
import { getProfessionOptions } from '../data/Professions'
import { GameClock } from './GameClock'
import { TimeOfDayLighting } from './visual/TimeOfDayLighting'
import { WeatherSystem } from './WeatherSystem'
import { TimeHUD } from '../ui/TimeHUD'
import { EventLogPanel } from '../ui/EventLogPanel'
import { SocialFeedPanel, type SocialNpcSnapshot } from '../ui/SocialFeedPanel'
import { ModeIndicator } from '../ui/ModeIndicator'
import { ModeManager } from './workflow/ModeManager'
import { BUILDING_REGISTRY, WAYPOINTS, type SceneType, type NPCConfig, type WorkSubState, type TimePeriod } from '../types'
import type { IWorldDataSource } from '../data/IWorldDataSource'
import type { GameEvent, GameNPCRole } from '../data/GameProtocol'
import { t } from '../i18n'
import type { TownConfigStore } from '../data/TownConfigStore'
import { EventDispatcher } from './EventDispatcher'
import { DialogManager } from './DialogManager'
import { SceneSwitcher } from './workflow/SceneSwitcher'
import { DailyScheduler } from './DailyScheduler'
import { SceneBootstrap } from './SceneBootstrap'
import { WorkflowHandler } from './workflow/WorkflowHandler'
import { Choreographer } from './workflow/Choreographer'
import { CitizenChatManager } from '../npc/CitizenChatManager'
import { installDebugBindings, removeDebugBindings } from './DebugBindings'
import { detectProfile } from '../engine/Performance'
import type { MinigameSlot } from './minigame/MinigameSlot'
import { BanweiGame } from './minigame/BanweiGame'

type SocialAppointment = {
  id: string
  npcAId: string
  npcBId: string
  npcAName: string
  npcBName: string
  placeKey: string
  placeName: string
  period: TimePeriod
  dayCount: number
  reason: string
  activated: boolean
  arrivedAtMs?: number
  complained: boolean
  completed: boolean
  userInitiated?: boolean
  lastPromptMs?: number
}

export class MainScene implements GameScene {
  private engine: Engine
  private ui: UIManager
  private setupUI!: TownSetupUI
  private dataSource: IWorldDataSource
  private configStore: TownConfigStore
  private assets!: AssetLoader
  private bubbles!: ChatBubbleSystem
  private cameraCtrl!: CameraController
  private effects!: Effects
  private vfx!: VFXSystem
  private npcManager!: NPCManager
  private debugCharacterAssignments = new Map<string, string>()

  private townScene!: THREE.Scene
  private officeScene!: THREE.Scene
  private museumScene!: THREE.Scene

  private townBuilder!: TownBuilder
  private officeBuilder!: OfficeBuilder
  private museumBuilder!: MuseumBuilder
  private vehicleManager!: VehicleManager
  private vehiclePassengerNpcIds = new Set<string>()

  private gameClock!: GameClock
  private timeOfDayLighting!: TimeOfDayLighting
  private weatherSystem!: WeatherSystem
  private ambientSound = new AmbientSoundManager()
  private bgm = new BGMManager()
  private timeHUD!: TimeHUD
  private eventLogPanel!: EventLogPanel
  private socialFeedPanel!: SocialFeedPanel
  private modeManager = new ModeManager()
  private modeIndicator!: ModeIndicator
  private minigame: MinigameSlot | null = null
  private _minigameUpdateCb: ((dt: number) => void) | null = null
  private whiteboardHasPlan = false

  private townJournal!: TownJournal
  private encounterManager!: EncounterManager
  private casualEncounter!: CasualEncounter
  private personaStore = new PersonaStore()
  private npcProfiles: Map<string, NPCProfile> | null = null
  private selectedNpcId: string | null = null
  private selectedRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null
  private getNpcProfilesCached(): Map<string, NPCProfile> {
    if (!this.npcProfiles) this.npcProfiles = getNpcProfiles()
    return this.npcProfiles
  }
  private getConfiguredSpecialty(npcId: string): string | undefined {
    const config = this.configStore.load()
    if (npcId === 'user') {
      return config?.user.specialty ?? this.getNpcProfilesCached().get(npcId)?.specialty
    }
    if (npcId === 'steward') {
      return this.getNpcProfilesCached().get(npcId)?.specialty
    }
    return config?.citizens.find(c => c.id === npcId)?.specialty
      ?? this.getNpcProfilesCached().get(npcId)?.specialty
      ?? this.personaStore.get(npcId)?.specialty
  }
  private updateNpcProfession(npcId: string, specialty: string): void {
    const clean = specialty.trim()
    if (!clean || npcId === 'steward') return

    const config = this.configStore.load() ?? createDefaultTownConfig()
    const npc = this.npcManager.get(npcId)
    if (npcId === 'user') {
      config.user.specialty = clean
    } else {
      let citizen = config.citizens.find(c => c.id === npcId)
      if (!citizen) return
      citizen.specialty = clean
    }
    this.configStore.save(config)

    if (npcId !== 'user') {
      this.dailyScheduler.stopBehaviorForNpcs([npcId])
      this.dailyScheduler.addEligibleNpcId(npcId)
      this.dailyScheduler.startBehaviorForNpc(npcId)
    }
    const name = npc?.label ?? npc?.name ?? (npcId === 'user' ? config.user.name : npcId)
    this.ui.showToast(`${name} đổi nghề thành ${clean}`)
  }
  private inputEnabled = false
  private dialogTarget = 'steward'
  private followBehavior = new FollowBehavior()
  private playerMoveEnabled = true
  private playerKeys = new Set<string>()
  private playerWasKeyboardMoving = false
  private pendingDoorInteraction: { scene: SceneType; doorPos: THREE.Vector3 } | null = null
  private nearbyDoorInteraction: { buildingId: string; scene: SceneType; doorPos: THREE.Vector3; label: string } | null = null
  private interactionPromptEl: HTMLDivElement | null = null
  private lastTownEntranceBuildingId = 'office'
  private postTownReturnDebugFrames = 0
  private static readonly NON_INTERACTIVE_WORK_SUBSTATES = new Set<WorkSubState>([
    'summoning',
    'assigning',
    'going_to_office',
    'publishing',
    'returning',
  ])

  private skillLearnCard: import('../ui/SkillLearnCard').SkillLearnCard | null = null
  private bubbleDebugEnabled = this.readBubbleDebugFlag()
  private socialAppointments: SocialAppointment[] = []
  private townMapButton: HTMLButtonElement | null = null
  private townMapPanel: HTMLDivElement | null = null

  private dispatcher!: EventDispatcher
  private dialogManager!: DialogManager
  private sceneSwitcher!: SceneSwitcher
  private dailyScheduler!: DailyScheduler
  private bootstrap!: SceneBootstrap
  private workflow!: WorkflowHandler
  private choreographer!: Choreographer
  private citizenChat!: CitizenChatManager

  constructor(engine: Engine, dataSource: IWorldDataSource, configStore: TownConfigStore) {
    this.engine = engine
    this.dataSource = dataSource
    this.configStore = configStore
    this.ui = new UIManager()
  }

  async init(): Promise<void> {
    this.ui.init()

    this.setupUI = new TownSetupUI((action) => this.bootstrap.handleSetupAction(action))

    this.assets = new AssetLoader()
    await this.assets.preload(['characters', 'buildings', 'furniture', 'props'], (loaded, total) => {
      const pct = Math.round((loaded / total) * 100)
      console.log(`[Assets] Loading ${pct}% (${loaded}/${total})`)
    })

    NPC.setAssetLoader(this.assets)

    this.townScene = new THREE.Scene()
    this.townScene.background = new THREE.Color(0x87ceeb)
    this.townScene.fog = new THREE.Fog(0x87ceeb, 30, 60)

    this.officeScene = new THREE.Scene()
    this.officeScene.background = new THREE.Color(0x181818)

    this.museumScene = new THREE.Scene()
    this.museumScene.background = new THREE.Color(0xf0f0f0)

    this.townBuilder = new TownBuilder(this.townScene)
    this.townBuilder.build(this.assets)
    this.initSelectionRing()

    this.officeBuilder = new OfficeBuilder(this.officeScene)
    this.officeBuilder.build(this.assets)
    this.officeBuilder.startWhiteboardPolling('')
    this.officeBuilder.whiteboard.onStepProgress = (current, total) => {
      this.whiteboardHasPlan = total > 0
      if (this.modeIndicator && total > 0) {
        this.modeIndicator.setProgress(current, total)
      }
    }

    this.museumBuilder = new MuseumBuilder(this.museumScene)
    this.museumBuilder.build(this.assets)

    this.vehicleManager = new VehicleManager(this.townScene, {
      canBoard: (npcId, position) => this.canNpcBoardVehicle(npcId, position),
      onBoard: (npcId) => this.onNpcBoardVehicle(npcId),
      onLeave: (npcId, position) => this.onNpcLeaveVehicle(npcId, position),
    })
    this.vehicleManager.build(this.assets)

    this.engine.world.scene = this.townScene

    this.cameraCtrl = new CameraController(this.engine.camera, this.ui.getGameContainer())
    this.cameraCtrl.init()

    this.effects = new Effects(this.townScene)
    this.vfx = new VFXSystem(this.townScene, this.effects)
    this.vfx.setCamera(this.engine.camera)

    try { this.engine.initPostProcess() } catch { /* bloom not critical */ }

    this.gameClock = new GameClock()
    this.gameClock.setStorageKey(this.configStore.getScopedKey('agentshire_clock'))

    const lightingRefs = this.townBuilder.getLightingRefs()
    if (lightingRefs) {
      this.timeOfDayLighting = new TimeOfDayLighting(
        this.townScene, lightingRefs, this.engine.postProcess,
      )
    }

    this.timeHUD = new TimeHUD({
      onPauseToggle: () => {
        if (this.gameClock.isPaused()) {
          this.gameClock.resume()
          return false
        }
        this.gameClock.pause()
        return true
      },
      onSpeedChange: (speed) => {
        this.gameClock.setSpeed(3_600_000 / speed)
      },
    })
    this.eventLogPanel = new EventLogPanel()
    this.initTownMapOverlay()

    this.weatherSystem = new WeatherSystem(
      this.townScene,
      this.engine.camera,
      this.timeOfDayLighting,
      this.engine.postProcess,
      detectProfile(),
    )
    this.weatherSystem.onThunder((intensity) => {
      this.ambientSound.playThunder(intensity)
    })

    installDebugBindings({
      gameClock: {
        setTime: (h: number) => { this.gameClock.setTime(h) },
        setSpeed: (minutes: number) => { this.gameClock.setSpeed(minutes * 60_000) },
        pause: () => { this.gameClock.pause() },
        resume: () => { this.gameClock.resume() },
        getState: () => this.gameClock.getState(),
      },
      weather: {
        get: () => this.weatherSystem.getDisplayWeather(),
        theme: () => this.weatherSystem.getDayTheme(),
        set: (type: string) => this.weatherSystem.forceWeather(type as import('../types').WeatherType),
        setTheme: (theme: string) => this.weatherSystem.forceTheme(theme),
        themes: () => ['sunny','overcast','drizzleDay','rainy','stormy','snowy','blizzardDay','foggy','sandstormDay','auroraDay'],
        types: () => ['clear','cloudy','drizzle','rain','heavyRain','storm','lightSnow','snow','blizzard','fog','sandstorm','aurora'],
      },
      audio: {
        bgmVolume: (v: number) => this.bgm.setVolume(v),
        ambientVolume: (v: number) => this.ambientSound.setVolume(v),
        mute: () => { getAudioSystem().muted = true },
        unmute: () => { getAudioSystem().muted = false },
      },
    })

    const audio = getAudioSystem()
    await audio.preload()

    const actx = audio.getAudioContext()
    const sfxGain = audio.getSfxGain()
    if (actx && sfxGain) {
      this.ambientSound.init(actx, sfxGain)
      this.bgm.init(actx, sfxGain).catch(() => {})
    }

    this.bubbles = new ChatBubbleSystem(this.ui.getGameContainer(), this.engine.camera, this.engine.renderer)
    this.npcManager = new NPCManager(this.townScene, this.ui.getGameContainer())

    this.initSubModules()
    this.initEncounterManager()
    this.initModeSystem()
    this.initDebugHelpers()

    this.ui.on(event => {
      if (event.type === 'send_message') this.onUserMessage(event.text)
      if (event.type === 'play_now') {
        this.dataSource.sendAction({ type: 'game_popup_action', action: 'play_now', gameUrl: event.gameUrl })
        if (event.gameUrl) window.open(event.gameUrl, '_blank', 'noopener')
      }
      if (event.type === 'back_town') {
        this.sceneSwitcher.switchScene('town')
      }
      if (event.type === 'tab_change' && event.tab === 'world') this.bubbles.updateCamera(this.engine.camera)
      if (event.type === 'chat_with_citizen') {
        this.citizenChat.startChat(event.npcId)
      }
    })

    this.engine.input.on('tap', (gesture) => {
      this.handleTap(gesture.position.x, gesture.position.y)
    })

    this.engine.input.on('doubletap', () => {
      this.dialogTarget = 'steward'
      const stewardNpc = this.npcManager.get('steward')
      if (stewardNpc) this.cameraCtrl.follow(stewardNpc.mesh)
    })

    this.engine.input.on('drag', (gesture) => {
      this.cameraCtrl.onDrag(gesture.phase, gesture.delta, gesture.totalDelta)
    })

    this.engine.input.on('pinch', (gesture) => {
      this.cameraCtrl.onPinch(gesture.deltaScale)
    })

    window.addEventListener('keydown', this.onPlayerKeyDown)
    window.addEventListener('keyup', this.onPlayerKeyUp)

    this.dataSource.onGameEvent(event => this.handleGameEvent(event))

    this.ui.hideLoading()
    this.bootstrap.startFlow()
  }

  private initSubModules(): void {
    this.dailyScheduler = new DailyScheduler({
      npcManager: this.npcManager,
      gameClock: this.gameClock,
      encounterManager: this.encounterManager,
      personaStore: this.personaStore,
      getTownJournal: () => this.townJournal,
      getCurrentSceneType: () => this.sceneSwitcher.getSceneType(),
      getNpcSpecialty: (npcId) => this.getConfiguredSpecialty(npcId),
      getNpcHomeBuilding: (npcId) => this.getNpcHomeDoorKey(npcId),
    })

    this.dialogManager = new DialogManager({
      bubbles: this.bubbles,
      ui: this.ui,
      npcManager: this.npcManager,
      logBubble: (stage, text) => this.logBubbleText(stage, text),
      onNpcMessage: (npcId, text) => this.recordDirectNpcMessage(npcId, text),
    })

    this.sceneSwitcher = new SceneSwitcher({
      engine: this.engine,
      ui: this.ui,
      npcManager: this.npcManager,
      bubbles: this.bubbles,
      cameraCtrl: this.cameraCtrl,
      vfx: this.vfx,
      officeBuilder: this.officeBuilder,
      modeManager: this.modeManager,
      getModeIndicator: () => this.modeIndicator,
      gameClock: this.gameClock,
      townScene: this.townScene,
      officeScene: this.officeScene,
      museumScene: this.museumScene,
      weatherSystem: this.weatherSystem,
      getActiveOfficeNpcIds: () => this.workflow.getActiveOfficeNpcIds(),
      onRestoreOfficeSceneLayout: () => this.workflow.restoreOfficeSceneLayout(),
      onStopDailyBehaviors: () => this.dailyScheduler.stopDailyBehaviors(),
      onStopBehaviorForNpcs: (ids) => this.dailyScheduler.stopBehaviorForNpcs(ids),
      onScheduleStartDailyBehaviors: (ms) => this.dailyScheduler.scheduleStartDailyBehaviors(ms),
      onCleanupOfficeWork: () => this.workflow.cleanupOfficeWork(),
      onSyncTopHudLayout: () => this.syncTopHudLayout(),
      getTownDoorPosition: (buildingId) => {
        const targetBuildingId = buildingId === 'office' ? this.lastTownEntranceBuildingId : buildingId
        if (targetBuildingId === 'park') return { x: WAYPOINTS.park_center.x, z: WAYPOINTS.park_center.z }
        const marker = this.townBuilder.getDoorMarker(targetBuildingId)
        if (!marker) return null
        const pos = new THREE.Vector3()
        marker.getWorldPosition(pos)
        return { x: pos.x, z: pos.z }
      },
      getIndoorNpcIds: () => this.getIndoorNpcIdsForLastEntrance(),
      getSummonPlayed: () => this.workflow.summonPlayed,
      setSummonPlayed: (v) => { this.workflow.summonPlayed = v },
      getWorkingCitizens: () => this.workflow.workingCitizens,
      getPendingSummonNpcs: () => this.workflow.pendingSummonNpcs,
      setPendingSummonNpcs: (v) => { this.workflow.pendingSummonNpcs = v },
      setInputEnabled: (v) => { this.inputEnabled = v; this.playerMoveEnabled = v },
    })

    this.workflow = new WorkflowHandler({
      npcManager: this.npcManager,
      bubbles: this.bubbles,
      ui: this.ui,
      cameraCtrl: this.cameraCtrl,
      officeBuilder: this.officeBuilder,
      modeManager: this.modeManager,
      vfx: this.vfx,
      effects: this.effects,
      gameClock: this.gameClock,
      dataSource: this.dataSource,
      officeScene: this.officeScene,
      townScene: this.townScene,
      getModeIndicator: () => this.modeIndicator,
      getBehavior: (id) => this.dailyScheduler.getDailyBehaviors().get(id),
      getJournal: (id) => this.dailyScheduler.getActivityJournals().get(id),
      encounterManager: this.encounterManager,
      switchScene: (scene) => this.sceneSwitcher.switchScene(scene),
      scheduleStartDailyBehaviors: (ms) => this.dailyScheduler.scheduleStartDailyBehaviors(ms),
      startBehaviorForNpc: (id) => this.dailyScheduler.startBehaviorForNpc(id),
      stopBehaviorForNpcs: (ids) => this.dailyScheduler.stopBehaviorForNpcs(ids),
      despawnNpc: (npcId) => this.onNpcDespawn(npcId),
      setInputEnabled: (v) => { this.inputEnabled = v; this.playerMoveEnabled = v },
      hasWhiteboardPlan: () => this.whiteboardHasPlan,
    })

    this.choreographer = new Choreographer({
      npcManager: this.npcManager,
      bubbles: this.bubbles,
      ui: this.ui,
      cameraCtrl: this.cameraCtrl,
      modeManager: this.modeManager,
      vfx: this.vfx,
      gameClock: this.gameClock,
      dataSource: this.dataSource,
      getEncounterManager: () => this.encounterManager,
      officeBuilder: this.officeBuilder,
      officeScene: this.officeScene,
      workflow: this.workflow,
      getBehavior: (id) => this.dailyScheduler.getDailyBehaviors().get(id),
      getJournal: (id) => this.dailyScheduler.getActivityJournals().get(id),
      switchScene: (scene) => this.sceneSwitcher.switchScene(scene),
      getSceneType: () => this.sceneSwitcher.getSceneType(),
      dispatchGameEvent: (event) => this.handleGameEvent(event),
      setInputEnabled: (v) => { this.inputEnabled = v; this.playerMoveEnabled = v },
    })

    this.bootstrap = new SceneBootstrap({
      ui: this.ui,
      setupUI: this.setupUI,
      npcManager: this.npcManager,
      cameraCtrl: this.cameraCtrl,
      dataSource: this.dataSource,
      configStore: this.configStore,
      dispatchGameEvent: (event) => this.handleGameEvent(event),
      addEligibleNpcId: (id) => this.dailyScheduler.addEligibleNpcId(id),
      scheduleStartDailyBehaviors: (ms) => this.dailyScheduler.scheduleStartDailyBehaviors(ms),
      startSnapshotSaving: () => this.startSnapshotSaving(),
      setInputEnabled: (v) => { this.inputEnabled = v },
      setDialogTarget: (id, name) => {
        this.ui.setDialogTarget({
          id, name, color: 0x4488CC,
          spawn: { x: 0, y: 0, z: 0 }, role: 'producer', label: name,
        })
      },
    })

    this.citizenChat = new CitizenChatManager({
      npcManager: this.npcManager,
      getBehavior: (id) => this.dailyScheduler.getDailyBehaviors().get(id),
      getUser: () => this.npcManager.get('user'),
      getSteward: () => this.npcManager.get('steward'),
      getCameraCtrl: () => this.cameraCtrl,
      getFollowBehavior: () => this.followBehavior,
      getSceneType: () => this.sceneSwitcher.getSceneType(),
      getAvatarUrl: (npcId) => {
        const config = this.configStore.load()
        return config?.citizens.find(c => c.id === npcId)?.avatarUrl
      },
      onDialogTargetChange: (npcId) => { this.dialogTarget = npcId },
      onInputTargetChange: (npc) => {
        if (npc) {
          this.ui.updateChatTargetIndicator(npc, true)
        } else {
          this.ui.clearChatTarget()
        }
      },
    })

    const savedConfig = this.configStore.load()
    const stewardLabel = savedConfig?.steward.name ?? t('steward')
    const stewardNpc = this.npcManager.get('steward')
    this.ui.initChatTargetIndicator({
      stewardName: stewardLabel,
      stewardConfig: {
        id: 'steward', name: stewardLabel, color: 0x4488CC,
        spawn: { x: 0, y: 0, z: 0 }, role: 'producer', label: stewardLabel,
        characterKey: stewardNpc?.characterKey ?? savedConfig?.steward.avatarId,
        avatarUrl: savedConfig?.steward.avatarUrl,
      },
      onSwitchToSteward: () => {
        this.dialogTarget = 'steward'
        this.citizenChat.resetIdleTimer()
        this.ui.updateChatTargetIndicator(null, false)
      },
      onSwitchToCitizen: () => {
        const npcId = this.citizenChat.getActiveNpcId()
        if (!npcId || !this.citizenChat.canSwitchToCitizen()) return
        this.dialogTarget = npcId
        this.citizenChat.resetIdleTimer()
        this.ui.updateChatTargetIndicator(null, true)
      },
    })

    this.dispatcher = new EventDispatcher({
      onNpcSpawn: (e) => this.onNpcSpawn(e),
      onNpcDespawn: (npcId) => this.onNpcDespawn(npcId),
      onNpcPhase: (npcId, phase) => this.onNpcPhase(npcId, phase),
      onNpcMoveTo: (npcId, target, speed, requestId) => this.onNpcMoveTo(npcId, target, speed, requestId),
      onNpcDailyBehaviorReady: (npcId) => this.onNpcDailyBehaviorReady(npcId),
      onNpcEmote: (e) => {
        const npc = this.npcManager.get(e.npcId)
        if (npc) {
          const emoteMap: Record<string, string> = { frustrated: 'frustrated', happy: 'cheer', thinking: 'thinking', wave: 'wave' }
          const anim = emoteMap[e.emote]
          if (anim) npc.playAnim(anim)
          if (e.emote === 'frustrated') this.vfx.errorLightning(npc.getPosition())
          if (e.emote === 'happy') this.vfx.completionFirework(npc.getPosition())
        }
      },
      onNpcEmoji: (npcId, emoji) => this.onNpcEmoji(npcId, emoji),
      onNpcGlow: (npcId, color) => this.onNpcGlow(npcId, color),
      onNpcAnim: (npcId, anim) => this.onNpcAnim(npcId, anim),
      onNpcLookAt: (npcId, targetNpcId) => {
        const looker = this.npcManager.get(npcId)
        const lookTarget = this.npcManager.get(targetNpcId)
        if (looker && lookTarget) {
          const tPos = lookTarget.getPosition()
          const lPos = looker.getPosition()
          looker.smoothLookAt({ x: tPos.x, z: tPos.z })
          lookTarget.smoothLookAt({ x: lPos.x, z: lPos.z })
        }
      },
      onNpcWorkDone: (npcId, status, stationId, isTempWorker) => {
        this.workflow.handleNpcWorkDone(npcId, status, stationId, isTempWorker)
        this.minigame?.removeWorkingNpc(npcId)
      },
      onDialogMessage: (npcId, text, isStreaming) => this.dialogManager.onDialogMessage(npcId, text, isStreaming),
      onDialogEnd: (npcId) => this.dialogManager.onDialogEnd(npcId),
      onWorkstationAssign: (npcId, stationId) => {
        this.workflow.onWorkstationAssign(npcId, stationId)
        this.minigame?.addWorkingNpc(npcId)
      },
      onWorkstationScreen: (stationId, state) => this.officeBuilder.setScreenState(stationId, state),
      onSceneSwitch: (target) => this.sceneSwitcher.switchScene(target as SceneType),
      onFx: (effect, params) => this.onFx(effect, params),
      onProgress: (current, total, label) => {
        if (this.modeIndicator) {
          if (!this.whiteboardHasPlan) {
            this.modeIndicator.setProgress(current, total)
          }
          this.ui.hideProgress()
        } else {
          this.ui.setProgress(current, total, label)
        }
      },
      onCameraMove: (target, follow, durationMs) => this.onCameraMove(target, follow, durationMs),
      onNpcPersonaUpdate: (npcId, name) => {
        const npc = this.npcManager.get(npcId)
        if (npc) { npc.setLabel(name); this.personaStore.register(npcId, name) }
      },
      onSetupComplete: () => {
        this.bootstrap.hideTownInitLoading()
        this.inputEnabled = true
        const config = this.configStore.load()
        if (config && !this.npcManager.get('steward')) {
          this.bootstrap.spawnFromConfig(config)
          this.bootstrap.playReturnAnimation(config)
        }
        for (const npc of this.npcManager.getWorkers()) {
          this.dailyScheduler.addEligibleNpcId(npc.id)
        }
        this.dailyScheduler.scheduleStartDailyBehaviors(5000)
      },
      onModeChange: (event) => this.onModeChange(event),
      onSummonNpcs: (stewardId, npcIds, taskDescription) => this.workflow.handleSummonNpcs(stewardId, npcIds, taskDescription),
      onTaskBriefing: (lines, gameName) => {
        this.workflow.pendingBriefingLines = lines
        this.workflow.pendingBriefingGameName = gameName
      },
      onWorkStatusUpdate: (updates) => {
        for (const u of updates) this.onNpcPhase(u.npcId, u.phase)
      },
      onWorkComplete: (_taskDescription, gameUrl) => {
        if (gameUrl) this.workflow.pendingGameIframeSrc = gameUrl
      },
      onGameCompletionPopup: (gameName, gameUrl, previewImageUrl) => {
        this.workflow.pendingGameIframeSrc = gameUrl
        this.workflow.pendingGameCoverUrl = previewImageUrl ?? null
        this.workflow.pendingBriefingGameName = gameName
      },
      onDeliverableCard: (event) => {
        if (event.name) this.workflow.pendingBriefingGameName = event.name
        if (event.url) this.workflow.pendingGameIframeSrc = event.url
        this.ui.handleDeliverableCard(event, () => {
          this.dataSource.sendAction({ type: 'game_popup_action', action: 'later' })
        })
      },
      onNpcActivity: (event) => this.dialogManager.onNpcActivity(event),
      onNpcActivityStatus: (npcId, success) => this.dialogManager.onNpcActivityStatus(npcId, success),
      onNpcActivityStream: (npcId, delta) => this.dialogManager.onNpcActivityStream(npcId, delta),
      onNpcActivityStreamEnd: (npcId) => this.dialogManager.onNpcActivityStreamEnd(npcId),
      onNpcActivityTodo: (npcId, todos) => this.dialogManager.onNpcActivityTodo(npcId, todos),
      onNpcActivityRestore: (npcId, entries) => this.dialogManager.onNpcActivityRestore(npcId, entries),
      onSkillLearned: (slug) => {
        import('../ui/SkillLearnCard').then(({ SkillLearnCard }) => {
          if (!this.skillLearnCard) this.skillLearnCard = new SkillLearnCard()
          this.skillLearnCard.show(slug, (s) => this.workflow.playSkillAbsorb(s))
        }).catch(e => console.warn('[MainScene] SkillLearnCard import failed:', e))
      },
      onModeSwitch: (mode, taskDescription) => {
        if (mode === 'work' && taskDescription) {
          if (!this.modeManager.isWorkMode()) this.modeManager.enterWorkMode(taskDescription)
        } else if (mode === 'life') {
          this.modeManager.returnToLifeMode()
        }
      },
      onRestoreWorkState: (agents) => this.workflow.onRestoreWorkState(agents),
      onSetSessionId: async (sessionId) => {
        this.configStore.setSessionId(sessionId)
        const config = await this.bootstrap.loadFinalConfig()
        if (config && config.citizens.length > 0) {
          this.bootstrap.spawnFromConfig(config)
          this.bootstrap.playReturnAnimation(config)
        }
      },
      onTownConfigReady: (config) => {
        this.configStore.save(config)
        for (const c of config.citizens) {
          if (!this.npcManager.get(c.id)) {
            this.handleGameEvent({
              type: 'npc_spawn', npcId: c.id, name: c.name,
              role: c.specialty as GameNPCRole, category: 'citizen',
              specialty: c.specialty, persona: c.persona, avatarId: c.avatarId,
              modelUrl: c.modelUrl,
              modelTransform: c.modelTransform as any,
              animMapping: c.animMapping as any,
              animFileUrls: c.animFileUrls,
            })
          }
        }
      },
      onNpcChangeModel: (npcId, characterKey, modelUrl, modelTransform, animMapping, animFileUrls) => {
        const npc = this.npcManager.get(npcId)
        if (npc) {
          this.vfx.personaTransform(npc.mesh)
          npc.transitionCharacterKey(characterKey, 1800, { modelUrl, modelTransform, animMapping, animFileUrls })
        }
        const config = this.configStore.load()
        if (config) {
          const citizen = config.citizens.find((c: { id: string }) => c.id === npcId)
          if (citizen) citizen.avatarId = characterKey
          if (npcId === 'steward') config.steward.avatarId = characterKey
          this.configStore.save(config)
        }
      },
      onStewardRename: (newName, characterKey) => {
        const steward = this.npcManager.get('steward')
        if (steward) steward.setLabel(newName)
        if (steward && typeof characterKey === 'string' && characterKey) {
          steward.transitionCharacterKey(characterKey, 1800)
        }
        const config = this.configStore.load()
        if (config) { config.steward.name = newName; this.configStore.save(config) }
        this.ui.setDialogTarget({
          id: 'steward', name: newName, color: 0x4488CC,
          spawn: { x: 0, y: 0, z: 0 }, role: 'producer', label: newName,
        })
        this.ui.updateStewardName(newName)
      },
      onSetTime: (event) => {
        if (event.action === 'set' && event.hour != null) this.gameClock.setTime(event.hour)
        else if (event.action === 'pause') this.gameClock.pause()
        else if (event.action === 'resume') this.gameClock.resume()
      },
      onSetWeather: (event) => {
        if (event.action === 'set' && event.weather) {
          this.weatherSystem.forceWeather(event.weather as import('../types').WeatherType)
        } else if (event.action === 'reset') {
          this.weatherSystem.resetToAutomatic()
        }
      },
      onWorkflowIntent: (event) => this.choreographer.handleIntent(event),
    })
  }

  private readBubbleDebugFlag(): boolean {
    try {
      const search = new URLSearchParams(globalThis.location?.search ?? '')
      if (search.get('bubbleDebug') === '1') return true
      const local = globalThis.localStorage?.getItem?.('agentshire_bubble_debug')
      return local === '1' || local === 'true'
    } catch {
      return false
    }
  }

  private logBubbleText(stage: string, text: string): void {
    if (!this.bubbleDebugEnabled) return
    const clean = cleanBubbleText(text)
    if (clean === text) {
      console.log(`[BubbleDebug][MainScene][${stage}] raw=${JSON.stringify(text)}`)
      return
    }
    console.log(
      `[BubbleDebug][MainScene][${stage}] raw=${JSON.stringify(text)} clean=${JSON.stringify(clean)}`,
    )
  }

  private initEncounterManager(): void {
    this.encounterManager = new EncounterManager(this.gameClock)
    this.casualEncounter = new CasualEncounter(
      (npcId, text, durationMs) => {
        const npc = this.npcManager.get(npcId)
        if (npc) this.bubbles.show(npc.mesh, text, durationMs)
      },
      (npcId, anim) => {
        const npc = this.npcManager.get(npcId)
        if (npc) npc.playAnim(anim as any)
      },
      (npcId) => {
        this.dailyScheduler.getDailyBehaviors().get(npcId)?.pauseForDialogue()
      },
      (npcId) => {
        this.dailyScheduler.getDailyBehaviors().get(npcId)?.resumeFromDialogue()
      },
      (npcId) => !!this.dailyScheduler.getDailyBehaviors().get(npcId)?.inDialogue,
      (npcId) => getGodSimNpcProfile(npcId),
      (npcId) => this.dailyScheduler.getActivityJournals().get(npcId),
      (npcId) => this.getConfiguredSpecialty(npcId),
      (req) => this.dailyScheduler.implicitChatForBrain(req),
      (event) => this.handleCasualEvent(event),
    )
    this.townJournal = new TownJournal(this.gameClock, {
      implicitChat: (req) => this.dailyScheduler.implicitChatForBrain(req),
    })
    this.socialFeedPanel = new SocialFeedPanel({
      getEvents: () => this.townJournal.getRecentArchiveEvents(500),
      getNpcs: () => this.getSocialNpcSnapshots(),
    })
    this.townJournal.onEvent((event) => {
      this.eventLogPanel?.add(event)
      this.socialFeedPanel?.refresh()
    })
    this.eventLogPanel?.restore(this.townJournal.getRecentEvents(60))
    this.gameClock.onPeriodChange('encounter-day-reset', (state) => {
      if (state.period === 'dawn') this.encounterManager.resetDayCooldowns()
    })
    this.gameClock.onPeriodChange('town-journal-period', (state) => {
      this.townJournal.recordTimeChange(state.period)
      if (state.period === 'night') this.dailyScheduler.triggerNightlyRoutine()
    })
    this.encounterManager.setOnBubble((npc, text, duration) => {
      this.bubbles.show(npc.mesh, text, duration)
    })
    this.encounterManager.setOnBubbleEnd((npc) => {
      this.bubbles.endStream(npc.mesh)
    })
    this.encounterManager.setJournalAccessor((id) => this.dailyScheduler.getActivityJournals().get(id))
    this.encounterManager.setBehaviorAccessor((id) => this.dailyScheduler.getDailyBehaviors().get(id))
    this.encounterManager.setNpcListAccessor(() => this.npcManager.getAll())
    this.encounterManager.setPersonaStore(this.personaStore)
    this.encounterManager.setDialogueProvider(async (opts) => {
      return this.dailyScheduler.dialogueProviderImpl(opts)
    })
    this.encounterManager.setOnDialogueComplete((initiatorId, responderId, turns, summary) => {
      const initiator = this.npcManager?.get(initiatorId)
      const responder = this.npcManager?.get(responderId)
      const iName = initiator?.label ?? initiatorId
      const rName = responder?.label ?? responderId
      this.townJournal.recordEncounterStart(iName, rName, 'town')
      for (const turn of turns) {
        this.townJournal.recordEncounterMessage(turn.speaker, turn.text, 'town')
      }
      this.townJournal.recordEncounterEnd(iName, rName, summary, 'town')
    })
  }

  private initModeSystem(): void {
    this.modeIndicator = new ModeIndicator()

    this.modeManager.onModeChange('daily-behavior', (state) => {
      const behaviors = this.dailyScheduler.getDailyBehaviors()
      const brains = this.dailyScheduler.getAgentBrains()
      if (state.mode === 'work') {
        this.townJournal.recordModeChange('work', state.taskDescription ? `Quản gia giao nhiệm vụ: ${state.taskDescription}` : undefined)
        for (const id of state.summonedNpcIds) {
          behaviors.get(id)?.interrupt('summoned')
          brains.get(id)?.suspend()
        }
      } else {
        this.townJournal.recordModeChange('life')
        for (const [id, db] of behaviors) {
          if (!db.isActive()) continue
          const s = db.getState()
          if (s === 'summoned' || s === 'gathered' || s === 'assigned' || s === 'at_office') {
            db.resume()
            brains.get(id)?.resume()
          }
        }
      }
    })

    this.modeManager.onModeChange('encounter', (state) => {
      this.encounterManager.setExcludedNpcs(new Set(state.summonedNpcIds))
    })

    this.modeManager.onModeChange('gameclock', (state) => {
      if (state.mode === 'life' || state.mode === 'work') this.gameClock?.resume()
    })

    this.modeManager.onModeChange('mode-indicator', (state) => {
      this.modeIndicator?.update(state)
      this.syncTopHudLayout()
    })

    this.modeIndicator.setActionCallback(() => {
      const cur = this.sceneSwitcher.getSceneType()
      this.sceneSwitcher.switchScene(cur === 'office' ? 'town' : 'office')
    })
    this.syncTopHudLayout()

    this.minigame = new BanweiGame()
    this.minigame.mount({
      camera: this.engine.camera,
      renderer: this.engine.renderer,
      container: this.ui.getGameContainer(),
      getNpc: (id) => this.npcManager.get(id),
      getNpcVoiceConfig: (id) => {
        const npc = this.npcManager.get(id)
        if (!npc) return null
        const currentConfig = this.configStore.load()
        const configAvatarUrl = id === 'steward'
          ? currentConfig?.steward.avatarUrl
          : id === 'user'
            ? currentConfig?.user.avatarUrl
            : currentConfig?.citizens.find(c => c.id === id)?.avatarUrl
        return {
          id,
          name: npc.name ?? id,
          color: npc.color,
          spawn: { x: 0, y: 0, z: 0 },
          role: 'worker',
          label: npc.label ?? npc.name ?? id,
          characterKey: npc.characterKey,
          avatarUrl: configAvatarUrl,
        }
      },
      getWorkingNpcIds: () => this.workflow.getActiveOfficeNpcIds(),
      getSceneType: () => this.sceneSwitcher.getSceneType(),
      onUpdate: (cb) => { this._minigameUpdateCb = cb },
      offUpdate: () => { this._minigameUpdateCb = null },
    })
    this.modeManager.onModeChange('banwei-minigame', (state) => {
      if (state.mode === 'work' && state.workSubState === 'working') {
        this.minigame?.start()
      } else {
        this.minigame?.stop()
      }
    })
  }

  private initDebugHelpers(): void {
    const sched = this.dailyScheduler
    installDebugBindings({
      mode: {
        get: () => this.modeManager.getState(),
        enterWork: (task: string) => this.modeManager.enterWorkMode(task),
        advance: (s: string) => this.modeManager.advanceWorkState(s as WorkSubState),
        returnLife: () => this.modeManager.returnToLifeMode(),
        setSummoned: (ids: string[]) => this.modeManager.setSummonedNpcs(ids),
        summon: (npcIds: string[], task = '测试任务') =>
          this.workflow.handleSummonNpcs('steward', npcIds, task),
      },
      journals: {
        get: (npcId: string) => sched.getActivityJournals().get(npcId),
        list: () => Array.from(sched.getActivityJournals().keys()),
        dump: (npcId: string) => {
          const j = sched.getActivityJournals().get(npcId)
          return j ? { entries: j.getEntries(), dialogues: j.getDialogues() } : null
        },
      },
      encounter: {
        activeCount: () => this.encounterManager.getActiveDialogueCount(),
        resetCooldowns: () => this.encounterManager.resetDayCooldowns(),
      },
      daily: {
        list: () => Array.from(sched.getDailyBehaviors().entries()).map(([id, b]) => ({ id, state: b.getState(), active: b.isActive() })),
        get: (id: string) => {
          const b = sched.getDailyBehaviors().get(id)
          return b ? { state: b.getState(), active: b.isActive() } : null
        },
      },
      townJournal: {
        events: (n?: number) => this.townJournal.getRecentEvents(n),
        descriptions: (n?: number) => this.townJournal.getRecentDescriptions(n),
        summaries: () => this.townJournal.getAllSummaries(),
        todayCount: () => this.townJournal.getCurrentDayEventCount(),
      },
      workflow: {
        testSummon: (npcIds?: string[]) => {
          const ids = npcIds ?? ['citizen_1', 'citizen_2']
          const agents = ids.map(id => {
            const npc = this.npcManager.get(id)
            return { npcId: id, displayName: npc?.label ?? id, task: '测试任务' }
          })
          this.handleGameEvent({ type: 'workflow_summon', agents } as any)
        },
        testAssign: (npcIds?: string[]) => {
          const ids = npcIds ?? ['citizen_1', 'citizen_2']
          const agents = ids.map(id => {
            const npc = this.npcManager.get(id)
            return { npcId: id, displayName: npc?.label ?? id, task: '测试任务' }
          })
          this.handleGameEvent({ type: 'workflow_assign', agents } as any)
        },
        testPublish: () => {
          this.handleGameEvent({
            type: 'workflow_publish',
            summary: '测试完成了！',
            deliverableCards: [],
            agents: Array.from(this.workflow.officeNpcStations.keys()).map(id => ({
              npcId: id, displayName: this.npcManager.get(id)?.label ?? id, status: 'completed',
            })),
          } as any)
        },
        testReturn: () => {
          const agents = Array.from(this.workflow.officeNpcStations.keys()).map(id => ({ npcId: id }))
          this.handleGameEvent({ type: 'workflow_return', agents, wasInOffice: true } as any)
        },
        testNpcDone: (npcId?: string) => {
          const id = npcId ?? Array.from(this.workflow.officeNpcStations.keys())[0]
          if (!id) { console.warn('No NPC in office'); return }
          const station = this.workflow.officeNpcStations.get(id)
          this.handleGameEvent({ type: 'npc_work_done', npcId: id, status: 'completed', stationId: station } as any)
        },
        testCelebrate: () => {
          const npcs = Array.from(this.workflow.officeNpcStations.keys()).map(id => ({
            npcId: id, displayName: this.npcManager.get(id)?.label ?? id, status: 'completed',
          }))
          this.handleGameEvent({
            type: 'workflow_publish', summary: '测试庆祝！', deliverableCards: [], agents: npcs,
          } as any)
        },
        testBanwei: (npcIds?: string[]) => {
          const ids = npcIds ?? this.npcManager.getAll().filter(n => n.id !== 'user' && n.id !== 'steward').map(n => n.id).slice(0, 3)
          this.modeManager.enterWorkMode('班味测试')
          this.modeManager.forceWorkSubState('working')
          for (const id of ids) this.minigame?.addWorkingNpc(id)
          console.log('[Debug] Banwei test started with NPCs:', ids)
        },
        testBanweiStop: () => {
          this.modeManager.returnToLifeMode()
          console.log('[Debug] Banwei test stopped')
        },
        help: () => {
          console.log(`
__workflow 演出测试指令:
  testSummon(['citizen_1','citizen_2'])  — 召唤集结（默认 citizen_1+2）
  testAssign(['citizen_1','citizen_2'])  — 任务分配 + 行军 + 进办公室
  testNpcDone('citizen_1')              — 单个 NPC 完成离场
  testPublish()                         — 庆祝发布
  testReturn()                          — 返回小镇散场
  testCelebrate()                       — 庆祝（= testPublish 别名）
  testBanwei(['citizen_1'])             — 启动班味小游戏测试
  testBanweiStop()                      — 停止班味小游戏
  help()                                — 显示本帮助
          `)
        },
      },
    })
  }

  // ── User message from input bar ──

  showUserBubble(text: string, skipLocalCitizenReply = false, targetNpcId = this.dialogTarget): void {
    const userNpc = this.npcManager.get('user')
    this.logBubbleText('user_message', text)
    if (userNpc) this.bubbles.show(userNpc.mesh, text, getBubbleDurationMs(text, 'user'))
    this.ui.addChatMessage({ from: t('mayor'), text, timestamp: Date.now() })
    const targetName = this.getDialogTargetName(targetNpcId)
    this.townJournal?.recordPlayerMessage(this.getPlayerName(), text, targetName)
    if (targetNpcId && targetNpcId !== 'steward') {
      const journal = this.dailyScheduler.getActivityJournals().get(targetNpcId)
      journal?.updateRelationship(
        { npcId: 'user', name: this.getPlayerName() },
        { topic: text.slice(0, 80), sentimentDelta: 0.05, trustDelta: 0.03 },
      )
      this.socialFeedPanel?.refresh()
      this.saveSnapshot()
    }
    this.citizenChat.onUserMessage(targetNpcId)
    if (!skipLocalCitizenReply) this.replyFromLocalCitizenIfNeeded(text)
  }

  private initTownMapOverlay(): void {
    if (this.townMapButton || this.townMapPanel) return
    const root = this.ui.getGameContainer()

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Bản đồ'
    button.style.cssText = [
      'position:absolute',
      'left:16px',
      'bottom:92px',
      'z-index:35',
      'height:38px',
      'padding:0 14px',
      'border-radius:8px',
      'border:1px solid rgba(255,255,255,0.22)',
      'background:rgba(15,23,42,0.88)',
      'color:#fff7dc',
      'font:800 14px/38px system-ui,Segoe UI,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
      'backdrop-filter:blur(10px)',
      'cursor:pointer',
    ].join(';')

    const panel = document.createElement('div')
    panel.style.cssText = [
      'position:absolute',
      'left:16px',
      'bottom:140px',
      'z-index:35',
      'width:min(560px,calc(100vw - 32px))',
      'display:none',
      'border-radius:10px',
      'border:1px solid rgba(245,196,91,0.5)',
      'background:rgba(15,23,42,0.94)',
      'color:white',
      'box-shadow:0 18px 48px rgba(0,0,0,0.38)',
      'backdrop-filter:blur(14px)',
      'padding:12px',
      'font-family:system-ui,Segoe UI,sans-serif',
    ].join(';')

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div style="font-weight:900;font-size:16px;color:#fff3c4;">Bản đồ thị trấn</div>
        <button type="button" data-close-map style="width:28px;height:28px;border-radius:7px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:white;font-weight:900;cursor:pointer;">×</button>
      </div>
      <div style="display:grid;gap:8px;">
        ${this.mapRowHtml('#7dd3fc', 'TRÁI', 'Khu nhà ở')}
        ${this.mapRowHtml('#86efac', 'GIỮA', 'Quảng trường, công ty')}
        ${this.mapRowHtml('#fda4af', 'PHẢI', 'Chợ, cafe, quán ăn')}
        ${this.mapRowHtml('#ddd6fe', 'GẦN', 'Công viên, nhà văn hóa')}
      </div>
      <div style="margin-top:10px;color:rgba(255,255,255,0.68);font-size:12px;line-height:1.4;">
        Biển hiệu nổi trên từng địa điểm cho biết tên chính xác của nơi đó.
      </div>
    `

    const toggle = () => {
      const open = panel.style.display === 'none'
      panel.style.display = open ? 'block' : 'none'
      if (open) this.renderTownMap()
      button.setAttribute('aria-expanded', String(open))
    }
    button.addEventListener('click', toggle)
    panel.querySelector('[data-close-map]')?.addEventListener('click', () => {
      panel.style.display = 'none'
      button.setAttribute('aria-expanded', 'false')
    })

    root.appendChild(button)
    root.appendChild(panel)
    this.townMapButton = button
    this.townMapPanel = panel
    this.renderTownMap()
  }

  private renderTownMap(): void {
    if (!this.townMapPanel) return
    const places = [
      { key: 'house_a_door', name: 'Nhà Minh', x: WAYPOINTS.house_a_door.x, z: WAYPOINTS.house_a_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_b_door', name: 'Nhà Lan', x: WAYPOINTS.house_b_door.x, z: WAYPOINTS.house_b_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_c_door', name: 'Nhà Hà', x: WAYPOINTS.house_c_door.x, z: WAYPOINTS.house_c_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_d_door', name: 'Nhà An', x: WAYPOINTS.house_d_door.x, z: WAYPOINTS.house_d_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_e_door', name: 'Nhà Khôi', x: WAYPOINTS.house_e_door.x, z: WAYPOINTS.house_e_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_f_door', name: 'Nhà Vy', x: WAYPOINTS.house_f_door.x, z: WAYPOINTS.house_f_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'house_g_door', name: 'Nhà Bảo', x: WAYPOINTS.house_g_door.x, z: WAYPOINTS.house_g_door.z, w: 4.0, h: 3.0, c: '#7dd3fc' },
      { key: 'user_home_door', name: 'Nhà bạn', x: WAYPOINTS.user_home_door.x, z: WAYPOINTS.user_home_door.z, w: 4.2, h: 2.8, c: '#fde68a' },
      { key: 'office_door', name: 'Công ty', x: WAYPOINTS.office_door.x, z: WAYPOINTS.office_door.z, w: 7.2, h: 3.4, c: '#86efac' },
      { key: 'coworking_door', name: 'Văn phòng nhỏ', x: WAYPOINTS.coworking_door.x, z: WAYPOINTS.coworking_door.z, w: 5.2, h: 3.2, c: '#86efac' },
      { key: 'clinic_door', name: 'Phòng khám', x: WAYPOINTS.clinic_door.x, z: WAYPOINTS.clinic_door.z, w: 4.8, h: 3.0, c: '#67e8f9' },
      { key: 'market_door', name: 'Chợ', x: WAYPOINTS.market_door.x, z: WAYPOINTS.market_door.z, w: 6.0, h: 3.4, c: '#fda4af' },
      { key: 'cafe_door', name: 'Cafe', x: WAYPOINTS.cafe_door.x, z: WAYPOINTS.cafe_door.z, w: 5.8, h: 3.4, c: '#fdba74' },
      { key: 'restaurant_door', name: 'Quán ăn', x: WAYPOINTS.restaurant_door.x, z: WAYPOINTS.restaurant_door.z, w: 6.0, h: 3.4, c: '#fb7185' },
      { key: 'museum_door', name: 'Nhà văn hóa', x: WAYPOINTS.museum_door.x, z: WAYPOINTS.museum_door.z, w: 6.0, h: 3.2, c: '#ddd6fe' },
      { key: 'park_center', name: 'Công viên', x: WAYPOINTS.park_center.x, z: WAYPOINTS.park_center.z, w: 8.0, h: 4.4, c: '#bbf7d0' },
    ]
    const sx = (x: number) => (x / 56) * 100
    const sz = (z: number) => (z / 34) * 100
    const npcs = (this.npcManager?.getAll() ?? [])
      .filter(n => n.mesh.visible && n.isInActiveScene)
      .map(n => {
        const p = n.getPosition()
        const name = n.id === 'user' ? 'Bạn' : (n.label ?? n.name ?? n.id)
        const color = n.id === 'user' ? '#facc15' : n.id === 'steward' ? '#c4b5fd' : '#ffffff'
        return `<div title="${name}" style="position:absolute;left:${sx(p.x)}%;top:${sz(p.z)}%;width:9px;height:9px;border-radius:999px;background:${color};border:2px solid #111827;transform:translate(-50%,-50%);box-shadow:0 0 0 2px rgba(255,255,255,0.22);"></div>
          <div style="position:absolute;left:${sx(p.x)}%;top:calc(${sz(p.z)}% + 8px);transform:translateX(-50%);font-size:10px;font-weight:900;color:white;text-shadow:0 1px 3px #000;white-space:nowrap;">${name}</div>`
      }).join('')
    const placeHtml = places.map(p => `
      <div style="position:absolute;left:${sx(p.x)}%;top:${sz(p.z)}%;width:${(p.w / 56) * 100}%;height:${(p.h / 34) * 100}%;transform:translate(-50%,-50%);border-radius:6px;background:${p.c};border:1px solid rgba(15,23,42,0.75);display:flex;align-items:center;justify-content:center;text-align:center;color:#111827;font-size:10px;font-weight:900;padding:2px;box-sizing:border-box;line-height:1.05;">${p.name}</div>
    `).join('')
    this.townMapPanel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div style="font-weight:900;font-size:16px;color:#fff3c4;">Bản đồ thị trấn</div>
        <button type="button" data-close-map style="width:28px;height:28px;border-radius:7px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:white;font-weight:900;cursor:pointer;">×</button>
      </div>
      <div style="position:relative;width:100%;aspect-ratio:56/34;border-radius:8px;overflow:hidden;background:#345d3a;border:1px solid rgba(255,255,255,0.16);">
        <div style="position:absolute;left:0;top:91%;width:100%;height:7%;background:#4b5563;"></div>
        <div style="position:absolute;left:27%;top:18%;width:4%;height:75%;background:#4b5563;"></div>
        <div style="position:absolute;left:68%;top:18%;width:4%;height:75%;background:#4b5563;"></div>
        <div style="position:absolute;left:28%;top:53%;width:43%;height:6%;background:#4b5563;"></div>
        ${placeHtml}
        ${npcs}
      </div>
      <div style="margin-top:8px;color:rgba(255,255,255,0.7);font-size:12px;">Chấm vàng: bạn · tím: quản gia · trắng: cư dân.</div>
    `
    this.townMapPanel.querySelector('[data-close-map]')?.addEventListener('click', () => {
      if (!this.townMapPanel || !this.townMapButton) return
      this.townMapPanel.style.display = 'none'
      this.townMapButton.setAttribute('aria-expanded', 'false')
    })
  }

  private mapRowHtml(color: string, label: string, text: string): string {
    return `
      <div style="display:grid;grid-template-columns:74px 1fr;align-items:center;gap:10px;">
        <div style="border-radius:8px;background:${color};color:#111827;font-weight:900;font-size:12px;text-align:center;padding:7px 0;">${label}</div>
        <div style="font-weight:800;font-size:14px;color:white;">${text}</div>
      </div>
    `
  }

  getDialogTarget(): string {
    return this.dialogTarget
  }

  getUIManager(): UIManager { return this.ui }
  getModeManager(): ModeManager { return this.modeManager }
  isNpcVisible(npcId: string): boolean { return !!this.npcManager.get(npcId)?.mesh.visible }

  getAgentEnabledCitizens(): Array<{ id: string; name: string; specialty: string; color: number; characterKey?: string; avatarUrl?: string; spawned: boolean }> {
    const config = this.configStore.load()
    if (!config) return []
    const agentMap = this.bootstrap.agentConfigMap
    return config.citizens
      .filter(c => agentMap.get(c.id)?.agentEnabled)
      .map(c => ({
        id: c.id,
        name: c.name,
        specialty: c.specialty,
        color: 0x4488CC,
        characterKey: c.avatarId,
        avatarUrl: c.avatarUrl,
        spawned: !!this.npcManager.get(c.id)?.mesh.visible,
      }))
  }

  setMusicEnabled(enabled: boolean): void {
    if (enabled) {
      this.bgm.setEnabled(true)
      this.ambientSound.setEnabled(true)
    } else {
      this.bgm.setEnabled(false)
      this.ambientSound.setEnabled(false)
    }
  }

  private getNpcHomeDoorKey(npcId: string): string {
    if (npcId === 'user') return 'user_home_door'
    const defaultHomes: Record<string, string> = {
      citizen_1: 'house_a_door',
      citizen_2: 'house_b_door',
      citizen_3: 'house_c_door',
      citizen_4: 'house_d_door',
      citizen_5: 'house_e_door',
      citizen_6: 'house_f_door',
      citizen_7: 'house_g_door',
    }
    if (defaultHomes[npcId]) return defaultHomes[npcId]

    const config = this.configStore.load()
    const homeId = config?.citizens.find(c => c.id === npcId)?.homeId
    const key = this.normalizeHomeDoorKey(homeId)
    if (key && WAYPOINTS[key]) return key
    return defaultHomes[npcId] ?? 'house_a_door'
  }

  private normalizeHomeDoorKey(homeId?: string): string | null {
    if (!homeId) return null
    if (homeId.endsWith('_door')) return homeId
    return `${homeId}_door`
  }

  private getIndoorNpcIdsForLastEntrance(): string[] {
    const doorKey = this.getDoorKeyForBuildingId(this.lastTownEntranceBuildingId)
    const wp = WAYPOINTS[doorKey]
    const doorPos = wp ? new THREE.Vector3(wp.x, 0, wp.z) : null
    const ids: string[] = []

    for (const npc of this.npcManager.getAll()) {
      if (npc.id === 'user' || npc.id === 'steward') continue
      const recent = this.dailyScheduler.getActivityJournals().get(npc.id)?.getRecentActivities(3) ?? []
      const loggedHere = recent.some(entry =>
        entry.location === doorKey && (entry.action === 'arrived' || entry.action === 'staying' || entry.action === 'chatted')
      )
      const nearDoor = doorPos ? npc.getPosition().distanceTo(doorPos) < 4.2 : false
      if (loggedHere || nearDoor) ids.push(npc.id)
    }

    return ids
  }

  private getDoorKeyForBuildingId(buildingId: string): string {
    if (buildingId === 'park') return 'park_center'
    return buildingId.endsWith('_door') ? buildingId : `${buildingId}_door`
  }

  setSoulModeEnabled(enabled: boolean): void {
    if (enabled) {
      this.dailyScheduler.enableSoulMode()
    } else {
      this.dailyScheduler.disableSoulMode()
    }
  }

  // ── Topic mode (group discussion) ──

  private topicNpcIds: string[] = []
  private topicGathering = false

  isTopicActive(): boolean {
    return this.topicNpcIds.length > 0
  }

  isTopicGathering(): boolean {
    return this.topicGathering
  }

  async gatherForTopic(npcIds: string[]): Promise<void> {
    this.topicNpcIds = npcIds
    this.topicGathering = true

    for (const id of npcIds) {
      this.dailyScheduler.getDailyBehaviors().get(id)?.pauseForDialogue()
      const npc = this.npcManager.get(id)
      if (npc) npc.transitionTo('idle')
    }

    const userNpc = this.npcManager.get('user')
    if (!userNpc) { this.topicGathering = false; return }
    const center = userNpc.mesh.position.clone()

    const RADIUS = 3.0
    const ARC_SPAN = Math.PI
    const startAngle = -ARC_SPAN / 2

    const targets: Array<{ npcId: string; pos: { x: number; z: number } }> = []
    for (let i = 0; i < npcIds.length; i++) {
      const angle = startAngle + (ARC_SPAN / Math.max(npcIds.length - 1, 1)) * i
      targets.push({
        npcId: npcIds[i],
        pos: {
          x: center.x + Math.sin(angle) * RADIUS,
          z: center.z + Math.cos(angle) * RADIUS,
        },
      })
    }

    const movePromises: Promise<void>[] = []
    for (const t of targets) {
      const npc = this.npcManager.get(t.npcId)
      if (!npc) continue
      const speed = this.dailyScheduler.getDailyBehaviors().get(t.npcId)?.getWalkSpeed() ?? 2.5
      movePromises.push(
        npc.moveTo(t.pos, speed).then(() => {
          const dx = center.x - npc.mesh.position.x
          const dz = center.z - npc.mesh.position.z
          npc.mesh.rotation.y = Math.atan2(dx, dz)
          npc.transitionTo('emoting')
        }),
      )
    }

    const timeout = new Promise<void>(r => setTimeout(r, 15000))
    await Promise.race([Promise.all(movePromises), timeout])

    this.topicGathering = false
  }

  dismissTopic(): void {
    const npcIds = [...this.topicNpcIds]
    this.topicNpcIds = []
    this.topicGathering = false

    for (const npcId of npcIds) {
      const npc = this.npcManager.get(npcId)
      if (!npc) continue
      npc.transitionTo('idle')
      this.dailyScheduler.getDailyBehaviors().get(npcId)?.resumeFromDialogue()
    }
  }

  private onUserMessage(text: string): void {
    if (!this.inputEnabled) return

    const speechTarget = this.resolveTownSpeechTarget()
    this.syncDialogTarget(speechTarget)
    const mayBeAppointment = this.isPlayerAppointmentText(text)
    this.showUserBubble(text, mayBeAppointment, speechTarget)
    this.capturePlayerAppointment(text)
    this.dataSource.sendAction({ type: 'user_message', targetNpcId: speechTarget, text })
  }

  // ── Central GameEvent dispatcher ──

  handleGameEvent(event: GameEvent): void {
    this.dispatcher.dispatch(event)
  }

  // ── GameEvent handlers ──

  private onNpcSpawn(event: GameEvent & { type: 'npc_spawn' }): void {
    const existing = this.npcManager.get(event.npcId)
    if (existing) {
      if (event.task && event.category === 'citizen') {
        this.workflow.workingCitizens.add(event.npcId)
        this.workflow.summonPlayed = true
      }
      return
    }
    const finalCharacterKey = getCharacterKeyForNpc(
      event.npcId,
      typeof event.avatarId === 'string' ? event.avatarId : undefined,
    )
    this.debugCharacterAssignments.set(event.npcId, finalCharacterKey)

    const colorMap: Record<string, number> = {
      steward: 0x4488CC, citizen_1: 0xBB66CC, citizen_2: 0x44AA44,
      citizen_3: 0x6688AA, citizen_4: 0xCC8844, citizen_5: 0xCC6688, user: 0xDDAA44,
    }

    const homeKey = this.getNpcHomeDoorKey(event.npcId)
    const homeWp = WAYPOINTS[homeKey]

    let spawn: { x: number; y: number; z: number }
    let startHidden = false
    if (event.spawn) {
      spawn = { x: event.spawn.x, y: event.spawn.y ?? 0, z: event.spawn.z }
    } else if (event.npcId === 'steward') {
      spawn = { x: WAYPOINTS.plaza_side.x, y: 0, z: WAYPOINTS.plaza_side.z }
    } else if (event.npcId === 'user') {
      spawn = { x: WAYPOINTS.road_entrance.x, y: 0, z: WAYPOINTS.road_entrance.z }
    } else if (homeWp) {
      spawn = { x: homeWp.x, y: 0, z: homeWp.z }
      startHidden = true
    } else {
      spawn = { x: WAYPOINTS.plaza_center.x, y: 0, z: WAYPOINTS.plaza_center.z }
    }

    const config: NPCConfig = {
      id: event.npcId, name: event.name,
      color: colorMap[event.npcId] ?? 0x888888,
      spawn,
      role: event.category === 'steward' ? 'producer' : event.npcId === 'user' ? 'user' : 'worker',
      label: event.name, characterKey: finalCharacterKey,
      modelUrl: event.modelUrl,
      modelTransform: event.modelTransform,
      animMapping: event.animMapping,
      animFileUrls: event.animFileUrls,
    }

    this.npcManager.createNPCs([config])

    if (startHidden) {
      const npc = this.npcManager.get(event.npcId)
      if (npc) npc.setVisible(false)
    }

    if (event.category === 'citizen' || event.category === 'steward') {
      this.personaStore.register(
        event.npcId, event.name,
        typeof event.persona === 'string' ? event.persona : undefined,
      )
    }

    if (event.category === 'steward') {
      this.ui.setDialogTarget(config)
      this.ui.updateStewardName(config.name)
      this.dialogTarget = 'steward'
    }
    if (event.task && event.category === 'citizen') {
      this.workflow.workingCitizens.add(event.npcId)
    }

    if (event.arrivalFanfare) {
      const npc = this.npcManager.get(event.npcId)
      if (npc) {
        requestAnimationFrame(() => {
          this.handleGameEvent({ type: 'fx', effect: 'exclamation', params: { npcId: event.npcId } })
          npc.transitionTo('emoting', { anim: 'wave' })
        })
      }
    }
  }

  private onNpcDespawn(npcId: string): void {
    if (npcId === 'steward' || npcId === 'user') {
      console.warn(`[MainScene] blocked despawn of protected NPC: ${npcId}`)
      return
    }
    this.dailyScheduler.removeNpc(npcId)
    this.debugCharacterAssignments.delete(npcId)
    this.personaStore.remove(npcId)

    const despawnNpc = this.npcManager.get(npcId)
    if (despawnNpc) {
      const mesh = despawnNpc.mesh
      mesh.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) return
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m: THREE.Material) => {
            if (m.userData?.npcOwnedMaterial) return m
            const c = m.clone(); c.transparent = true; return c
          })
        } else if (child.material && !child.material.userData?.npcOwnedMaterial) {
          child.material = child.material.clone()
          child.material.transparent = true
        }
      })
      let t = 0
      const duration = 0.5
      const tick = () => {
        t += 0.016
        const progress = Math.min(t / duration, 1)
        const s = 1 - progress
        mesh.scale.set(s, s, s)
        mesh.traverse((child: THREE.Object3D) => {
          const meshChild = child as THREE.Mesh
          if (meshChild.isMesh && meshChild.material && !Array.isArray(meshChild.material)) {
            meshChild.material.opacity = s
          }
        })
        if (progress < 1) requestAnimationFrame(tick)
        else this.npcManager.remove(npcId)
      }
      requestAnimationFrame(tick)
    }
  }

  private onNpcPhase(npcId: string, phase: string): void {
    const npc = this.npcManager.get(npcId)
    if (!npc) return

    this.vfx.stopThinkingAura(npc.mesh)
    this.vfx.stopWorkingStream(npc.mesh)

    const isWalking = npc.npcState === 'walking'
    const audio = getAudioSystem()

    const stationId = this.workflow.officeNpcStations.get(npcId)
    const isTrackedWorkingCitizen = this.workflow.workingCitizens.has(npcId)

    if (phase === 'working') {
      if (!isWalking) { npc.playAnim('typing'); this.vfx.workingStream(npc.mesh); audio.play('typing') }
      npc.setGlow('cyan'); npc.indicator.setState('working'); npc.setStatusEmoji('working')
      if (stationId) this.officeBuilder.setScreenState(stationId, { mode: 'coding', fileName: 'index.ts' })
    } else if (phase === 'thinking') {
      if (!isWalking) { npc.playAnim('thinking'); this.vfx.thinkingAura(npc.mesh) }
      npc.setGlow('yellow'); npc.indicator.setState('thinking'); npc.setStatusEmoji('working')
      if (stationId) this.officeBuilder.setScreenState(stationId, { mode: 'coding', fileName: 'index.ts' })
    } else if (phase === 'done') {
      npc.playAnim('cheer'); npc.setGlow('green'); npc.indicator.setState('done')
      npc.setStatusEmoji('celebrate')
      this.vfx.completionFirework(npc.getPosition()); audio.play('complete')
      this.workflow.workingCitizens.delete(npcId)
      this.workflow.onNpcWorkDone(npcId)
    } else if (phase === 'error') {
      npc.playAnim('frustrated'); npc.setGlow('red'); npc.indicator.setState('error')
      npc.setStatusEmoji('error')
      this.vfx.errorLightning(npc.getPosition()); audio.play('error')
      this.workflow.workingCitizens.delete(npcId)
    } else if (phase === 'idle') {
      npc.playAnim('idle'); npc.setGlow('none'); npc.indicator.setState('idle')
      npc.setStatusEmoji(null)
    } else if (phase === 'waiting') {
      npc.playAnim('idle'); npc.setGlow('gray'); npc.indicator.setState('waiting')
      npc.setStatusEmoji('working')
    } else if (phase === 'documenting') {
      npc.playAnim('reading'); npc.setGlow('yellow'); npc.indicator.setState('idle')
      npc.setStatusEmoji('📋')
    }

  }

  private onModeChange(event: GameEvent & { type: 'mode_change' }): void {
    const prevMode = this.modeManager.getMode()
    const prevWorkSubState = this.modeManager.getWorkSubState()
    if (event.mode === 'work') {
      this.followBehavior.stop()
      const nextWorkSubState = event.workSubState ?? 'summoning'
      const startingFreshWorkCycle =
        nextWorkSubState === 'summoning' && (prevMode !== 'work' || prevWorkSubState !== 'summoning')
      if (startingFreshWorkCycle) {
        this.workflow.cleanupOfficeWork()
        this.workflow.workingCitizens.clear()
      }
      if (!this.modeManager.isWorkMode()) {
        this.modeManager.enterWorkMode(event.taskDescription ?? '', nextWorkSubState)
      } else if (event.workSubState) {
        const current = this.modeManager.getWorkSubState()
        if (current !== event.workSubState) {
          this.modeManager.forceWorkSubState(event.workSubState)
        }
      }
      if (event.summonedNpcIds) {
        this.modeManager.setSummonedNpcs(event.summonedNpcIds)
      }
    } else {
      const wasWorkMode = this.modeManager.isWorkMode()
      this.modeManager.returnToLifeMode()
      if (wasWorkMode && this.sceneSwitcher.getSceneType() === 'town') {
        this.workflow.summonPlayed = false
        this.workflow.workingCitizens.clear()
        this.workflow.pendingSummonNpcs = []
        this.workflow.cleanupOfficeWork()
        this.dailyScheduler.scheduleStartDailyBehaviors(4500)
      }
    }
  }

  private onNpcMoveTo(
    npcId: string,
    target: { x: number; y: number; z: number },
    speed?: number,
    requestId?: string,
  ): void {
    const npc = this.npcManager.get(npcId)
    if (!npc) return

    if (npcId === 'user' || npcId === 'steward') {
      this.playerMoveEnabled = false
      this.followBehavior.stop()
    }

    npc.setVisible(true)
    npc.moveTo({ x: target.x, z: target.z }, speed ?? 3).then((status) => {
      if (npcId === 'user' || npcId === 'steward') {
        this.playerMoveEnabled = true
      }
      if (!requestId) return
      this.dataSource.sendAction({ type: 'npc_move_completed', npcId, requestId, status })
    })
  }

  private onNpcDailyBehaviorReady(npcId: string): void {
    this.dailyScheduler.addEligibleNpcId(npcId)
    if (this.sceneSwitcher.getSceneType() === 'town') {
      this.dailyScheduler.scheduleStartDailyBehaviors(800)
    }
  }

  private onNpcEmoji(_npcId: string, _emoji: string | null): void {
    // SVG status is now driven by npc_phase, not npc_emoji
  }

  private onNpcGlow(npcId: string, color: string): void {
    const npc = this.npcManager.get(npcId)
    if (npc) npc.setGlow(color)
  }

  private onNpcAnim(npcId: string, anim: string): void {
    const npc = this.npcManager.get(npcId)
    if (!npc) return
    if (anim === 'idle' && npc.state === 'walking') return
    npc.playAnim(anim as 'idle' | 'walk' | 'typing' | 'wave' | 'cheer')
  }

  private onCameraMove(target?: { x: number; y: number; z: number }, follow?: string, durationMs?: number): void {
    if (follow) {
      const npc = this.npcManager.get(follow)
      if (npc) this.cameraCtrl.follow(npc.mesh)
    } else if (target) {
      this.cameraCtrl.follow(null)
      this.cameraCtrl.moveTo({ x: target.x, z: target.z })
    }
  }

  private onFx(effect: string, params: Record<string, unknown>): void {
    const getNpc = (id?: unknown) => id ? this.npcManager.get(id as string) : null
    const audio = getAudioSystem()

    switch (effect) {
      case 'summon_ripple': {
        const npc = getNpc(params.npcId)
        const rawPos = params.position as { x: number; z: number } | undefined
        const pos = npc ? npc.getPosition() : (rawPos ? new THREE.Vector3(rawPos.x, 0, rawPos.z) : null)
        if (pos) { this.vfx.summonShockwave(pos); audio.play('summon') }
        break
      }
      case 'exclamation': {
        const npc = getNpc(params.npcId)
        if (npc) this.effects.exclamation(npc.mesh)
        break
      }
      case 'completion_stars': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.completionFirework(npc.getPosition())
        break
      }
      case 'error_sparks': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.errorLightning(npc.getPosition())
        break
      }
      case 'personaTransform': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.personaTransform(npc.mesh)
        break
      }
      case 'fileIcon': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.fileIcon(npc.mesh, (params.fileName as string) ?? 'file.ts')
        break
      }
      case 'workingStream': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.workingStream(npc.mesh)
        break
      }
      case 'searchRadar': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.searchRadar(npc.mesh)
        break
      }
      case 'connectionBeam': {
        const a = getNpc(params.fromNpcId)
        const b = getNpc(params.toNpcId)
        if (a && b) this.vfx.connectionBeam(a.mesh, b.mesh)
        break
      }
      case 'deployFireworks': {
        this.vfx.deployFireworks(new THREE.Vector3(15, 0, 12))
        break
      }
      case 'hookFlash': {
        const npc = getNpc(params.npcId)
        if (npc) this.vfx.hookFlash(npc.mesh)
        break
      }
      case 'routeDebugPath': {
        const rawPoints = Array.isArray(params.points) ? params.points : []
        this.vfx.routeDebugPath(
          rawPoints as Array<{ x: number; y?: number; z: number }>,
          Number(params.color ?? 0x33e0ff),
          Number(params.ttlMs ?? 5000),
        )
        break
      }
      case 'show_game_publish': {
        this.vfx.deployFireworks(new THREE.Vector3(15, 0, 12))
        audio.play('deploy')
        const p = params as { gameName?: string; team?: string; iframeSrc?: string; coverUrl?: string }
        if (p.iframeSrc) this.workflow.pendingGameIframeSrc = p.iframeSrc
        if (p.coverUrl) this.workflow.pendingGameCoverUrl = p.coverUrl
        if (p.gameName) this.workflow.pendingBriefingGameName = p.gameName
        this.ui.showGamePublish({
          gameName: p.gameName || t('new_game'),
          iframeSrc: p.iframeSrc || '',
        })
        break
      }
    }
  }

  private syncTopHudLayout(): void {
    const compactSideHud = this.modeManager.isWorkMode()
    this.modeIndicator?.setActionCompact(compactSideHud)
    this.timeHUD?.setCompact(compactSideHud)
  }

  // ── Tap detection ──

  private isSceneInteractionLocked(): { locked: boolean; reason: string } {
    const workSubState = this.modeManager.getWorkSubState()
    if (!this.inputEnabled) {
      return { locked: true, reason: 'input_disabled' }
    }
    if (
      this.modeManager.isWorkMode()
      && workSubState !== null
      && MainScene.NON_INTERACTIVE_WORK_SUBSTATES.has(workSubState)
    ) {
      return { locked: true, reason: `work_substate:${workSubState}` }
    }
    return { locked: false, reason: 'interactive' }
  }

  private handleTap(screenX: number, screenY: number): void {
    const rect = this.engine.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.engine.camera)

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const worldPos = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane, worldPos)

    if (worldPos) {
      const interactionLock = this.isSceneInteractionLocked()
      if (interactionLock.locked) return

      const tapRadius = this.sceneSwitcher.getSceneType() === 'town' ? 1.2 : 2.0
      const npc = this.npcManager.findNearestNPC(worldPos, tapRadius)
      if (npc) {
        this.handleNPCTap(npc)
        return
      }

      const curSceneType = this.sceneSwitcher.getSceneType()

      if (curSceneType === 'town') {
        for (const [buildingId, marker] of this.townBuilder.getDoorMarkers()) {
          const doorPos = new THREE.Vector3()
          marker.getWorldPosition(doorPos)
          if (worldPos.distanceTo(doorPos) < 5) {
            this.ui.showToast('Đi lại gần cửa rồi bấm E để vào')
            return
          }
        }
        const parkPos = new THREE.Vector3(WAYPOINTS.park_center.x, 0, WAYPOINTS.park_center.z)
        if (worldPos.distanceTo(parkPos) < 5.5) {
          this.ui.showToast('Đi vào công viên rồi bấm E')
          return
        }
      }

      if (curSceneType === 'office') {
        const wbMesh = this.officeBuilder.whiteboardMesh
        if (wbMesh) {
          const intersects = raycaster.intersectObject(wbMesh)
          if (intersects.length > 0) {
            this.ui.showWhiteboard()
            return
          }
        }
        
        const officeDoor = this.officeBuilder.doorPos
        if (worldPos.distanceTo(officeDoor) < 5) {
          this.ui.showToast('Bấm nút quay lại để ra thị trấn')
          return
        }
      } else if (curSceneType !== 'town') {
        const exitDoor = this.museumBuilder.doorPos
        if (worldPos.distanceTo(exitDoor) < 5) {
          this.ui.showToast('Bấm nút quay lại để ra thị trấn')
          return
        }
      }

      this.pendingDoorInteraction = null
      this.handleGroundTap()
    }
  }

  private handleNPCTap(npc: NPC): void {
    this.selectNPC(npc)
    this.cameraCtrl.follow(npc.mesh)

    const currentConfig = this.configStore.load()
    const configAvatarUrl = npc.id === 'steward'
      ? currentConfig?.steward.avatarUrl
      : npc.id === 'user'
        ? currentConfig?.user.avatarUrl
        : currentConfig?.citizens.find(c => c.id === npc.id)?.avatarUrl
    const config: NPCConfig = {
      id: npc.id, name: npc.name ?? npc.id,
      color: 0x888888, spawn: { x: 0, y: 0, z: 0 },
      role: 'worker', label: npc.label ?? npc.name ?? npc.id,
      characterKey: npc.characterKey,
      avatarUrl: configAvatarUrl,
    }

    const profile = this.getNpcProfilesCached().get(npc.id)
    const specialty = this.getConfiguredSpecialty(npc.id) ?? profile?.specialty ?? ''
    const logs = this.dialogManager.getWorkLogs().get(npc.id)
    const recentEvents = this.getNpcRecentEvents(npc.id)
    const relationships = this.dailyScheduler.getActivityJournals().get(npc.id)?.getRelationships()

    const isWorking = this.workflow.workingCitizens.has(npc.id)
    const agentConfigured = this.bootstrap.agentConfigMap.get(npc.id)
    const agentOnline = npc.id === 'steward'
      ? this.dataSource.connected
      : npc.id === 'user' ? undefined : !!(agentConfigured?.agentEnabled) || isWorking

    this.ui.showNPCCard({
      npc: config,
      state: npc.state || 'idle',
      specialty,
      persona: profile?.bio ?? this.personaStore.get(npc.id)?.coreSummary,
      godProfile: getGodSimNpcProfile(npc.id),
      relationships: relationships ? [...relationships] : undefined,
      recentEvents,
      workLogs: logs && logs.length > 0 ? logs : undefined,
      agentOnline,
      isWorking,
      professionOptions: npc.id === 'steward' ? undefined : getProfessionOptions(),
      onProfessionChange: (npcId, value) => this.updateNpcProfession(npcId, value),
    })
  }

  private walkToDoor(buildingId: string, doorPos: THREE.Vector3): void {
    const targetScene = this.getSceneForBuildingId(buildingId)
    if (!targetScene) return

    const mayor = this.npcManager.get('user')
    if (!mayor || !mayor.mesh.visible) return

    const dist = mayor.mesh.position.distanceTo(doorPos)
    if (dist >= 2.6) {
      this.ui.showToast('Đi lại gần cửa rồi bấm E để vào')
      return
    }

    this.pendingDoorInteraction = null
    this.followBehavior.stop()
    if (targetScene === 'town') this.postTownReturnDebugFrames = 4
    else this.lastTownEntranceBuildingId = buildingId
    this.sceneSwitcher.switchScene(targetScene)
  }

  private getSceneForBuildingId(buildingId: string): SceneType | null {
    const sceneMap: Record<string, SceneType> = {
      office: 'office',
      coworking: 'office',
      museum: 'museum',
      clinic: 'museum',
      park: 'museum',
      market: 'market',
      cafe: 'cafe',
      restaurant: 'cafe',
      house_a: 'house_a',
      house_b: 'house_b',
      house_c: 'house_c',
      house_d: 'house_a',
      house_e: 'house_b',
      house_f: 'house_c',
      house_g: 'house_a',
      user_home: 'user_home',
      exit_office: 'town',
      exit_museum: 'town',
    }
    return sceneMap[buildingId] ?? null
  }

  private getBuildingInteractionLabel(buildingId: string): string {
    const labels: Record<string, string> = {
      office: 'công ty',
      coworking: 'văn phòng nhỏ',
      museum: 'nhà văn hóa',
      clinic: 'phòng khám',
      park: 'công viên',
      market: 'khu chợ',
      cafe: 'quán cà phê',
      restaurant: 'quán ăn',
      house_a: 'nhà Minh',
      house_b: 'nhà Lan',
      house_c: 'nhà Hà',
      house_d: 'nhà An',
      house_e: 'nhà Khôi',
      house_f: 'nhà Vy',
      house_g: 'nhà Bảo',
      user_home: 'nhà của bạn',
    }
    return labels[buildingId] ?? 'địa điểm'
  }

  private tryEnterNearbyDoor(): void {
    const sceneType = this.sceneSwitcher.getSceneType()
    if (sceneType !== 'town') {
      const user = this.npcManager.get('user')
      if (!user || !user.mesh.visible) return
      const exitDoor = sceneType === 'office' ? this.officeBuilder.doorPos : this.museumBuilder.doorPos
      if (user.getPosition().distanceTo(exitDoor) < 3.2) {
        this.sceneSwitcher.switchScene('town')
      } else {
        this.ui.showToast('Đi lại gần cửa rồi bấm E để ra ngoài')
      }
      return
    }

    this.updateNearbyDoorInteraction()
    const interaction = this.nearbyDoorInteraction
    if (!interaction) {
      if (this.sceneSwitcher.getSceneType() === 'town') this.ui.showToast('Đi lại gần cửa hoặc địa điểm rồi bấm E')
      return
    }
    this.walkToDoor(interaction.buildingId, interaction.doorPos)
  }

  private updateNearbyDoorInteraction(): void {
    const user = this.npcManager.get('user')
    if (!user || !user.mesh.visible || this.sceneSwitcher.getSceneType() !== 'town') {
      this.nearbyDoorInteraction = null
      this.updateInteractionPrompt()
      return
    }

    const userPos = user.getPosition()
    let best: typeof this.nearbyDoorInteraction = null
    let bestDist = 2.8
    for (const [buildingId, marker] of this.townBuilder.getDoorMarkers()) {
      const scene = this.getSceneForBuildingId(buildingId)
      if (!scene) continue
      const doorPos = new THREE.Vector3()
      marker.getWorldPosition(doorPos)
      const dist = userPos.distanceTo(doorPos)
      if (dist < bestDist) {
        bestDist = dist
        best = { buildingId, scene, doorPos, label: this.getBuildingInteractionLabel(buildingId) }
      }
    }

    const parkPos = new THREE.Vector3(WAYPOINTS.park_center.x, 0, WAYPOINTS.park_center.z)
    const parkDist = userPos.distanceTo(parkPos)
    if (parkDist < bestDist) {
      best = { buildingId: 'park', scene: 'museum', doorPos: parkPos, label: this.getBuildingInteractionLabel('park') }
    }

    this.nearbyDoorInteraction = best
    this.updateInteractionPrompt()
  }

  private updateInteractionPrompt(): void {
    const el = this.ensureInteractionPrompt()
    if (!this.nearbyDoorInteraction) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      return
    }
    el.textContent = `E - vào ${this.nearbyDoorInteraction.label}`
    el.style.opacity = '1'
    el.style.pointerEvents = 'none'
  }

  private ensureInteractionPrompt(): HTMLDivElement {
    if (this.interactionPromptEl) return this.interactionPromptEl
    const el = document.createElement('div')
    el.className = 'interaction-prompt'
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      bottom: '92px',
      transform: 'translateX(-50%)',
      zIndex: '70',
      padding: '10px 14px',
      borderRadius: '8px',
      background: 'rgba(18,24,32,0.9)',
      color: '#fff7dc',
      font: '700 15px "Segoe UI", Arial, sans-serif',
      boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
      opacity: '0',
      transition: 'opacity 140ms ease',
      pointerEvents: 'none',
    })
    document.body.appendChild(el)
    this.interactionPromptEl = el
    return el
  }

  private handleGroundTap(): void {
    if (!this.inputEnabled) return

    this.pendingDoorInteraction = null
    this.selectedNpcId = null
    if (this.selectedRing) this.selectedRing.visible = false
  }

  private onPlayerKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (this.isTextInputFocused()) return
    if (key === 'e') {
      event.preventDefault()
      this.tryEnterNearbyDoor()
      return
    }
    if (!this.isPlayerMoveKey(key)) return
    event.preventDefault()
    this.playerKeys.add(key)
  }

  private onPlayerKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase()
    if (!this.isPlayerMoveKey(key)) return
    event.preventDefault()
    this.playerKeys.delete(key)
  }

  private isPlayerMoveKey(key: string): boolean {
    return key === 'w' || key === 'a' || key === 's' || key === 'd'
      || key === 'arrowup' || key === 'arrowleft' || key === 'arrowdown' || key === 'arrowright'
  }

  private isTextInputFocused(): boolean {
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || el.isContentEditable
  }

  private updatePlayerKeyboardMovement(deltaTime: number): void {
    if (!this.inputEnabled || !this.playerMoveEnabled) {
      this.stopKeyboardMoveAnim()
      return
    }
    if (this.isTextInputFocused()) {
      this.stopKeyboardMoveAnim()
      return
    }

    const user = this.npcManager.get('user')
    if (!user || !user.mesh.visible) {
      this.stopKeyboardMoveAnim()
      return
    }

    let dx = 0
    let dz = 0
    if (this.playerKeys.has('w') || this.playerKeys.has('arrowup')) dz -= 1
    if (this.playerKeys.has('s') || this.playerKeys.has('arrowdown')) dz += 1
    if (this.playerKeys.has('a') || this.playerKeys.has('arrowleft')) dx -= 1
    if (this.playerKeys.has('d') || this.playerKeys.has('arrowright')) dx += 1

    if (dx === 0 && dz === 0) {
      this.stopKeyboardMoveAnim()
      return
    }

    this.pendingDoorInteraction = null
    this.followBehavior.stop()
    this.citizenChat.onPlayerMoveInterrupt()
    this.cameraCtrl.follow(user.mesh)

    const len = Math.sqrt(dx * dx + dz * dz)
    const speed = 4.4
    const next = this.clampPlayerPosition(
      user.mesh.position.x + (dx / len) * speed * deltaTime,
      user.mesh.position.z + (dz / len) * speed * deltaTime,
    )
    user.mesh.position.x = next.x
    user.mesh.position.z = next.z
    user.mesh.rotation.y = Math.atan2(dx / len, dz / len)
    if (!this.playerWasKeyboardMoving) {
      user.stopMoving()
      user.transitionTo('walking')
      this.playerWasKeyboardMoving = true
    }
  }

  private getPlayerName(): string {
    const user = this.npcManager.get('user')
    return user?.label ?? user?.name ?? t('mayor')
  }

  private canNpcBoardVehicle(npcId: string, position: { x: number; z: number }): boolean {
    if (npcId === 'user' || this.vehiclePassengerNpcIds.has(npcId)) return false
    if (this.sceneSwitcher?.getSceneType() !== 'town') return false
    const npc = this.npcManager.get(npcId)
    if (!npc || !npc.mesh.visible || !npc.isInActiveScene) return false
    return npc.getPosition().distanceTo(new THREE.Vector3(position.x, 0, position.z)) < 5.5
  }

  private onNpcBoardVehicle(npcId: string): void {
    if (npcId === 'user') return
    const npc = this.npcManager.get(npcId)
    if (!npc) return
    npc.stopMoving()
    npc.transitionTo('idle')
    npc.setVisible(false)
    this.vehiclePassengerNpcIds.add(npcId)
  }

  private onNpcLeaveVehicle(npcId: string, position: { x: number; z: number }): void {
    if (npcId === 'user') return
    const npc = this.npcManager.get(npcId)
    if (!npc) return
    npc.stopMoving()
    npc.mesh.position.set(position.x, 0, position.z)
    npc.transitionTo('idle')
    npc.setVisible(true)
    this.vehiclePassengerNpcIds.delete(npcId)
  }

  private getDialogTargetName(targetNpcId = this.dialogTarget): string | undefined {
    if (!targetNpcId) return undefined
    const target = this.npcManager.get(targetNpcId)
    return target?.label ?? target?.name ?? targetNpcId
  }

  private resolveTownSpeechTarget(): string {
    if (this.sceneSwitcher?.getSceneType() !== 'town') return this.dialogTarget
    const user = this.npcManager.get('user')
    if (!user || !user.mesh.visible) return this.dialogTarget
    const selected = this.dialogTarget && this.dialogTarget !== 'steward'
      ? this.npcManager.get(this.dialogTarget)
      : null
    if (selected?.mesh.visible && selected.isInActiveScene && selected.getPosition().distanceTo(user.getPosition()) <= 6) {
      return selected.id
    }
    const nearestCitizen = this.findNearestSpeechTarget(user, 6, false)
    if (nearestCitizen) return nearestCitizen.id
    const nearestAny = this.findNearestSpeechTarget(user, 2.2, true)
    return nearestAny?.id ?? 'steward'
  }

  private findNearestSpeechTarget(user: NPC, maxDistance: number, includeSteward: boolean): NPC | null {
    let best: NPC | null = null
    let bestDist = 3.8
    if (maxDistance > 0) bestDist = maxDistance
    const userPos = user.getPosition()
    for (const npc of this.npcManager.getAll()) {
      if (npc.id === 'user' || !npc.mesh.visible || !npc.isInActiveScene) continue
      if (!includeSteward && npc.id === 'steward') continue
      const d = npc.getPosition().distanceTo(userPos)
      if (d < bestDist) {
        bestDist = d
        best = npc
      }
    }
    return best
  }

  private npcToConfig(npc: NPC): NPCConfig {
    return {
      id: npc.id,
      name: npc.name ?? npc.id,
      color: 0x888888,
      spawn: { x: 0, y: 0, z: 0 },
      role: npc.id === 'user' ? 'user' : 'worker',
      label: npc.label ?? npc.name ?? npc.id,
      characterKey: npc.characterKey,
    }
  }

  private syncDialogTarget(npcId: string): void {
    if (!npcId || this.dialogTarget === npcId) return
    const npc = this.npcManager.get(npcId)
    if (!npc) return
    this.dialogTarget = npcId
    const config = this.npcToConfig(npc)
    this.ui.setDialogTarget(config)
    if (npcId !== 'steward') this.ui.updateChatTargetIndicator(config, true)
    else this.ui.updateChatTargetIndicator(null, false)
  }

  private recordDirectNpcMessage(npcId: string, text: string): void {
    const npc = this.npcManager.get(npcId)
    const npcName = npc?.label ?? npc?.name ?? npcId
    this.townJournal?.recordEncounterMessage(npcName, text, 'town')
    const journal = this.dailyScheduler.getActivityJournals().get(npcId)
    journal?.updateRelationship(
      { npcId: 'user', name: this.getPlayerName() },
      { topic: text.slice(0, 80), sentimentDelta: 0.04 },
    )
    this.socialFeedPanel?.refresh()
    this.saveSnapshot()
  }

  private replyFromLocalCitizenIfNeeded(text: string): void {
    const targetId = this.dialogTarget
    if (!targetId || targetId === 'steward') return
    const npc = this.npcManager.get(targetId)
    if (!npc || !npc.mesh.visible) return
    const agentConfigured = this.bootstrap.agentConfigMap.get(targetId)
    if (agentConfigured?.agentEnabled) return

    this.buildLocalCitizenReply(targetId, text).then((reply) => {
      if (!reply) return
      this.dialogManager.onDialogMessage(targetId, reply, false)
    }).catch(() => {
      this.dialogManager.onDialogMessage(targetId, this.buildFallbackCitizenReply(targetId), false)
    })
  }

  private async buildLocalCitizenReply(npcId: string, userText: string): Promise<string> {
    const npc = this.npcManager.get(npcId)
    const npcName = npc?.label ?? npc?.name ?? npcId
    const profile = getGodSimNpcProfile(npcId)
    const journal = this.dailyScheduler.getActivityJournals().get(npcId)
    const recent = journal?.getRecentActivities(3).map(a => a.detail || this.localizeActivityAction(a.action)) ?? []
    const relation = journal?.getRelationship('user')
    const playerProfession = this.getConfiguredSpecialty('user') ?? 'Người quan sát'
    const npcProfession = this.getConfiguredSpecialty(npcId) ?? ''

    const result = await this.dailyScheduler.implicitChatForBrain({
      scene: 'encounter_reply',
      maxTokens: 90,
      system: [
        `Bạn là ${npcName}, một cư dân trong thị trấn.`,
        'Trả lời người chơi bằng tiếng Việt, 1 câu ngắn tự nhiên.',
        'Có thể nhắc tới đời sống thị trấn, việc đang làm, nhu cầu, hoặc quan hệ với người chơi.',
        'Không dùng markdown. Không tự xưng là AI.',
      ].join('\n'),
      user: JSON.stringify({
        player_message: userText,
        player_profession: playerProfession,
        npc_profession: npcProfession,
        profession_rule: 'Trả lời khớp nghề. Nếu người chơi là cảnh sát/công an, hãy dè chừng, kính nể, né chuyện nhạy cảm hoặc sợ bị để ý tùy quan hệ. Nha sĩ/bác sĩ bám phòng khám; làm công ty bám công ty; pha chế bám cafe; đầu bếp bám quán ăn; chủ sạp bám chợ.',
        personality: profile.personality,
        needs: profile.needs,
        recent_activity: recent,
        relationship: relation ? {
          label: relation.label,
          interactionCount: relation.interactionCount,
          recentTopics: relation.recentTopics?.slice(-3),
        } : null,
      }),
    })

    const reply = result.text.trim()
    return result.fallback || !reply ? this.buildFallbackCitizenReply(npcId) : reply.slice(0, 180)
  }

  private buildFallbackCitizenReply(npcId: string): string {
    const npc = this.npcManager.get(npcId)
    const name = npc?.label ?? npc?.name ?? 'tôi'
    const profile = getGodSimNpcProfile(npcId)
    if (profile.needs.social > 70) return 'Tôi cũng đang muốn nói chuyện với ai đó. Đi cùng tôi một đoạn nhé?'
    if (profile.needs.energy < 45) return 'Tôi nghe đây, nhưng hôm nay hơi mệt nên nói chậm một chút.'
    if (profile.needs.hunger < 45) return 'Tôi đang định ghé chợ, vừa đi vừa nói chuyện được không?'
    return `${name} nghe rồi. Chuyện này để tôi nghĩ thêm một chút.`
  }

  private stopKeyboardMoveAnim(): void {
    if (!this.playerWasKeyboardMoving) return
    const user = this.npcManager?.get('user')
    if (user) user.transitionTo('idle')
    this.playerWasKeyboardMoving = false
  }

  private clampPlayerX(x: number): number {
    return Math.max(4, Math.min(52, x))
  }

  private clampPlayerZ(z: number): number {
    return Math.max(4, Math.min(31, z))
  }

  private clampPlayerPosition(x: number, z: number): { x: number; z: number } {
    const sceneType = this.sceneSwitcher.getSceneType()
    if (sceneType === 'office') {
      return {
        x: Math.max(3, Math.min(27, x)),
        z: Math.max(4, Math.min(25.5, z)),
      }
    }
    if (sceneType !== 'town') {
      return {
        x: Math.max(2, Math.min(22, x)),
        z: Math.max(2, Math.min(18.5, z)),
      }
    }
    return { x: this.clampPlayerX(x), z: this.clampPlayerZ(z) }
  }

  private handleCasualEvent(event: {
    type: 'wave' | 'chat_start' | 'chat_message' | 'chat_end'
    npcA?: NPC
    npcB?: NPC
    speaker?: NPC
    text?: string
    turns?: Array<{ speaker: string; text: string }>
    summary?: string
  }): void {
    const nameA = event.npcA?.label ?? event.npcA?.name ?? event.npcA?.id ?? ''
    const nameB = event.npcB?.label ?? event.npcB?.name ?? event.npcB?.id ?? ''

    if (event.type === 'wave') {
      return
    }
    if (event.type === 'chat_start') {
      return
    }
    if (event.type === 'chat_message') {
      return
    }
    if (event.type === 'chat_end') {
      const summary = event.summary ?? 'trò chuyện trong thị trấn'
      const transcript = event.turns?.length
        ? event.turns.map(turn => `${turn.speaker}: "${turn.text}"`).join(' / ')
        : summary
      this.townJournal.record('encounter_end', [nameA, nameB], 'town', `${nameA} và ${nameB}: ${summary}. ${transcript}`)
      if (event.npcA?.id && event.npcB?.id && event.turns?.length) {
        const journalA = this.dailyScheduler.getActivityJournals().get(event.npcA.id)
        const journalB = this.dailyScheduler.getActivityJournals().get(event.npcB.id)
        journalA?.recordDialogue({
          timestamp: Date.now(),
          partnerNpcId: event.npcB.id,
          partnerName: nameB,
          location: 'Thị trấn',
          turns: event.turns,
          summary,
        })
        journalB?.recordDialogue({
          timestamp: Date.now(),
          partnerNpcId: event.npcA.id,
          partnerName: nameA,
          location: 'Thị trấn',
          turns: event.turns,
          summary,
        })
        journalA?.updateRelationship({ npcId: event.npcB.id, name: nameB }, { topic: summary, sentimentDelta: 0.08 })
        journalB?.updateRelationship({ npcId: event.npcA.id, name: nameA }, { topic: summary, sentimentDelta: 0.08 })
        this.socialFeedPanel?.refresh()
        this.saveSnapshot()
      }
      this.applySocialConsequences(event)
    }
  }

  private applySocialConsequences(event: {
    npcA?: NPC
    npcB?: NPC
    turns?: Array<{ speaker: string; text: string }>
    summary?: string
  }): void {
    if (!event.npcA || !event.npcB || !event.turns?.length) {
      this.splitAfterGoodbye(event.npcA, event.npcB, event.summary ?? '')
      return
    }

    const nameA = event.npcA.label ?? event.npcA.name ?? event.npcA.id
    const nameB = event.npcB.label ?? event.npcB.name ?? event.npcB.id
    const speakerToNpc = (speaker: string): NPC | null => {
      const s = this.normalizeText(speaker)
      if (s.includes(this.normalizeText(nameA))) return event.npcA ?? null
      if (s.includes(this.normalizeText(nameB))) return event.npcB ?? null
      return null
    }

    let scheduled = false
    let sentHome = false
    const fullText = `${event.summary ?? ''} ${event.turns.map(t => t.text).join(' ')}`

    for (const turn of event.turns) {
      const text = turn.text
      const speakerNpc = speakerToNpc(turn.speaker)
      if (speakerNpc && this.saysGoHome(text)) {
        this.dailyScheduler.getDailyBehaviors().get(speakerNpc.id)
          ?.goHomeNow(`${speakerNpc.label ?? speakerNpc.name} nói sẽ về nhà nên rời cuộc trò chuyện`)
        sentHome = true
      }

      const appointment = this.extractAppointment(`${text} ${fullText}`, event.npcA, event.npcB, nameA, nameB)
      if (appointment) {
        this.addSocialAppointment(appointment)
        scheduled = true
      }
    }

    if (!scheduled) {
      const appointment = this.extractAppointment(fullText, event.npcA, event.npcB, nameA, nameB)
      if (appointment) {
        this.addSocialAppointment(appointment)
        scheduled = true
      }
    }

    if (!scheduled && this.saysGoTogetherNow(fullText)) {
      const place = this.resolveSocialPlace(this.normalizeText(fullText)) ?? this.inferDefaultSocialPlace(this.normalizeText(fullText))
      if (place) {
        this.dailyScheduler.getDailyBehaviors().get(event.npcA.id)
          ?.goToPlaceNow(place.key, `Đi cùng ${nameB} sau cuộc trò chuyện`)
        this.dailyScheduler.getDailyBehaviors().get(event.npcB.id)
          ?.goToPlaceNow(place.key, `Đi cùng ${nameA} sau cuộc trò chuyện`)
        this.townJournal.record('encounter_start', [nameA, nameB], place.name, `${nameA} và ${nameB} quyết định đi cùng nhau tới ${place.name}`)
        scheduled = true
      }
    }

    if (!sentHome && this.saysGoodbye(fullText)) {
      this.splitAfterGoodbye(event.npcA, event.npcB, 'Tạm biệt xong mỗi người đi một hướng')
    }
  }

  private addSocialAppointment(appointment: SocialAppointment): void {
    const exists = this.socialAppointments.some(a =>
      !a.completed &&
      a.npcAId === appointment.npcAId &&
      a.npcBId === appointment.npcBId &&
      a.placeKey === appointment.placeKey &&
      a.period === appointment.period &&
      a.dayCount === appointment.dayCount,
    )
    if (exists) return

    this.socialAppointments.push(appointment)
    this.townJournal.record(
      'encounter_end',
      [appointment.npcAName, appointment.npcBName],
      appointment.placeName,
      `${appointment.npcAName} và ${appointment.npcBName} hẹn ${this.periodLabel(appointment.period)} gặp ở ${appointment.placeName}: ${appointment.reason}`,
    )
  }

  private updateSocialAppointments(): void {
    if (!this.socialAppointments.length || !this.gameClock) return
    const state = this.gameClock.getState()
    for (const appt of this.socialAppointments) {
      if (appt.dayCount !== state.dayCount) continue
      if (appt.completed) continue
      if (!appt.activated && appt.period === state.period) this.activateSocialAppointment(appt)
      if (appt.activated) this.updateActivatedAppointment(appt)
    }
    this.socialAppointments = this.socialAppointments.filter(a => !a.completed && a.dayCount >= state.dayCount)
  }

  private activateSocialAppointment(appt: SocialAppointment): void {
    appt.activated = true
    const aBehavior = this.dailyScheduler.getDailyBehaviors().get(appt.npcAId)
    const bBehavior = this.dailyScheduler.getDailyBehaviors().get(appt.npcBId)
    if (appt.npcAId !== 'user') aBehavior?.goToPlaceNow(appt.placeKey, `Đến ${appt.placeName} theo lịch hẹn với ${appt.npcBName}`)
    if (appt.npcBId !== 'user') bBehavior?.goToPlaceNow(appt.placeKey, `Đến ${appt.placeName} theo lịch hẹn với ${appt.npcAName}`)
    this.townJournal.record(
      'encounter_start',
      [appt.npcAName, appt.npcBName],
      appt.placeName,
      `${appt.npcAName} và ${appt.npcBName} bắt đầu tới điểm hẹn: ${appt.placeName}`,
    )
  }

  private updateActivatedAppointment(appt: SocialAppointment): void {
    const npcA = this.npcManager.get(appt.npcAId)
    const npcB = this.npcManager.get(appt.npcBId)
    if (!npcA || !npcB) return
    const place = WAYPOINTS[appt.placeKey]
    if (!place) return

    const aAtPlace = this.distanceToPoint(npcA, place) <= 2.3
    const bAtPlace = this.distanceToPoint(npcB, place) <= 2.3
    if ((aAtPlace || bAtPlace) && !appt.arrivedAtMs) {
      appt.arrivedAtMs = Date.now()
      const waitingName = aAtPlace && !bAtPlace ? appt.npcAName : bAtPlace && !aAtPlace ? appt.npcBName : `${appt.npcAName} và ${appt.npcBName}`
      this.townJournal.record('encounter_start', [waitingName], appt.placeName, `${waitingName} đã tới ${appt.placeName} và đang chờ`)
    }

    const distBetween = this.distanceBetweenNpcs(npcA, npcB)
    if (distBetween <= 3.0) {
      appt.completed = true
      if (appt.npcAId !== 'user') this.dailyScheduler.getDailyBehaviors().get(appt.npcAId)?.resumeFromDialogue()
      if (appt.npcBId !== 'user') this.dailyScheduler.getDailyBehaviors().get(appt.npcBId)?.resumeFromDialogue()
      npcA.smoothLookAt({ x: npcB.mesh.position.x, z: npcB.mesh.position.z })
      npcB.smoothLookAt({ x: npcA.mesh.position.x, z: npcA.mesh.position.z })
      const line = appt.userInitiated
        ? `${appt.npcAName === this.getPlayerName() ? appt.npcBName : appt.npcAName} nói: "Anh tới rồi à, em đang đợi ở ${appt.placeName}."`
        : `${appt.npcAName} và ${appt.npcBName} đã gặp nhau đúng hẹn ở ${appt.placeName}`
      this.townJournal.record('encounter_end', [appt.npcAName, appt.npcBName], appt.placeName, line)
      const speaker = appt.npcAId === 'user' ? npcB : npcA
      if (appt.userInitiated && speaker.id !== 'user') {
        this.bubbles.show(speaker.mesh, `Anh tới rồi à, em đang đợi ở ${appt.placeName}.`, 3600)
        this.recordDirectNpcMessage(speaker.id, `Anh tới rồi à, em đang đợi ở ${appt.placeName}.`)
      }
      return
    }

    if (!appt.userInitiated || !appt.arrivedAtMs) return
    const waitingNpc = appt.npcAId === 'user' ? npcB : npcA
    const user = appt.npcAId === 'user' ? npcA : npcB
    const waitedMs = Date.now() - appt.arrivedAtMs
    if (waitedMs > 18_000 && !appt.complained) {
      appt.complained = true
      const text = `Em tới ${appt.placeName} rồi. Anh đang ở đâu vậy, đừng để em chờ một mình lâu quá.`
      this.bubbles.show(waitingNpc.mesh, text, 5200)
      this.recordDirectNpcMessage(waitingNpc.id, text)
      this.townJournal.record('encounter_message', [waitingNpc.label ?? waitingNpc.id], appt.placeName, `${waitingNpc.label ?? waitingNpc.id} nhắn cho ${this.getPlayerName()}: "${text}"`)
    }

    if (this.distanceBetweenNpcs(waitingNpc, user) <= 6.0 && Date.now() - (appt.lastPromptMs ?? 0) > 12_000) {
      appt.lastPromptMs = Date.now()
      this.dailyScheduler.getDailyBehaviors().get(waitingNpc.id)?.pauseForDialogue()
      const dx = waitingNpc.mesh.position.x - user.mesh.position.x
      const dz = waitingNpc.mesh.position.z - user.mesh.position.z
      const len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz))
      waitingNpc.moveTo({
        x: this.clampPlayerX(user.mesh.position.x + (dx / len) * 1.4),
        z: this.clampPlayerZ(user.mesh.position.z + (dz / len) * 1.4),
      }, 3)
      waitingNpc.smoothLookAt({ x: user.mesh.position.x, z: user.mesh.position.z })
      const text = 'Em thấy anh gần đây rồi, qua chỗ hẹn đi.'
      this.bubbles.show(waitingNpc.mesh, text, 3600)
      this.recordDirectNpcMessage(waitingNpc.id, text)
    }
  }

  private extractAppointment(text: string, npcA: NPC, npcB: NPC, nameA: string, nameB: string): SocialAppointment | null {
    const normalized = this.normalizeText(text)
    if (!/(hen|gap|di|ra|ghe|toi|qua|dao|choi|muon|dinh|du dinh|ke hoach|ru|hen uoc|loi hua|loi hen)/i.test(normalized)) return null
    const place = this.resolveSocialPlace(normalized) ?? this.inferDefaultSocialPlace(normalized)
    if (!place) return null

    const now = this.gameClock.getState()
    let period: TimePeriod | null = null
    if (/(hoang hon|dusk)/i.test(normalized)) period = 'dusk'
    else if (/(toi nay|buoi toi|toi|dem|night)/i.test(normalized)) period = 'night'
    else if (/(chieu|afternoon)/i.test(normalized)) period = 'afternoon'
    else if (/(trua|noon|an trua)/i.test(normalized)) period = 'noon'
    else if (/(sang|mai sang|morning)/i.test(normalized)) period = 'morning'
    else if (/(lat|sau|nua|bay gio|ngay|gio|di thoi|di cung|di voi|qua do|ghe do)/i.test(normalized)) period = now.period
    else if (/(hen|gap|du dinh|dinh|muon|ru|choi)/i.test(normalized)) period = now.period
    if (!period) return null

    const dayCount = /(mai|ngay mai|tomorrow)/i.test(normalized)
      ? now.dayCount + 1
      : now.dayCount

    return {
      id: `${npcA.id}:${npcB.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      npcAId: npcA.id,
      npcBId: npcB.id,
      npcAName: nameA,
      npcBName: nameB,
      placeKey: place.key,
      placeName: place.name,
      period,
      dayCount,
      reason: text.slice(0, 120),
      activated: false,
      complained: false,
      completed: false,
    }
  }

  private isPlayerAppointmentText(text: string): boolean {
    const normalized = this.normalizeText(text)
    return /(hen|gap|ra|toi|qua|ghe|di|cho|doi|cho em|cho anh|gap em|gap anh|ra cho|di cafe|di ca phe)/i.test(normalized)
      && !!(this.resolveSocialPlace(normalized) ?? this.inferDefaultSocialPlace(normalized))
  }

  private capturePlayerAppointment(text: string): void {
    if (!this.dialogTarget || this.dialogTarget === 'steward') return
    const user = this.npcManager.get('user')
    const target = this.npcManager.get(this.dialogTarget)
    if (!user || !target) return

    if (!this.isPlayerAppointmentText(text)) return
    const appointment = this.extractAppointment(text, user, target, this.getPlayerName(), target.label ?? target.name ?? target.id)
    if (!appointment) return
    appointment.userInitiated = true
    this.addSocialAppointment(appointment)

    const reply = this.buildAppointmentAck(target, appointment)
    this.bubbles.show(target.mesh, reply, 4200)
    this.recordDirectNpcMessage(target.id, reply)
    const now = this.gameClock.getState()
    if (appointment.dayCount === now.dayCount && appointment.period === now.period) {
      this.dailyScheduler.getDailyBehaviors().get(target.id)?.goToPlaceNow(
        appointment.placeKey,
        `Nhận tin nhắn của ${this.getPlayerName()} nên tới ${appointment.placeName} theo hẹn`,
      )
      appointment.activated = true
    }
  }

  private buildAppointmentAck(npc: NPC, appointment: SocialAppointment): string {
    const period = appointment.period === this.gameClock.getPeriod()
      ? 'bây giờ'
      : this.periodLabel(appointment.period)
    const name = npc.label ?? npc.name ?? 'em'
    if (appointment.period === this.gameClock.getPeriod()) {
      return `${name} ra ${appointment.placeName} ngay đây. Anh tới thì nhắn em hoặc lại gần em nhé.`
    }
    return `${name} nhớ rồi, ${period} em sẽ ra ${appointment.placeName}. Đừng hẹn xong để em chờ một mình đấy.`
  }

  private resolveSocialPlace(text: string): { key: string; name: string } | null {
    const options: Array<{ key: string; patterns: RegExp[] }> = [
      { key: 'cafe_door', patterns: [/cafe|cà phê|ca phe|quán cà phê|quan ca phe/] },
      { key: 'restaurant_door', patterns: [/quán ăn|quan an|ăn|an|bữa|bua|cơm|com/] },
      { key: 'park_center', patterns: [/công viên|cong vien|đi dạo|di dao|dạo|dao|ghế|ghe/] },
      { key: 'market_door', patterns: [/chợ|cho|mua|tin đồn|tin don/] },
      { key: 'office_door', patterns: [/công ty|cong ty|văn phòng|van phong|làm việc|lam viec/] },
      { key: 'museum_door', patterns: [/nhà văn hóa|nha van hoa|bảo tàng|bao tang|triển lãm|trien lam/] },
      { key: 'clinic_door', patterns: [/phòng khám|phong kham|khám|kham|sức khỏe|suc khoe/] },
    ]
    const hit = options.find(o => o.patterns.some(p => p.test(text)))
    if (!hit) return null
    const building = BUILDING_REGISTRY.find(b => b.key === hit.key)
    return { key: hit.key, name: building?.name ?? hit.key }
  }

  private inferDefaultSocialPlace(text: string): { key: string; name: string } | null {
    let key: string | null = null
    if (/(an|bua|com|doi|mon|nha hang|quan an)/i.test(text)) key = 'restaurant_door'
    else if (/(uong|cafe|ca phe|ngoi noi chuyen)/i.test(text)) key = 'cafe_door'
    else if (/(mua|cho|do an|do dung)/i.test(text)) key = 'market_door'
    else if (/(lam|viec|du an|cong ty|van phong|nop|xong viec)/i.test(text)) key = 'office_door'
    else if (/(kham|suc khoe|met|dau|om)/i.test(text)) key = 'clinic_door'
    else if (/(trien lam|xem|nha van hoa|bao tang)/i.test(text)) key = 'museum_door'
    else if (/(choi|dao|di rieng|tam su|hen|gap|ru|noi chuyen rieng|di cung|di voi)/i.test(text)) key = 'park_center'
    if (!key) return null
    const building = BUILDING_REGISTRY.find(b => b.key === key)
    return { key, name: building?.name ?? (key === 'park_center' ? 'Công viên' : key) }
  }

  private distanceToPoint(npc: NPC, point: { x: number; z: number }): number {
    const dx = npc.mesh.position.x - point.x
    const dz = npc.mesh.position.z - point.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  private distanceBetweenNpcs(a: NPC, b: NPC): number {
    const dx = a.mesh.position.x - b.mesh.position.x
    const dz = a.mesh.position.z - b.mesh.position.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  private saysGoHome(text: string): boolean {
    const normalized = this.normalizeText(text)
    return /(về nhà|ve nha|về đây|ve day|phải về|phai ve|tôi về|toi ve|mình về|minh ve|đi về|di ve)/i.test(normalized)
  }

  private saysGoodbye(text: string): boolean {
    const normalized = this.normalizeText(text)
    return /(tạm biệt|tam biet|mai gặp|mai gap|lát gặp|lat gap|gặp sau|gap sau|về nhé|ve nhe|bye|goodbye)/i.test(normalized)
  }

  private saysGoTogetherNow(text: string): boolean {
    const normalized = this.normalizeText(text)
    return /(di thoi|di cung|di voi|di mot doan|qua do|ghe do|ra do|minh di|ta di|di rieng|vua di vua noi)/i.test(normalized)
  }

  private splitAfterGoodbye(a?: NPC, b?: NPC, detail = 'Tạm biệt rồi rời đi'): void {
    if (!a || !b) return
    const posA = a.getPosition()
    const posB = b.getPosition()
    const origin = { x: (posA.x + posB.x) / 2, z: (posA.z + posB.z) / 2 }
    this.dailyScheduler.getDailyBehaviors().get(a.id)?.walkAwayFrom(origin, detail)
    this.dailyScheduler.getDailyBehaviors().get(b.id)?.walkAwayFrom(origin, detail)
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  private periodLabel(period: TimePeriod): string {
    const labels: Record<TimePeriod, string> = {
      dawn: 'lúc bình minh',
      morning: 'buổi sáng',
      noon: 'buổi trưa',
      afternoon: 'buổi chiều',
      dusk: 'lúc hoàng hôn',
      night: 'buổi tối',
    }
    return labels[period]
  }

  private getSocialNpcSnapshots(): SocialNpcSnapshot[] {
    const result: SocialNpcSnapshot[] = []
    for (const [npcId, journal] of this.dailyScheduler.getActivityJournals().entries()) {
      const npc = this.npcManager.get(npcId)
      result.push({
        npcId,
        name: npc?.label ?? npc?.name ?? npcId,
        relationships: [...journal.getRelationships()],
        dialogues: [...journal.getDialogues()],
      })
    }
    return result
  }

  private recordNpcActivity(npcId: string | undefined, action: import('../types').ActivityAction, detail?: string): void {
    if (!npcId) return
    this.dailyScheduler.getActivityJournals().get(npcId)?.record({
      location: 'town',
      locationName: 'Thị trấn',
      action,
      detail,
    })
  }

  private getNpcRecentEvents(npcId: string): Array<{ time?: string; text: string }> {
    const journal = this.dailyScheduler.getActivityJournals().get(npcId)
    if (!journal) return []

    const activities = journal.getRecentActivities(3).map(a => ({
      time: a.time,
      text: `${this.localizeActivityAction(a.action)} - ${a.location}${a.detail ? `: ${a.detail}` : ''}`,
    }))
    const dialogues = journal.getRecentDialogueSummaries(2).map(d => ({
      time: d.time,
      text: `${t('activity.chatted')} ${d.with}: ${d.topic}`,
    }))
    return [...dialogues, ...activities].slice(0, 4)
  }

  private localizeActivityAction(action: string): string {
    const key = `activity.${action}`
    const label = t(key)
    return label === key ? action : label
  }

  private initSelectionRing(): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.68, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    ring.visible = false
    ring.renderOrder = 5
    this.townScene.add(ring)
    this.selectedRing = ring
  }

  private selectNPC(npc: NPC): void {
    this.selectedNpcId = npc.id
    if (!this.selectedRing) return
    const pos = npc.getPosition()
    this.selectedRing.position.set(pos.x, 0.04, pos.z)
    this.selectedRing.visible = this.sceneSwitcher.getSceneType() === 'town' && npc.mesh.visible
  }

  private updateSelectionRing(): void {
    if (!this.selectedRing) return
    if (!this.selectedNpcId || this.sceneSwitcher.getSceneType() !== 'town') {
      this.selectedRing.visible = false
      return
    }
    const npc = this.npcManager.get(this.selectedNpcId)
    if (!npc || !npc.mesh.visible) {
      this.selectedNpcId = null
      this.selectedRing.visible = false
      this.cameraCtrl.follow(null)
      return
    }
    const pos = npc.getPosition()
    this.selectedRing.position.set(pos.x, 0.04, pos.z)
    this.selectedRing.visible = true
  }

  // ── State persistence ──

  private snapshotSaveTimer: ReturnType<typeof setInterval> | null = null

  private startSnapshotSaving(): void {
    if (this.snapshotSaveTimer) return
    this.snapshotSaveTimer = setInterval(() => this.saveSnapshot(), 10_000)
  }

  private stopSnapshotSaving(): void {
    if (this.snapshotSaveTimer) {
      clearInterval(this.snapshotSaveTimer)
      this.snapshotSaveTimer = null
    }
  }

  private saveSnapshot(): void {
    try {
      const npcPositions: Record<string, { x: number; z: number }> = {}
      for (const npc of this.npcManager.getAll()) {
        const pos = npc.getPosition()
        npcPositions[npc.id] = { x: pos.x, z: pos.z }
      }
      const snapshot = {
        townJournal: this.townJournal.toJSON(),
        activityJournals: Array.from(this.dailyScheduler.getActivityJournals().entries()).map(
          ([id, j]) => [id, j.toJSON()] as const,
        ),
        npcPositions,
        currentScene: this.sceneSwitcher.getSceneType(),
        globalMode: this.modeManager.isWorkMode() ? 'work' : 'life',
        gameClockState: this.gameClock.getState(),
      }
      localStorage.setItem(
        this.configStore.getScopedKey('agentshire_snapshot'),
        JSON.stringify(snapshot),
      )
    } catch {
      // localStorage full or unavailable
    }
  }

  private restoreSnapshot(): boolean {
    try {
      const raw = localStorage.getItem(this.configStore.getScopedKey('agentshire_snapshot'))
      if (!raw) return false
      const snapshot = JSON.parse(raw)
      if (snapshot.townJournal) this.townJournal.restore(snapshot.townJournal)
      if (snapshot.activityJournals) {
        for (const [id, data] of snapshot.activityJournals) {
          const journal = this.dailyScheduler.getActivityJournals().get(id)
          if (journal) journal.restore(data)
        }
      }
      if (snapshot.gameClockState?.hour != null) {
        this.gameClock.setTime(snapshot.gameClockState.hour)
      }
      return true
    } catch {
      return false
    }
  }

  // ── Update loop ──

  update(deltaTime: number): void {
    if (!this.cameraCtrl) return

    this.gameClock?.update(deltaTime)
    const curScene = this.sceneSwitcher.getSceneType()
    this.updateNearbyDoorInteraction()
    this.updatePlayerKeyboardMovement(deltaTime)
    if (this.townMapPanel?.style.display === 'block') this.renderTownMap()

    if (curScene === 'town') {
      this.cameraCtrl.update(deltaTime)
      this.timeOfDayLighting?.update(this.gameClock)
      this.weatherSystem?.update(deltaTime, this.gameClock)
      this.vehicleManager?.update(this.gameClock, deltaTime)
    } else if (curScene === 'office') {
      this.cameraCtrl.updateOfficePan(deltaTime)
    } else {
      this.cameraCtrl.update(deltaTime)
    }

    this.followBehavior.update(deltaTime * 1000)
    this.citizenChat.update(deltaTime * 1000)

    this.timeHUD?.update(this.gameClock, this.weatherSystem?.getDisplayWeather())

    const clockState = this.gameClock?.getState()
    if (clockState && curScene === 'town') {
      this.ambientSound.setEnabled(true)
      this.ambientSound.update(
        deltaTime,
        this.weatherSystem?.getDisplayWeather() ?? 'clear',
        clockState.period,
      )
    } else {
      this.ambientSound.setEnabled(false)
    }

    if (clockState) {
      this.bgm.update(
        deltaTime,
        this.weatherSystem?.getDisplayWeather() ?? 'clear',
        clockState.period,
        curScene,
      )
    }

    const activeScene = curScene === 'office' ? this.officeScene
      : curScene === 'town' ? this.townScene
      : this.museumScene
    this.npcManager?.update(deltaTime, this.engine.camera, this.engine.renderer, activeScene)
    this.updateSelectionRing()
    if (curScene === 'town' && this.postTownReturnDebugFrames > 0) {
      this.postTownReturnDebugFrames -= 1
    }
    if (curScene === 'town') {
      const allNpcs = this.npcManager?.getAll() ?? []
      for (const [npcId, b] of this.dailyScheduler.getDailyBehaviors()) {
        if (this.vehiclePassengerNpcIds.has(npcId)) continue
        b.update(deltaTime, allNpcs)
      }
      this.updateSocialAppointments()
      this.encounterManager?.update(deltaTime * 1000, allNpcs)
      this.casualEncounter?.update(
        deltaTime * 1000, allNpcs,
        this.weatherSystem?.getDisplayWeather(),
        this.gameClock?.getPeriod(),
      )
    }
    this.vfx?.update(deltaTime)
    this.bubbles?.update()
    if (curScene === 'office') {
      this.officeBuilder?.updateScreens(deltaTime)
      this.ui.updateWhiteboardMirror(this.officeBuilder.whiteboard.getCanvas())
    }
    this._minigameUpdateCb?.(deltaTime)
  }

  setImplicitChatFn(fn: ((req: {
    scene: string; system: string; user: string; maxTokens?: number; extraStop?: string[]
  }) => Promise<{ text: string; fallback: boolean }>) | null): void {
    this.dailyScheduler.setImplicitChatFn(fn)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onPlayerKeyDown)
    window.removeEventListener('keyup', this.onPlayerKeyUp)
    this.stopSnapshotSaving()
    this.citizenChat.destroy()
    this.dailyScheduler.stopDailyBehaviors()
    this.encounterManager?.destroy()
    this.townJournal?.destroy()
    this.workflow.abort()
    this.workflow.destroy()
    this.minigame?.unmount()
    this.modeManager?.destroy()
    this.modeIndicator?.destroy()
    this.timeHUD?.destroy()
    this.eventLogPanel?.destroy()
    this.socialFeedPanel?.destroy()
    this.townMapButton?.remove()
    this.townMapPanel?.remove()
    this.townMapButton = null
    this.townMapPanel = null
    this.weatherSystem?.destroy()
    this.ambientSound.destroy()
    this.bgm.destroy()
    removeDebugBindings()
    this.dataSource.disconnect()
    this.npcManager.destroy()
    if (this.selectedRing) {
      this.selectedRing.geometry.dispose()
      this.selectedRing.material.dispose()
      if (this.selectedRing.parent) this.selectedRing.parent.remove(this.selectedRing)
      this.selectedRing = null
    }
    this.cameraCtrl.destroy()
    this.bubbles.clear()
    this.vfx.clear()
    this.townBuilder.clear()
    this.officeBuilder.clear()
    this.museumBuilder.clear()
    this.vehicleManager.clear()
    this.interactionPromptEl?.remove()
    this.interactionPromptEl = null
  }
}
