import type { TownEvent } from '../npc/TownJournal'
import { createLucideIcon } from './LucideIcon'
import { t } from '../i18n'

export class EventLogPanel {
  private container: HTMLElement
  private list: HTMLElement
  private collapsed = false

  constructor() {
    this.injectStyles()
    this.container = document.createElement('div')
    this.container.className = 'event-log-panel'

    const header = document.createElement('button')
    header.type = 'button'
    header.className = 'event-log-header'
    const icon = createLucideIcon('list', 14, 'currentColor')
    if (icon) header.appendChild(icon)
    const title = document.createElement('span')
    title.textContent = t('event_log.title')
    header.appendChild(title)
    header.addEventListener('click', () => this.toggle())

    this.list = document.createElement('div')
    this.list.className = 'event-log-list'

    this.container.appendChild(header)
    this.container.appendChild(this.list)
    document.body.appendChild(this.container)
  }

  add(event: TownEvent): void {
    const row = document.createElement('div')
    row.className = 'event-log-row'
    const time = document.createElement('span')
    time.className = 'event-log-time'
    time.textContent = event.gameTime
    const text = document.createElement('span')
    text.className = 'event-log-text'
    text.textContent = event.description
    row.appendChild(time)
    row.appendChild(text)
    this.list.appendChild(row)

    while (this.list.children.length > 60) {
      this.list.firstElementChild?.remove()
    }
    this.list.scrollTop = this.list.scrollHeight
  }

  restore(events: TownEvent[]): void {
    this.list.innerHTML = ''
    for (const event of events.slice(-30)) this.add(event)
  }

  destroy(): void {
    this.container.remove()
  }

  private toggle(): void {
    this.collapsed = !this.collapsed
    this.container.classList.toggle('collapsed', this.collapsed)
  }

  private injectStyles(): void {
    if (document.getElementById('event-log-panel-style')) return
    const style = document.createElement('style')
    style.id = 'event-log-panel-style'
    style.textContent = `
      .event-log-panel {
        position: fixed;
        right: 12px;
        bottom: 96px;
        width: min(360px, calc(100vw - 24px));
        max-height: 30vh;
        z-index: 65;
        display: flex;
        flex-direction: column;
        background: rgba(18, 20, 30, 0.74);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: #fff;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        box-shadow: 0 6px 22px rgba(0,0,0,0.28);
        overflow: hidden;
      }
      .event-log-header {
        height: 30px;
        border: 0;
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.74);
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 10px;
        cursor: pointer;
        font: 700 12px system-ui, sans-serif;
      }
      .event-log-list {
        overflow-y: auto;
        min-height: 0;
        padding: 7px 10px 9px;
      }
      .event-log-row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 3px 0;
        font-size: 12px;
        line-height: 1.35;
      }
      .event-log-time {
        flex-shrink: 0;
        width: 34px;
        color: rgba(255,255,255,0.34);
        font-family: monospace;
        font-size: 10px;
        padding-top: 2px;
      }
      .event-log-text {
        min-width: 0;
        color: rgba(255,255,255,0.68);
        overflow-wrap: anywhere;
      }
      .event-log-panel.collapsed .event-log-list { display: none; }
      @media (max-width: 560px) {
        .event-log-panel { bottom: 84px; max-height: 24vh; }
      }
    `
    document.head.appendChild(style)
  }
}
