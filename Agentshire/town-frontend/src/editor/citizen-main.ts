import { initLocale, t, getLocale } from '../i18n'
initLocale()

import '../styles/editor.css'
import { CitizenWorkshop } from './citizen/CitizenWorkshop'

async function boot() {
  applyEditorLocale()
  preserveEditorLocaleLinks()

  const workshop = new CitizenWorkshop()
  workshop.show()

  /* ── Toolbar: Undo / Redo ── */
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null
  const updateUndoRedoBtns = () => {
    if (undoBtn) undoBtn.disabled = !workshop.canUndo
    if (redoBtn) redoBtn.disabled = !workshop.canRedo
  }
  updateUndoRedoBtns()
  undoBtn?.addEventListener('click', () => { workshop.undo(); updateUndoRedoBtns() })
  redoBtn?.addEventListener('click', () => { workshop.redo(); updateUndoRedoBtns() })
  workshop.onConfigChanged(updateUndoRedoBtns)

  /* ── Toolbar: Save ── */
  const saveBtn = document.getElementById('btn-save')
  const flashSaveBtn = (text: string) => {
    if (!saveBtn) return
    saveBtn.classList.add('save-flash')
    const origText = saveBtn.lastChild as Text
    const prev = origText.textContent
    origText.textContent = text
    setTimeout(() => { saveBtn.classList.remove('save-flash'); origText.textContent = prev }, 1200)
  }
  const doSave = async () => {
    const ok = await workshop.saveToFile()
    flashSaveBtn(ok ? ` ${t('editor.saved')}` : ` ${t('editor.failed')}`)
  }
  saveBtn?.addEventListener('click', doSave)

  /* ── Toolbar: Publish ── */
  const publishBtn = document.getElementById('btn-publish') as HTMLButtonElement | null
  const PUBLISH_ICON_HTML = publishBtn?.querySelector('svg')?.outerHTML ?? ''
  const SPINNER_ICON_HTML = '<svg class="cw-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'

  const showToast = (text: string, isError = false) => {
    const existing = document.querySelector('.cw-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.className = `cw-toast${isError ? ' cw-toast-error' : ''}`
    toast.textContent = text
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add('visible'))
    setTimeout(() => {
      toast.classList.remove('visible')
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }

  let publishing = false
  publishBtn?.addEventListener('click', async () => {
    if (publishing || publishBtn.disabled) return
    publishing = true
    publishBtn.disabled = true
    const svg = publishBtn.querySelector('svg')
    if (svg) svg.outerHTML = SPINNER_ICON_HTML
    try {
      const result = await workshop.publish()
      if (result.success) {
        const cs = result.changeset
        const parts: string[] = []
        if (cs) {
          if (cs.agentToCreate?.length) parts.push(getLocale() === 'vi' ? `Tạo ${cs.agentToCreate.length} Agent` : getLocale() === 'en' ? `Create ${cs.agentToCreate.length} Agent(s)` : `创建 ${cs.agentToCreate.length} 个 Agent`)
          if (cs.agentToDisable?.length) parts.push(getLocale() === 'vi' ? `Tắt ${cs.agentToDisable.length}` : getLocale() === 'en' ? `Disable ${cs.agentToDisable.length}` : `停用 ${cs.agentToDisable.length} 个`)
          if (cs.agentToUpdateSoul?.length) parts.push(getLocale() === 'vi' ? `Cập nhật ${cs.agentToUpdateSoul.length}` : getLocale() === 'en' ? `Update ${cs.agentToUpdateSoul.length}` : `更新 ${cs.agentToUpdateSoul.length} 个`)
        }
        const summary = parts.length ? `（${parts.join('，')}）` : ''
        showToast(getLocale() === 'vi' ? `Đã xuất bản${summary}` : getLocale() === 'en' ? `Published${summary}` : `发布成功${summary}`)
      } else {
        showToast(result.error ?? (getLocale() === 'vi' ? 'Xuất bản thất bại' : getLocale() === 'en' ? 'Publish failed' : '发布失败'), true)
      }
    } catch {
      showToast(getLocale() === 'vi' ? 'Gửi yêu cầu xuất bản thất bại' : getLocale() === 'en' ? 'Publish request failed' : '发布请求失败', true)
    } finally {
      const spinner = publishBtn.querySelector('svg')
      if (spinner) spinner.outerHTML = PUBLISH_ICON_HTML
      publishBtn.disabled = false
      publishing = false
    }
  })

  /* ── Toolbar: Export / Import / Clear ── */
  document.getElementById('btn-export')?.addEventListener('click', () => {
    workshop.exportJSON()
  })
  document.getElementById('btn-import')?.addEventListener('click', async () => {
    const ok = await workshop.importJSON()
    flashSaveBtn(ok ? ` ${t('editor.imported')}` : ` ${t('editor.import_failed')}`)
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
    const ok = await showConfirm(
      t('editor.clear_char'),
      t('editor.clear_char_confirm')
    )
    if (!ok) return
    workshop.resetToDefault()
  })

  /* ── Keyboard shortcuts ── */
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave() }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      workshop.undo()
      updateUndoRedoBtns()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      workshop.redo()
      updateUndoRedoBtns()
    }
  })

  /* ── More menu toggle ── */
  const moreBtn = document.getElementById('btn-more')
  const moreMenu = document.getElementById('more-menu')
  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    moreMenu?.classList.toggle('open')
  })
  document.addEventListener('click', () => moreMenu?.classList.remove('open'))
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
