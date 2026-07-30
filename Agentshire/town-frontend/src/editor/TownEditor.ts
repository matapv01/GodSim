import { type TownMapConfig, type PlacedItem, type TerrainType, type BindingSlot, type GroupDef, type LightPointDef, createDefaultConfig, TERRAIN_COLORS, genId } from './TownMapConfig'
import { UndoStack, type Command } from './UndoStack'
import { DraftStore } from './DraftStore'
import { EditorScene } from './EditorScene'
import type { AssetCatalogEntry } from './AssetPalette'
import { getLocale } from '../i18n'

function l(vi: string, en: string, zh: string): string {
  const locale = getLocale()
  return locale === 'vi' ? vi : locale === 'en' ? en : zh
}

export type EditorTool = 'select' | 'terrain' | 'erase'

export type EditorEvent =
  | { type: 'config_changed' }
  | { type: 'selection_changed'; items: PlacedItem[] }
  | { type: 'tool_changed'; tool: EditorTool }

type EditorListener = (e: EditorEvent) => void

export class TownEditor {
  config: TownMapConfig
  activeTool: EditorTool = 'select'
  selectedItems: PlacedItem[] = []

  get selectedItem(): PlacedItem | null { return this.selectedItems[0] ?? null }

  readonly undoStack: UndoStack
  readonly draftStore: DraftStore
  editorScene!: EditorScene

  private _previewWindow: Window | null = null

  private listeners: EditorListener[] = []
  private clipboard: PlacedItem[] = []

  constructor() {
    this.undoStack = new UndoStack(() => this.onConfigChanged())
    this.draftStore = new DraftStore()

    const draft = this.draftStore.loadDraft()
    this.config = draft ?? createDefaultConfig()
  }

  initScene(container: HTMLElement): void {
    this.editorScene = new EditorScene(container, this)
  }

  on(cb: EditorListener): void { this.listeners.push(cb) }
  emit(e: EditorEvent): void { this.listeners.forEach(cb => cb(e)) }

  onConfigChanged(): void {
    this.config.meta.updatedAt = new Date().toISOString()
    this.draftStore.saveDraft(this.config)
    this.emit({ type: 'config_changed' })
  }

  unbind(slot: BindingSlot): void {
    if (slot === 'houses') {
      this.config.bindings.houses = []
    } else {
      this.config.bindings[slot] = null
    }
    this.onConfigChanged()
  }

  completeBinding(slot: BindingSlot, buildingId: string): void {
    if (slot === 'houses') {
      if (!this.config.bindings.houses.includes(buildingId)) {
        this.config.bindings.houses.push(buildingId)
      }
    } else {
      this.config.bindings[slot] = buildingId
    }
    this.onConfigChanged()
  }

  setTool(tool: EditorTool): void {
    this.activeTool = tool
    document.querySelectorAll('.ftb-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tool === tool)
    })
    const terrainBar = document.getElementById('terrain-bar')
    terrainBar?.classList.toggle('visible', tool === 'terrain')

    if (tool !== 'select') {
      this.editorScene.setGhost(null)
    }

    const toolNames: Record<EditorTool, string> = {
      select: l('Chọn', 'Select', '选择模式'),
      terrain: l('Cọ địa hình', 'Terrain', '地形刷'),
      erase: l('Xóa', 'Delete', '删除模式'),
    }
    const statusTool = document.getElementById('status-tool')
    if (statusTool) statusTool.textContent = toolNames[tool]

