/**
 * Bottom input bar for the Agentshire.
 * Handles text input, voice (browser STT), image attachment, and send.
 * Communicates with OpenClaw backend via WebSocket.
 */
import { isSttSupported, startStt, stopStt, isSttActive } from './speech'
import { parseCommand } from '../utils/command-parser'
import { t } from '../i18n'

export type TownMessage =
  | { type: 'chat'; message: string }
  | { type: 'multimodal'; parts: Array<{ kind: 'text'; text: string } | { kind: 'image'; data: string; mimeType: string }> }

export type SendFn = (msg: TownMessage) => void

export interface InputBarOptions {
  send: SendFn
  onUserMessage?: (text: string, images?: Array<{ data: string; mimeType: string }>) => void
  onNewSession?: () => void
  wrapMessage?: (text: string) => string
}

interface PendingImage {
  data: string
  mimeType: string
}

export class InputBar {
  private textarea: HTMLTextAreaElement
  private sendBtn: HTMLButtonElement
  private voiceBtn: HTMLButtonElement | null
  private attachBtn: HTMLButtonElement | null
  private fileInput: HTMLInputElement | null
  private previewBar: HTMLElement | null
  private sttInterim: HTMLElement | null
  private composing = false
  private recording = false
  private pendingImages: PendingImage[] = []
  private opts: InputBarOptions

  constructor(opts: InputBarOptions) {
    this.opts = opts
    this.textarea = document.getElementById('town-input-text') as HTMLTextAreaElement
    this.sendBtn = document.getElementById('town-send-btn') as HTMLButtonElement
    this.voiceBtn = document.getElementById('town-voice-btn') as HTMLButtonElement | null
    this.attachBtn = document.getElementById('town-attach-btn') as HTMLButtonElement | null
    this.fileInput = document.getElementById('town-file-input') as HTMLInputElement | null
    this.previewBar = document.getElementById('town-image-preview') as HTMLElement | null
    this.sttInterim = document.getElementById('town-stt-interim') as HTMLElement | null

    this.bind()
  }

  private bind(): void {
    this.sendBtn.addEventListener('click', () => this.submit())

    this.textarea.addEventListener('compositionstart', () => { this.composing = true })
    this.textarea.addEventListener('compositionend', () => { this.composing = false })
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.composing) {
        e.preventDefault()
        this.submit()
      }
    })
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto'
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 120) + 'px'
    })

    if (this.voiceBtn && isSttSupported()) {
      this.voiceBtn.style.display = ''
      this.voiceBtn.addEventListener('click', () => this.toggleVoice())
    } else if (this.voiceBtn) {
      this.voiceBtn.style.display = 'none'
    }

    if (this.attachBtn && this.fileInput) {
      this.attachBtn.addEventListener('click', () => this.fileInput!.click())
      this.fileInput.addEventListener('change', () => this.handleFileSelect())
    }

    this.textarea.addEventListener('paste', (e) => this.handlePaste(e))
  }

  private toggleVoice(): void {
    if (this.recording) {
      stopStt()
      this.recording = false
      this.voiceBtn?.classList.remove('recording')
      if (this.sttInterim) this.sttInterim.style.display = 'none'
      return
    }

    const started = startStt({
      onTranscript: (text, isFinal) => {
        if (isFinal) {
          const current = this.textarea.value
          const sep = current && !current.endsWith(' ') ? ' ' : ''
          this.textarea.value = current + sep + text
          if (this.sttInterim) this.sttInterim.style.display = 'none'
        } else if (this.sttInterim) {
          this.sttInterim.textContent = text
          this.sttInterim.style.display = 'block'
        }
      },
      onStart: () => {
        this.recording = true
        this.voiceBtn?.classList.add('recording')
      },
      onEnd: () => {
        this.recording = false
        this.voiceBtn?.classList.remove('recording')
        if (this.sttInterim) this.sttInterim.style.display = 'none'
      },
      onError: () => {
        this.recording = false
        this.voiceBtn?.classList.remove('recording')
        if (this.sttInterim) this.sttInterim.style.display = 'none'
      },
    })

    if (started) {
      this.recording = true
      this.voiceBtn?.classList.add('recording')
    }
  }

  private handleFileSelect(): void {
    if (!this.fileInput?.files) return
    for (const file of this.fileInput.files) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        this.pendingImages.push({ data: (reader.result as string).split(',')[1], mimeType: file.type })
        this.renderPreviews()
      }
      reader.readAsDataURL(file)
    }
    this.fileInput.value = ''
  }

  private handlePaste(e: ClipboardEvent): void {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        this.pendingImages.push({ data: (reader.result as string).split(',')[1], mimeType: file.type })
        this.renderPreviews()
      }
      reader.readAsDataURL(file)
    }
  }

  private renderPreviews(): void {
    if (!this.previewBar) return
    this.previewBar.innerHTML = ''
    if (this.pendingImages.length === 0) {
      this.previewBar.style.display = 'none'
      return
    }
    this.previewBar.style.display = 'flex'
    this.pendingImages.forEach((img, idx) => {
      const thumb = document.createElement('div')
      thumb.className = 'town-img-thumb'
      const imgEl = document.createElement('img')
      imgEl.src = `data:${img.mimeType};base64,${img.data}`
      thumb.appendChild(imgEl)
      const removeBtn = document.createElement('button')
      removeBtn.className = 'town-img-remove'
      removeBtn.textContent = '✕'
      removeBtn.addEventListener('click', () => {
        this.pendingImages.splice(idx, 1)
        this.renderPreviews()
      })
      thumb.appendChild(removeBtn)
      this.previewBar!.appendChild(thumb)
    })
  }

  private submit(): void {
    const text = this.textarea.value.trim()
    const images = this.pendingImages.splice(0)
    this.renderPreviews()

    if (!text && images.length === 0) return

    if (images.length === 0) {
      const cmd = parseCommand(text)
      if (cmd) {
        if (cmd.command === 'new' || cmd.command === 'reset') {
          this.textarea.value = ''
          this.textarea.style.height = 'auto'
          this.opts.onNewSession?.()
          return
        }
        if (cmd.type === 'gateway') {
          this.textarea.value = ''
          this.textarea.style.height = 'auto'
          this.opts.send({ type: 'chat', message: cmd.raw })
          this.opts.onUserMessage?.(cmd.raw)
          return
        }
      }
    }

    if (images.length > 0) {
      const parts: Array<{ kind: 'text'; text: string } | { kind: 'image'; data: string; mimeType: string }> = []
      if (text) parts.push({ kind: 'text', text })
      for (const img of images) parts.push({ kind: 'image', data: img.data, mimeType: img.mimeType })
      this.opts.send({ type: 'multimodal', parts })
      this.opts.onUserMessage?.(text, images)
    } else {
      const wrapped = this.opts.wrapMessage ? this.opts.wrapMessage(text) : text
      this.opts.send({ type: 'chat', message: wrapped })
      this.opts.onUserMessage?.(text)
    }

    this.textarea.value = ''
    this.textarea.style.height = 'auto'
    this.textarea.focus()
  }

  setBusy(busy: boolean): void {
    this.textarea.placeholder = busy ? t('input.busy') : t('input.idle')
    this.sendBtn.classList.toggle('btn-busy', busy)
  }

  focus(): void { this.textarea.focus() }
}
