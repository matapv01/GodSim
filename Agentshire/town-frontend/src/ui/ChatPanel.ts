// @desc Chat panel — message list rendering and scroll management

import type { DialogMessage } from '../types'
import { stripTags } from './ui-utils'
import { t } from '../i18n'

/**
 * Manages the chat message list displayed in the "chat" tab.
 * Receives the chat panel DOM element from UIManager during construction.
 */
export class ChatPanel {
  private chatMessages: DialogMessage[] = []
  private chatPanelEl: HTMLElement

  constructor(chatPanelEl: HTMLElement) {
    this.chatPanelEl = chatPanelEl
  }

  /** Append a message bubble and auto-scroll to bottom. */
  addChatMessage(msg: DialogMessage): void {
    if (!this.chatPanelEl) return
    this.chatMessages.push(msg)
    const isUser = msg.from === 'user' || msg.from === '你' || msg.from === 'Jin' || msg.from === 'Mayor'
    const div = document.createElement('div')
    div.className = 'chat-msg ' + (isUser ? 'user' : 'npc')
    const bgColor = isUser ? '#DDA444' : '#4488CC'
    const avatarDiv = document.createElement('div')
    avatarDiv.className = 'avatar'
    avatarDiv.style.background = bgColor
    avatarDiv.textContent = isUser ? t('you')[0] : msg.from[0]
    const bubbleDiv = document.createElement('div')
    bubbleDiv.className = 'bubble'
    bubbleDiv.textContent = stripTags(msg.text)
    div.appendChild(avatarDiv)
    div.appendChild(bubbleDiv)
    this.chatPanelEl.appendChild(div)
    this.chatPanelEl.scrollTop = this.chatPanelEl.scrollHeight
  }
}
