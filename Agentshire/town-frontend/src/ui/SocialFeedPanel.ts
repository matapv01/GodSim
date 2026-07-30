import type { TownEvent } from '../npc/TownJournal'
import type { DialogueRecord, Relationship } from '../types'
import { createLucideIcon } from './LucideIcon'

export interface SocialNpcSnapshot {
  npcId: string
  name: string
  relationships: Relationship[]
  dialogues: DialogueRecord[]
}

type SocialTab = 'feed' | 'relations' | 'dialogs'

export class SocialFeedPanel {
  private root: HTMLElement
  private body: HTMLElement
  private toggleBtn: HTMLButtonElement
  private activeTab: SocialTab = 'feed'
  private getEvents: () => TownEvent[]
  private getNpcs: () => SocialNpcSnapshot[]

  constructor(opts: {
    getEvents: () => TownEvent[]
    getNpcs: () => SocialNpcSnapshot[]
  }) {
    this.getEvents = opts.getEvents
    this.getNpcs = opts.getNpcs
    this.injectStyles()

    this.toggleBtn = document.createElement('button')
    this.toggleBtn.className = 'social-feed-toggle'
    this.toggleBtn.title = 'Xã hội'
    const icon = createLucideIcon('heart-handshake', 17, 'currentColor') ?? createLucideIcon('message-circle', 17, 'currentColor')
    if (icon) this.toggleBtn.appendChild(icon)
    this.toggleBtn.addEventListener('click', () => this.toggle())
    document.body.appendChild(this.toggleBtn)

    this.root = document.createElement('section')
    this.root.className = 'social-feed-panel'
    this.root.style.display = 'none'

    const header = document.createElement('div')
    header.className = 'social-feed-header'
    const title = document.createElement('div')
    title.className = 'social-feed-title'
    title.textContent = 'Xã hội'
    header.appendChild(title)
    const close = document.createElement('button')
    close.className = 'social-feed-close'
    close.title = 'Đóng'
    const closeIcon = createLucideIcon('x', 15, 'currentColor')
    if (closeIcon) close.appendChild(closeIcon)
    close.addEventListener('click', () => this.hide())
    header.appendChild(close)
    this.root.appendChild(header)

    const tabs = document.createElement('div')
    tabs.className = 'social-feed-tabs'
    for (const [tab, label] of [
      ['feed', 'Feed'],
      ['relations', 'Quan hệ'],
      ['dialogs', 'Hội thoại'],
    ] as Array<[SocialTab, string]>) {
      const btn = document.createElement('button')
      btn.dataset.tab = tab
      btn.textContent = label
      btn.addEventListener('click', () => {
        this.activeTab = tab
        this.render()
      })
      tabs.appendChild(btn)
    }
    this.root.appendChild(tabs)

    this.body = document.createElement('div')
    this.body.className = 'social-feed-body'
    this.root.appendChild(this.body)
    document.body.appendChild(this.root)
  }

  refresh(): void {
    if (this.root.style.display !== 'none') this.render()
  }

  hide(): void {
    this.root.style.display = 'none'
  }

  destroy(): void {
    this.root.remove()
    this.toggleBtn.remove()
  }

  private toggle(): void {
    const next = this.root.style.display === 'none'
    this.root.style.display = next ? 'flex' : 'none'
    if (next) this.render()
  }