    this.emit({ type: 'tool_changed', tool })
  }

  setSelection(items: PlacedItem | PlacedItem[] | null): void {
    if (items === null) {
      this.selectedItems = []
    } else if (Array.isArray(items)) {
      this.selectedItems = items
    } else {
      this.selectedItems = [items]
    }
    this.editorScene.setSelection(this.selectedItems)
    this.emit({ type: 'selection_changed', items: this.selectedItems })
  }

  startPlacing(entry: AssetCatalogEntry): void {
    this.setTool('select')
    this.setSelection(null)
    this.editorScene.setGhost(entry)
    const statusTool = document.getElementById('status-tool')
    if (statusTool) statusTool.textContent = l(`Đặt: ${entry.name}`, `Place: ${entry.name}`, `放置: ${entry.name}`)
  }

  stopPlacing(): void {
    this.editorScene.setGhost(null)
    const statusTool = document.getElementById('status-tool')
    if (statusTool) statusTool.textContent = l('Chọn', 'Select', '选择模式')
  }

  deleteSelected(): void {
    if (this.selectedItems.length === 0) return
    if (this.selectedItems.length === 1) {
      this.editorScene.deleteItem(this.selectedItems[0])
      this.setSelection(null)
      return
    }
    const items = [...this.selectedItems]
    const snapshots = items.map(item => ({ item, kind: item.kind, data: item.data }))
    const config = this.config
    const scene = this.editorScene
    const cmd: Command = {
      execute: () => {
        for (const s of snapshots) {
          const id = s.data.id
          if (s.kind === 'building') config.buildings = config.buildings.filter(x => x.id !== id)
          else if (s.kind === 'prop') config.props = config.props.filter(x => x.id !== id)
          else config.roads = config.roads.filter(x => x.id !== id)
          scene.removeModel(id)
        }
      },
      undo: () => {
        for (const s of snapshots) {
          if (s.kind === 'building') { config.buildings.push(s.data as any); scene.rebuildSingleModel(s.item) }
          else if (s.kind === 'prop') { config.props.push(s.data as any); scene.rebuildSingleModel(s.item) }
          else { config.roads.push(s.data as any); scene.rebuildSingleModel(s.item) }
        }
      },
    }
    this.undoStack.push(cmd)
    this.setSelection(null)
  }

  copySelected(): void {
    if (this.selectedItems.length === 0) return
    this.clipboard = this.selectedItems.map(item => ({
      kind: item.kind,
      data: structuredClone(item.data),
    } as PlacedItem))
  }

  pasteClipboard(): void {
    if (this.clipboard.length === 0) return

    const config = this.config
    const scene = this.editorScene
    const pastedItems: PlacedItem[] = []

    for (const src of this.clipboard) {
      const cloned = structuredClone(src.data)
      const prefix = src.kind === 'building' ? 'b' : src.kind === 'prop' ? 'p' : 'r'
      cloned.id = genId(prefix)
      cloned.gridX += 2
      cloned.gridZ += 2

      if (cloned.lights) {
        for (const light of cloned.lights as LightPointDef[]) {
          light.id = genId('light')
        }
      }

      if (src.kind === 'prop') {
        const propData = cloned as import('./TownMapConfig').PropPlacement
        if (propData.vehicleRoute?.waypoints) {
          for (const wp of propData.vehicleRoute.waypoints) {
            wp.x += 2
            wp.z += 2
          }
        }
      }

      pastedItems.push({ kind: src.kind, data: cloned } as PlacedItem)
    }

    const sourceGroupId = (() => {
      if (this.clipboard.length < 2) return null
      const ids = new Set(this.clipboard.map(i => i.data.id))
      const srcGroup = this.config.groups.find(g => g.memberIds.every(mid => ids.has(mid)) && g.memberIds.length === ids.size)
      return srcGroup ?? null
    })()

    const cmd: Command = {
      execute: () => {
        for (const item of pastedItems) {
          if (item.kind === 'building') config.buildings.push(item.data as any)
          else if (item.kind === 'prop') config.props.push(item.data as any)
          else config.roads.push(item.data as any)
          scene.rebuildSingleModel(item)
        }

        if (sourceGroupId) {
          const newGroup: GroupDef = {
            id: genId('grp'),
            memberIds: pastedItems.map(i => i.data.id),
            anchorX: (sourceGroupId.anchorX ?? 0) + 2,
            anchorZ: (sourceGroupId.anchorZ ?? 0) + 2,
          }
          config.groups.push(newGroup)
        }

        this.setSelection(pastedItems)
      },
      undo: () => {
        for (const item of pastedItems) {
          const id = item.data.id
          if (item.kind === 'building') config.buildings = config.buildings.filter(x => x.id !== id)
          else if (item.kind === 'prop') config.props = config.props.filter(x => x.id !== id)
          else config.roads = config.roads.filter(x => x.id !== id)
          scene.removeModel(id)
        }

        if (sourceGroupId) {
          const newIds = new Set(pastedItems.map(i => i.data.id))
          config.groups = config.groups.filter(g => !g.memberIds.some(mid => newIds.has(mid)))
        }

        this.setSelection(null)
      },
    }
    this.undoStack.push(cmd)
  }

  rotateSelected(): void {
    if (this.selectedItems.length === 0) return
    for (const item of this.selectedItems) {
      this.editorScene.rotateItem(item)
    }
  }

  adjustScale(delta: number): void {
    if (this.selectedItems.length === 0) return
    const item = this.selectedItems[0]
    const d = item.data as { scale?: number }
    const prev = d.scale ?? 1
    const next = Math.max(0.05, Math.min(5, Math.round((prev + delta) * 100) / 100))
    if (prev === next) return
    const cmd: Command = {
      execute: () => { d.scale = next; this.editorScene.updateModelTransform(item); this.editorScene.setSelection(this.selectedItems) },
      undo: () => { d.scale = prev; this.editorScene.updateModelTransform(item); this.editorScene.setSelection(this.selectedItems) },
    }
    this.undoStack.push(cmd)
    this.emit({ type: 'selection_changed', items: this.selectedItems })
  }

  resizeGrid(direction: string, amount: number): void {
    const { config } = this
    const { cols, rows } = config.grid

    if (direction === 'right') {
      const nc = Math.max(20, Math.min(80, cols + amount))
      if (nc === cols) return
      config.grid.cols = nc
      for (const row of config.terrain) {
        while (row.length < nc) row.push({ type: 'grass' })
        row.length = nc
      }
    } else if (direction === 'bottom') {
      const nr = Math.max(16, Math.min(60, rows + amount))
      if (nr === rows) return
      config.grid.rows = nr
      while (config.terrain.length < nr) {
        config.terrain.push(Array.from({ length: config.grid.cols }, () => ({ type: 'grass' as const })))
      }
      config.terrain.length = nr
    } else if (direction === 'left') {
      const nc = Math.max(20, Math.min(80, cols + amount))
      if (nc === cols) return
      const delta = nc - cols
      config.grid.cols = nc
      for (const row of config.terrain) {
        if (delta > 0) for (let i = 0; i < delta; i++) row.unshift({ type: 'grass' })
        else row.splice(0, -delta)
      }
      for (const b of config.buildings) b.gridX += delta
      for (const p of config.props) p.gridX += delta
      for (const r of config.roads) r.gridX += delta
    } else if (direction === 'top') {
      const nr = Math.max(16, Math.min(60, rows + amount))
      if (nr === rows) return
      const delta = nr - rows
      config.grid.rows = nr
      if (delta > 0) {
        for (let i = 0; i < delta; i++)
          config.terrain.unshift(Array.from({ length: config.grid.cols }, () => ({ type: 'grass' as const })))
      } else {
        config.terrain.splice(0, -delta)
      }
      for (const b of config.buildings) b.gridZ += delta
      for (const p of config.props) p.gridZ += delta
      for (const r of config.roads) r.gridZ += delta
    }

    this.editorScene.fullRebuild()
    this.onConfigChanged()
  }

  initKeyboard(): void {
    document.querySelectorAll('.ftb-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool((btn as HTMLElement).dataset.tool as EditorTool)
      })
    })

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        this.copySelected()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        this.pasteClipboard()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) this.undoStack.redo(); else this.undoStack.undo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        this.selectAll()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        if (e.shiftKey) this.ungroupSelected(); else this.groupSelected()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected(); return
      }

      if (e.key === 'r' || e.key === 'R') {
        if (this.editorScene.currentGhostEntry) {
          this.editorScene.rotateGhost()
        } else {
          this.rotateSelected()
        }
        return
      }

      if (e.key === 'Escape') {
        this.stopPlacing()
        this.setSelection(null)
        this.setTool('select')
        return
      }

      if ((e.key === '=' || e.key === '+') && this.selectedItems.length > 0) {
        this.adjustScale(0.1); return
      }
      if ((e.key === '-' || e.key === '_') && this.selectedItems.length > 0) {
        this.adjustScale(-0.1); return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        this.toggleCamera()
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        this.openPreview()
        return
      }

      const toolKeys: Record<string, EditorTool> = { v: 'select', t: 'terrain', x: 'erase' }
      if (toolKeys[e.key]) this.setTool(toolKeys[e.key])
    })
  }

  selectAll(): void {
    const items: PlacedItem[] = [
      ...this.config.buildings.map(b => ({ kind: 'building' as const, data: b })),
      ...this.config.props.map(p => ({ kind: 'prop' as const, data: p })),
      ...this.config.roads.map(r => ({ kind: 'road' as const, data: r })),
    ]
    this.setSelection(items)
  }

  groupSelected(): void {
    if (this.selectedItems.length < 2) return
    this.editorScene.createGroup(this.selectedItems)
    this.setSelection(this.selectedItems)
  }

  ungroupSelected(): void {
    if (this.selectedItems.length === 0) return
    const itemId = this.selectedItems[0].data.id
    const group = this.config.groups.find(g => g.memberIds.includes(itemId))
    if (group) {
      const items = this.editorScene.getGroupItems(group)
      this.editorScene.dissolveGroup(group.id)
      this.setSelection(items)
    }
  }

  toggleCamera(): void {
    const isPersp = this.editorScene.toggleCamera()
    const toggle = document.getElementById('btn-camera-toggle')
    if (toggle) {
      toggle.classList.toggle('active', isPersp)
      toggle.dataset.tip = isPersp ? l('Góc nhìn phối cảnh (Tab)', 'Perspective (Tab)', '透视模式 (Tab)') : l('Nhìn từ trên xuống (Tab)', 'Top-down (Tab)', '俯视模式 (Tab)')
    }
    const statusTool = document.getElementById('status-tool')
    if (statusTool && isPersp) statusTool.textContent = l('Phối cảnh · Chuột phải xoay · Chuột giữa kéo · Cuộn để zoom', 'Perspective · RMB rotate · MMB pan · scroll zoom', '透视模式 · 右键旋转 · 中键平移 · 滚轮缩放')
    else if (statusTool) statusTool.textContent = l('Chọn', 'Select', '选择模式')
  }

  initTerrainBar(): void {
    const bar = document.getElementById('terrain-bar')!
    const types: TerrainType[] = ['grass', 'sand', 'street', 'plaza', 'sidewalk', 'water']
    types.forEach((t, i) => {
      const sw = document.createElement('div')
      sw.className = `terrain-swatch${i === 0 ? ' active' : ''}`
      sw.style.background = TERRAIN_COLORS[t]
      sw.title = t
      sw.addEventListener('click', () => {
        bar.querySelectorAll('.terrain-swatch').forEach(s => s.classList.remove('active'))
        sw.classList.add('active')
        this.editorScene.setActiveTerrain(t)
      })
      bar.appendChild(sw)
    })
  }

  openPreview(): void {
    this.draftStore.saveImmediate(this.config)
    if (this._previewWindow && !this._previewWindow.closed) {
      this._previewWindow.focus()
      return
    }
    this._previewWindow = window.open('preview.html', 'agentshire-preview', 'width=1280,height=800')
  }
}
