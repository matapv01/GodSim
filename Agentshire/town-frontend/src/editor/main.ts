import { initLocale, t } from '../i18n'
initLocale()

import '../styles/editor.css'
import { TownEditor } from './TownEditor'
import { createDefaultConfig } from './TownMapConfig'
import { AssetPalette } from './AssetPalette'
import { AssetPreview } from './AssetPreview'
import { PropertyInspector } from './PropertyInspector'
import { BindingPanel } from './BindingPanel'
import { CustomAssetStore } from './CustomAssetStore'
import { CustomAssetUpload } from './CustomAssetUpload'

async function boot() {
  applyEditorLocale()
  preserveEditorLocaleLinks()

  const editor = new TownEditor()

  editor.initScene(document.getElementById('scene-container')!)
  editor.initKeyboard()
  editor.initTerrainBar()

  const customStore = new CustomAssetStore()
  await customStore.init()

  editor.editorScene.setCustomStore(customStore)
  editor.editorScene.fullRebuild()
  document.getElementById('editor-loading')?.classList.add('hidden')

  const palette = new AssetPalette(document.getElementById('asset-palette')!, editor)
  const preview = new AssetPreview(document.getElementById('asset-preview')!)
  const customUpload = new CustomAssetUpload(customStore)

  palette.setPreview(preview)
  palette.setCustomStore(customStore)
  palette.setCustomUpload(customUpload)
  const inspector = new PropertyInspector(document.getElementById('property-inspector')!, editor)
  const bindings = new BindingPanel(document.getElementById('binding-panel')!, editor)

  const updateStatusCounts = () => {
    const { config } = editor
    const gi = document.getElementById('status-grid')
    const bi = document.getElementById('status-buildings')
    const pi = document.getElementById('status-props')
    if (gi) gi.textContent = `${config.grid.cols} × ${config.grid.rows}`
    if (bi) bi.textContent = `${t('editor.building_count')}: ${config.buildings.length}`
    if (pi) pi.textContent = `${t('editor.prop_count')}: ${config.props.length + config.roads.length}`
  }

  editor.on((e) => {
    if (e.type === 'config_changed') updateStatusCounts()
    if (e.type === 'selection_changed') inspector.updateMulti(e.items)
  })

  updateStatusCounts()

  /* ── Floating toolbar tooltip ── */
  const sceneToolbar = document.getElementById('scene-toolbar')!
  {
    const tip = document.createElement('div')
    tip.className = 'pi-tooltip'
    document.body.appendChild(tip)
    let activeTipBtn: HTMLElement | null = null

    sceneToolbar.addEventListener('pointermove', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null
      if (btn === activeTipBtn) return
      activeTipBtn = btn
      if (!btn) { tip.classList.remove('visible'); return }
      tip.textContent = btn.dataset.tip!
      const rect = btn.getBoundingClientRect()
      tip.style.left = `${rect.left + rect.width / 2}px`
      tip.style.top = `${rect.top - 6}px`
      tip.classList.add('visible')
    })

    sceneToolbar.addEventListener('pointerleave', () => {
      activeTipBtn = null
      tip.classList.remove('visible')
    })
  }

  document.getElementById('btn-undo')?.addEventListener('click', () => editor.undoStack.undo())
  document.getElementById('btn-redo')?.addEventListener('click', () => editor.undoStack.redo())

  const saveBtn = document.getElementById('btn-save')
  const flashSaveBtn = (text: string) => {
    if (!saveBtn) return
    saveBtn.classList.add('save-flash')
    const origText = saveBtn.lastChild as Text
    const prev = origText.textContent
    origText.textContent = text
    setTimeout(() => { saveBtn.classList.remove('save-flash'); origText.textContent = prev }, 1200)
  }
  const doSave = () => {
    editor.draftStore.saveImmediate(editor.config)
    flashSaveBtn(` ${t('editor.saved')}`)
  }
  saveBtn?.addEventListener('click', doSave)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave() }
  })

  document.getElementById('btn-export')?.addEventListener('click', () => {
    editor.draftStore.saveImmediate(editor.config)
    editor.draftStore.exportJSON(editor.config)
  })
  document.getElementById('btn-import')?.addEventListener('click', async () => {
    const cfg = await editor.draftStore.importJSON()
    if (cfg) {
      editor.config = cfg
      editor.undoStack.clear()
      editor.setSelection(null)
      editor.editorScene.fullRebuild()
      editor.onConfigChanged()
    }
  })

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
      const overlay = document.getElementById('confirm-overlay')!
      document.getElementById('confirm-title')!.textContent = title
      document.getElementById('confirm-message')!.textContent = message
      overlay.classList.add('open')

      const cleanup = (result: boolean) => {
        overlay.classList.remove('open')
        okBtn.removeEventListener('click', onOk)
        cancelBtn.removeEventListener('click', onCancel)
        overlay.removeEventListener('click', onBg)
        resolve(result)
      }
      const onOk = () => cleanup(true)
      const onCancel = () => cleanup(false)
      const onBg = (e: Event) => { if (e.target === overlay) cleanup(false) }

      const okBtn = document.getElementById('confirm-ok')!
      const cancelBtn = document.getElementById('confirm-cancel')!
      okBtn.addEventListener('click', onOk)
      cancelBtn.addEventListener('click', onCancel)
      overlay.addEventListener('click', onBg)
    })
  }

  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    const ok = await showConfirm(t('editor.clear_confirm_title'), t('editor.clear_confirm_msg'))
    if (!ok) return
    editor.config = createDefaultConfig()
    editor.undoStack.clear()
    editor.setSelection(null)
    editor.editorScene.fullRebuild()
    editor.onConfigChanged()
  })

  document.getElementById('btn-bindings')?.addEventListener('click', () => {
    document.getElementById('binding-overlay')?.classList.toggle('open')
    bindings.refresh()
  })
  document.getElementById('binding-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).classList.remove('open')
  })

  document.getElementById('btn-collapse-palette')?.addEventListener('click', () => {
    document.getElementById('asset-palette')?.classList.add('collapsed')
  })
  document.getElementById('btn-expand-palette')?.addEventListener('click', () => {
    document.getElementById('asset-palette')?.classList.remove('collapsed')
  })

  document.querySelectorAll('#resize-menu button[data-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = (btn as HTMLElement).dataset.dir!
      const amount = parseInt((btn as HTMLElement).dataset.amount!, 10)
      editor.resizeGrid(dir, amount)
    })
  })

  document.getElementById('btn-camera-toggle')?.addEventListener('click', () => {
    editor.toggleCamera()
  })

  document.getElementById('btn-preview')?.addEventListener('click', () => {
    editor.openPreview()
  })

  ;(window as unknown as Record<string, unknown>).__townEditor = editor
}

boot().catch(console.error)

function applyEditorLocale(): void {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!
    const translated = t(key)
    if (translated !== key) el.textContent = translated
  })
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const key = el.getAttribute('data-i18n-tip')!
    const translated = t(key)
    if (translated !== key) el.setAttribute('data-tip', translated)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title')!
    const translated = t(key)
    if (translated !== key) el.setAttribute('title', translated)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')!
    const translated = t(key)
    if (translated !== key) (el as HTMLInputElement).placeholder = translated
  })
}

function preserveEditorLocaleLinks(): void {
  const lang = new URLSearchParams(location.search).get('lang') ?? 'vi'
  document.querySelectorAll<HTMLAnchorElement>('a[href$=".html"]').forEach(a => {
    const url = new URL(a.getAttribute('href')!, location.href)
    url.searchParams.set('lang', lang)
    a.href = `${url.pathname}${url.search}`
  })
}