  private render(): void {
    this.root.querySelectorAll('.social-feed-tabs button').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.tab === this.activeTab)
    })
    this.body.innerHTML = ''
    if (this.activeTab === 'feed') this.renderFeed()
    else if (this.activeTab === 'relations') this.renderRelations()
    else this.renderDialogs()
  }

  private renderFeed(): void {
    const events = this.getEvents()
      .filter(e => e.type === 'encounter_end' || e.type === 'player_message' || e.type === 'reflection')
      .slice(-80)
      .reverse()
    if (events.length === 0) return this.renderEmpty('Chưa có chuyện xã hội nào đáng ghi.')
    for (const event of events) {
      const row = document.createElement('article')
      row.className = 'social-feed-item'
      row.appendChild(this.meta(`${event.gameTime} · ${event.actors.filter(Boolean).join(', ') || 'Thị trấn'}`))
      const text = document.createElement('div')
      text.className = 'social-feed-text'
      text.textContent = event.description
      row.appendChild(text)
      this.body.appendChild(row)
    }
  }

  private renderRelations(): void {
    const npcs = this.getNpcs()
    const rows = npcs
      .flatMap(npc => npc.relationships.map(rel => ({ owner: npc.name, rel })))
      .sort((a, b) => b.rel.lastInteraction - a.rel.lastInteraction)
      .slice(0, 80)
    if (rows.length === 0) return this.renderEmpty('Chưa đủ tương tác để tạo sổ quan hệ.')
    this.renderRelationGraph(npcs)
    for (const rowData of rows) {
      const row = document.createElement('article')
      row.className = 'social-feed-item social-relation-item'
      row.appendChild(this.meta(`${rowData.owner} → ${rowData.rel.name}`))
      const title = document.createElement('div')
      title.className = 'social-relation-title'
      title.textContent = rowData.rel.label
      row.appendChild(title)
      const bars = document.createElement('div')
      bars.className = 'social-relation-bars'
      for (const [label, value] of [
        ['Thân', rowData.rel.sentiment],
        ['Tin', rowData.rel.trust ?? 0],
        ['Tình', rowData.rel.romance ?? 0],
        ['Ghen', rowData.rel.jealousy ?? 0],
        ['Căng', rowData.rel.tension ?? 0],
      ] as Array<[string, number]>) {
        bars.appendChild(this.bar(label, value))
      }
      row.appendChild(bars)
      if (rowData.rel.recentTopics.length > 0) {
        const topics = document.createElement('div')
        topics.className = 'social-feed-topics'
        topics.textContent = rowData.rel.recentTopics.slice(-2).join(' · ')
        row.appendChild(topics)
      }
      this.body.appendChild(row)
    }
  }

  private renderRelationGraph(npcs: SocialNpcSnapshot[]): void {
    const nodeNames = Array.from(new Set([
      ...npcs.map(n => n.name),
      ...npcs.flatMap(n => n.relationships.map(r => r.name)),
    ].filter(Boolean))).slice(0, 12)
    if (nodeNames.length < 2) return

    const nodeIndex = new Map(nodeNames.map((name, i) => [name, i]))
    const edgeMap = new Map<string, { a: string; b: string; strength: number; romance: number; tension: number; count: number }>()
    for (const owner of npcs) {
      for (const rel of owner.relationships) {
        if (!nodeIndex.has(owner.name) || !nodeIndex.has(rel.name)) continue
        const a = owner.name < rel.name ? owner.name : rel.name
        const b = owner.name < rel.name ? rel.name : owner.name
        const key = `${a}::${b}`
        const prev = edgeMap.get(key)
        const strength = this.relationStrength(rel)
        const next = {
          a, b,
          strength: Math.max(prev?.strength ?? 0, strength),
          romance: Math.max(prev?.romance ?? 0, rel.romance ?? 0),
          tension: Math.max(prev?.tension ?? 0, rel.tension ?? 0, rel.jealousy ?? 0),
          count: (prev?.count ?? 0) + rel.interactionCount,
        }
        edgeMap.set(key, next)
      }
    }

    const graph = document.createElement('section')
    graph.className = 'social-relation-graph'
    const title = document.createElement('div')
    title.className = 'social-relation-graph-title'
    title.textContent = 'Bản đồ quan hệ'
    graph.appendChild(title)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 360 250')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Graph quan hệ giữa các cư dân')

    const cx = 180
    const cy = 126
    const rx = 132
    const ry = 82
    const positions = new Map<string, { x: number; y: number }>()
    nodeNames.forEach((name, i) => {
      const angle = -Math.PI / 2 + (i / nodeNames.length) * Math.PI * 2
      positions.set(name, { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry })
    })

    for (const edge of [...edgeMap.values()].sort((a, b) => a.strength - b.strength)) {
      const a = positions.get(edge.a)
      const b = positions.get(edge.b)
      if (!a || !b) continue
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(a.x))
      line.setAttribute('y1', String(a.y))
      line.setAttribute('x2', String(b.x))
      line.setAttribute('y2', String(b.y))
      line.setAttribute('class', edge.tension > 0.35 ? 'edge tense' : edge.romance > 0.35 ? 'edge romance' : 'edge')
      line.setAttribute('stroke-width', String(1 + Math.min(4, edge.strength * 4)))
      line.setAttribute('opacity', String(0.25 + Math.min(0.55, edge.strength * 0.55)))
      svg.appendChild(line)
    }

    for (const name of nodeNames) {
      const pos = positions.get(name)!
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      const degree = [...edgeMap.values()].filter(e => e.a === name || e.b === name).length
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', String(pos.x))
      circle.setAttribute('cy', String(pos.y))
      circle.setAttribute('r', String(12 + Math.min(7, degree * 1.8)))
      circle.setAttribute('class', 'node')
      group.appendChild(circle)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', String(pos.x))
      label.setAttribute('y', String(pos.y + 4))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('class', 'node-label')
      label.textContent = name.length > 9 ? `${name.slice(0, 8)}…` : name
      group.appendChild(label)
      svg.appendChild(group)
    }

    const legend = document.createElement('div')
    legend.className = 'social-relation-legend'
    legend.textContent = 'Dày: tương tác mạnh · Hồng: tình cảm · Vàng: căng thẳng/ghen'
    graph.appendChild(svg)
    graph.appendChild(legend)
    this.body.appendChild(graph)
  }

  private relationStrength(rel: Relationship): number {
    const sentiment = Math.max(0, (rel.sentiment + 1) / 2)
    const trust = Math.max(0, rel.trust ?? 0)
    const romance = Math.max(0, rel.romance ?? 0)
    const tension = Math.max(0, rel.tension ?? 0, rel.jealousy ?? 0)
    const count = Math.min(1, rel.interactionCount / 8)
    return Math.max(0.08, Math.min(1, count * 0.35 + sentiment * 0.25 + trust * 0.2 + romance * 0.15 + tension * 0.12))
  }

  private renderDialogs(): void {
    const dialogs = this.getNpcs()
      .flatMap(npc => npc.dialogues.map(dialogue => ({ owner: npc.name, dialogue })))
      .sort((a, b) => b.dialogue.timestamp - a.dialogue.timestamp)
      .slice(0, 60)
    if (dialogs.length === 0) return this.renderEmpty('Chưa có hội thoại nào.')
    for (const { owner, dialogue } of dialogs) {
      const row = document.createElement('article')
      row.className = 'social-feed-item'
      row.appendChild(this.meta(`${owner} với ${dialogue.partnerName} · ${dialogue.location}`))
      const title = document.createElement('div')
      title.className = 'social-relation-title'
      title.textContent = dialogue.summary
      row.appendChild(title)
      const text = document.createElement('div')
      text.className = 'social-feed-text'
      text.textContent = dialogue.turns.map(t => `${t.speaker}: ${t.text}`).join(' / ')
      row.appendChild(text)
      this.body.appendChild(row)
    }
  }

  private meta(text: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'social-feed-meta'
    el.textContent = text
    return el
  }

  private bar(label: string, value: number): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'social-relation-bar'
    const name = document.createElement('span')
    name.textContent = label
    const track = document.createElement('i')
    const fill = document.createElement('b')
    const normalized = label === 'Thân' ? (value + 1) / 2 : value
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`
    track.appendChild(fill)
    wrap.appendChild(name)
    wrap.appendChild(track)
    return wrap
  }

  private renderEmpty(text: string): void {
    const empty = document.createElement('div')
    empty.className = 'social-feed-empty'
    empty.textContent = text
    this.body.appendChild(empty)
  }

  private injectStyles(): void {
    if (document.getElementById('social-feed-panel-style')) return
    const style = document.createElement('style')
    style.id = 'social-feed-panel-style'
    style.textContent = `
      .social-feed-toggle {
        position: fixed;
        right: 12px;
        bottom: 54px;
        z-index: 66;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        background: rgba(22,24,34,0.82);
        color: rgba(255,255,255,0.82);
        display: grid;
        place-items: center;
        cursor: pointer;
        backdrop-filter: blur(6px);
      }
      .social-feed-panel {
        position: fixed;
        right: 12px;
        top: 72px;
        bottom: 96px;
        width: min(420px, calc(100vw - 24px));
        z-index: 67;
        flex-direction: column;
        background: rgba(18,20,30,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #fff;
        box-shadow: 0 12px 40px rgba(0,0,0,0.34);
        overflow: hidden;
        backdrop-filter: blur(8px);
      }
      .social-feed-header {
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px 0 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .social-feed-title { font: 800 13px system-ui, sans-serif; }
      .social-feed-close {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: rgba(255,255,255,0.62);
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .social-feed-tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .social-feed-tabs button {
        height: 34px;
        border: 0;
        background: rgba(255,255,255,0.03);
        color: rgba(255,255,255,0.58);
        font: 700 12px system-ui, sans-serif;
        cursor: pointer;
      }
      .social-feed-tabs button.active {
        color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.09);
      }
      .social-feed-body {
        overflow-y: auto;
        padding: 10px;
      }
      .social-feed-item {
        border-bottom: 1px solid rgba(255,255,255,0.07);
        padding: 9px 0;
      }
      .social-feed-meta {
        color: rgba(255,255,255,0.38);
        font: 700 10px system-ui, sans-serif;
        margin-bottom: 4px;
      }
      .social-feed-text {
        color: rgba(255,255,255,0.74);
        font: 12px/1.45 system-ui, sans-serif;
        overflow-wrap: anywhere;
      }
      .social-relation-title {
        color: rgba(255,255,255,0.86);
        font: 800 13px system-ui, sans-serif;
        margin-bottom: 7px;
      }
      .social-relation-bars {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 6px;
      }
      .social-relation-bar span {
        display: block;
        color: rgba(255,255,255,0.44);
        font-size: 10px;
        margin-bottom: 3px;
      }
      .social-relation-bar i {
        display: block;
        height: 5px;
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
        overflow: hidden;
      }
      .social-relation-bar b {
        display: block;
        height: 100%;
        background: rgba(236, 120, 150, 0.86);
      }
      .social-feed-topics {
        margin-top: 7px;
        color: rgba(255,255,255,0.48);
        font-size: 11px;
        line-height: 1.35;
      }
      .social-feed-empty {
        color: rgba(255,255,255,0.48);
        padding: 22px 4px;
        font: 12px system-ui, sans-serif;
      }
      .social-relation-graph {
        padding: 8px 0 12px;
        border-bottom: 1px solid rgba(255,255,255,0.09);
        margin-bottom: 6px;
      }
      .social-relation-graph-title {
        color: rgba(255,255,255,0.86);
        font: 800 12px system-ui, sans-serif;
        margin: 0 0 6px;
      }
      .social-relation-graph svg {
        display: block;
        width: 100%;
        height: auto;
        max-height: 250px;
      }
      .social-relation-graph .edge {
        stroke: rgba(130, 190, 255, 0.72);
        stroke-linecap: round;
      }
      .social-relation-graph .edge.romance {
        stroke: rgba(236, 120, 150, 0.82);
      }
      .social-relation-graph .edge.tense {
        stroke: rgba(245, 190, 90, 0.86);
      }
      .social-relation-graph .node {
        fill: rgba(30, 34, 48, 0.96);
        stroke: rgba(255,255,255,0.34);
        stroke-width: 1.2;
      }
      .social-relation-graph .node-label {
        fill: rgba(255,255,255,0.88);
        font: 700 10px system-ui, sans-serif;
        pointer-events: none;
      }
      .social-relation-legend {
        color: rgba(255,255,255,0.45);
        font: 11px/1.35 system-ui, sans-serif;
        margin-top: 4px;
      }
      @media (max-width: 560px) {
        .social-feed-panel { top: 64px; bottom: 84px; }
        .social-relation-graph svg { max-height: 220px; }
      }
    `
    document.head.appendChild(style)
  }
}
