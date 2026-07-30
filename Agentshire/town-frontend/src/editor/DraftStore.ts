import type { TownMapConfig } from './TownMapConfig'

const STORAGE_KEY = 'agentshire_map_draft'
const DEBOUNCE_MS = 2000

export class DraftStore {
  private timer: ReturnType<typeof setTimeout> | null = null

  saveDraft(config: TownMapConfig): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      try {
        const json = JSON.stringify(config)
        localStorage.setItem(STORAGE_KEY, json)
      } catch { /* quota exceeded — silently ignore */ }
    }, DEBOUNCE_MS)
  }

  saveImmediate(config: TownMapConfig): void {
    if (this.timer) clearTimeout(this.timer)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch { /* ignore */ }
  }

  loadDraft(): TownMapConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const config = JSON.parse(raw) as TownMapConfig
      this.sanitizeConfig(config)
      return config
    } catch {
      return null
    }
  }

  private sanitizeConfig(config: TownMapConfig): void {
    const isBadUrl = (url?: string) => !url || url.startsWith('blob:')
    config.buildings = config.buildings.filter(b => !isBadUrl(b.modelUrl))
    config.props = config.props.filter(p => !isBadUrl(p.modelUrl))
    config.roads = config.roads.filter(r => !isBadUrl(r.modelUrl))
    if (!Array.isArray(config.groups)) config.groups = []
  }

  hasDraft(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
  }

  clearDraft(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  exportJSON(config: TownMapConfig): void {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'town-map.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  importJSON(): Promise<TownMapConfig | null> {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(null); return }
        try {
          const text = await file.text()
          resolve(JSON.parse(text) as TownMapConfig)
        } catch {
          resolve(null)
        }
      }
      input.click()
    })
  }
}
