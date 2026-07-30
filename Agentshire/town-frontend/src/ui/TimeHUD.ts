import type { GameClock } from '../game/GameClock'
import type { TimePeriod, WeatherType } from '../types'
import { createLucideIcon } from './LucideIcon'
import { t } from '../i18n'

function getPeriodLabel(period: TimePeriod): string {
  return t(`period.${period}`)
}

function getWeatherLabel(weather: WeatherType): string {
  return t(`weather.${weather}`)
}

const WEATHER_ICON_CONFIG: Record<WeatherType, { icon: string; iconColor: string }> = {
  clear:     { icon: 'sun',             iconColor: '#FFE082' },
  cloudy:    { icon: 'cloud',           iconColor: '#B0BEC5' },
  drizzle:   { icon: 'cloud-drizzle',   iconColor: '#90B4C8' },
  rain:      { icon: 'cloud-rain',      iconColor: '#80B8D0' },
  heavyRain: { icon: 'cloud-rain',      iconColor: '#5A9AB5' },
  storm:     { icon: 'cloud-lightning',  iconColor: '#7B68EE' },
  lightSnow: { icon: 'cloud-snow',      iconColor: '#CFD8DC' },
  snow:      { icon: 'cloud-snow',      iconColor: '#B0C4DE' },
  blizzard:  { icon: 'cloud-snow',      iconColor: '#9FB8CC' },
  fog:       { icon: 'cloud-fog',       iconColor: '#A0A8B0' },
  sandstorm: { icon: 'wind',            iconColor: '#C4A060' },
  aurora:    { icon: 'sparkles',        iconColor: '#88DDAA' },
}

type AnimClassRule = { childIndex: number; className: string }[]

interface TimeHUDOptions {
  onPauseToggle?: () => boolean
  onSpeedChange?: (speed: 1 | 5 | 20) => void
}

const WEATHER_ANIM_CLASSES: Partial<Record<WeatherType, AnimClassRule>> = {
  clear:     [
    { childIndex: 0, className: 'th-sun-core' },
    ...([1,2,3,4,5,6,7,8].map(i => ({ childIndex: i, className: 'th-sun-ray' }))),
  ],
  cloudy:    [{ childIndex: 0, className: 'th-cloud-drift' }],
  drizzle:   [
    { childIndex: 0, className: 'th-cloud-body' },
    ...([1,2,3,4,5,6].map(i => ({ childIndex: i, className: 'th-drizzle-drop' }))),
  ],
  rain:      [
    { childIndex: 0, className: 'th-cloud-body' },
    ...([1,2,3].map(i => ({ childIndex: i, className: 'th-rain-drop' }))),
  ],
  heavyRain: [
    { childIndex: 0, className: 'th-cloud-shake' },
    ...([1,2,3].map(i => ({ childIndex: i, className: 'th-heavy-rain-drop' }))),
  ],
  storm:     [
    { childIndex: 0, className: 'th-cloud-body' },
    { childIndex: 1, className: 'th-lightning' },
  ],
  lightSnow: [
    { childIndex: 0, className: 'th-cloud-body' },
    ...([1,2,3,4,5,6].map(i => ({ childIndex: i, className: 'th-lightsnow-dot' }))),
  ],
  snow:      [
    { childIndex: 0, className: 'th-cloud-body' },
    ...([1,2,3,4,5,6].map(i => ({ childIndex: i, className: 'th-snow-dot' }))),
  ],
  blizzard:  [
    { childIndex: 0, className: 'th-cloud-shake' },
    ...([1,2,3,4,5,6].map(i => ({ childIndex: i, className: 'th-blizzard-dot' }))),
  ],
  fog:       [
    { childIndex: 0, className: 'th-cloud-body' },
    { childIndex: 1, className: 'th-fog-a' },
    { childIndex: 2, className: 'th-fog-b' },
  ],
  sandstorm: [
    { childIndex: 0, className: 'th-wind-1' },
    { childIndex: 1, className: 'th-wind-2' },
    { childIndex: 2, className: 'th-wind-3' },
  ],
  aurora:    [
    { childIndex: 0, className: 'th-aurora-star' },
    { childIndex: 1, className: 'th-aurora-cross-a' },
    { childIndex: 2, className: 'th-aurora-cross-b' },
    { childIndex: 3, className: 'th-aurora-star' },
  ],
}

export class TimeHUD {
  private container: HTMLElement
  private infoGroup: HTMLDivElement
  private controlsGroup: HTMLDivElement
  private pauseButton: HTMLButtonElement
  private speedButtons = new Map<1 | 5 | 20, HTMLButtonElement>()
  private weatherWrap: HTMLSpanElement
  private weatherLabel: HTMLSpanElement
  private dotEl: HTMLSpanElement
  private timeEl: HTMLSpanElement
  private periodEl: HTMLSpanElement
  private lastPeriod: TimePeriod | null = null
  private lastMinute = -1
  private lastWeather: WeatherType | null = null
  private visible = true
  private compact = false
  private paused = false
  private activeSpeed: 1 | 5 | 20 = 1

  constructor(private opts: TimeHUDOptions = {}) {
    this.injectStyles()

    this.container = document.createElement('div')
    this.container.className = 'time-hud'
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      background: 'linear-gradient(180deg, rgba(30,35,60,0.72) 0%, rgba(15,18,35,0.68) 100%)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      borderRadius: '22px',
      padding: '7px 10px',
      color: '#fff',
      fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      pointerEvents: 'auto',
      userSelect: 'none',
      zIndex: '999',
      transition: 'opacity 0.3s',
      opacity: '1',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
    })

    this.infoGroup = document.createElement('div')
    Object.assign(this.infoGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      pointerEvents: 'none',
    })

    this.controlsGroup = document.createElement('div')
    Object.assign(this.controlsGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
    })

    this.weatherWrap = document.createElement('span')
    Object.assign(this.weatherWrap.style, {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
    })

    this.weatherLabel = document.createElement('span')
    Object.assign(this.weatherLabel.style, { fontSize: '13px' })

    this.dotEl = document.createElement('span')
    Object.assign(this.dotEl.style, {
      width: '3px',
      height: '3px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.3)',
      flexShrink: '0',
    })

    this.timeEl = document.createElement('span')
    this.timeEl.style.fontVariantNumeric = 'tabular-nums'

    this.periodEl = document.createElement('span')
    Object.assign(this.periodEl.style, {
      opacity: '0.65',
      fontSize: '12px',
    })

    this.infoGroup.appendChild(this.weatherWrap)
    this.infoGroup.appendChild(this.weatherLabel)
    this.infoGroup.appendChild(this.dotEl)
    this.infoGroup.appendChild(this.timeEl)
    this.infoGroup.appendChild(this.periodEl)

    this.pauseButton = this.createIconButton('pause', t('time.pause'))
    this.pauseButton.addEventListener('click', () => {
      this.paused = this.opts.onPauseToggle?.() ?? !this.paused
      this.renderPauseButton()
    })
    this.controlsGroup.appendChild(this.pauseButton)

    for (const speed of [1, 5, 20] as const) {
      const btn = this.createSpeedButton(speed)
      btn.addEventListener('click', () => {
        this.activeSpeed = speed
        this.opts.onSpeedChange?.(speed)
        this.renderSpeedButtons()
      })
      this.speedButtons.set(speed, btn)
      this.controlsGroup.appendChild(btn)
    }

    this.container.appendChild(this.infoGroup)
    this.container.appendChild(this.controlsGroup)

    document.body.appendChild(this.container)
    this.renderPauseButton()
    this.renderSpeedButtons()
  }

  update(gameClock: GameClock, weather?: WeatherType): void {
    if (!this.visible) return

    const state = gameClock.getState()

    if (state.minute !== this.lastMinute) {
      this.lastMinute = state.minute
      this.timeEl.textContent = gameClock.getFormattedTime()
    }

    if (state.period !== this.lastPeriod) {
      this.lastPeriod = state.period
      this.periodEl.textContent = getPeriodLabel(state.period)
    }

    const w = weather ?? 'clear'
    if (w !== this.lastWeather) {
      this.lastWeather = w
      const wcfg = WEATHER_ICON_CONFIG[w]

      this.weatherWrap.innerHTML = ''
      const wSvg = createLucideIcon(wcfg.icon, 14, wcfg.iconColor)
      if (wSvg) {
        this.applyWeatherAnim(wSvg, w)
        this.weatherWrap.appendChild(wSvg)
      }

      this.weatherLabel.textContent = getWeatherLabel(w)
    }
  }

  private applyWeatherAnim(svg: SVGSVGElement, weather: WeatherType): void {
    const rules = WEATHER_ANIM_CLASSES[weather]
    if (!rules) return
    const children = Array.from(svg.children)

    if (weather === 'clear') {
      const rayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      rayGroup.classList.add('th-sun-ray')
      if (children[0]) children[0].classList.add('th-sun-core')
      for (let i = children.length - 1; i >= 1; i--) {
        rayGroup.insertBefore(children[i], rayGroup.firstChild)
      }
      svg.appendChild(rayGroup)
      return
    }

    if (weather === 'storm' && children[1]) {
      children[1].setAttribute('stroke', '#FBBF24')
    }

    for (const rule of rules) {
      const el = children[rule.childIndex]
      if (el) el.classList.add(rule.className)
    }
  }

  setCompact(compact: boolean): void {
    this.compact = compact
    this.periodEl.style.display = compact ? 'none' : 'inline'
    this.weatherLabel.style.display = compact ? 'none' : 'inline'
    this.container.style.padding = compact ? '7px 8px' : '7px 10px'
    this.container.style.gap = compact ? '7px' : '10px'
  }

  show(): void {
    this.visible = true
    this.container.style.opacity = '1'
  }

  hide(): void {
    this.visible = false
    this.container.style.opacity = '0'
  }

  destroy(): void {
    this.container.remove()
  }

  private injectStyles(): void {
    if (document.getElementById('time-hud-style')) return
    const style = document.createElement('style')
    style.id = 'time-hud-style'
    style.textContent = `
      /* === clear: sun === */
      .th-sun-ray { transform-origin: 12px 12px; animation: th-sun-rotate 8s linear infinite; }
      .th-sun-core { animation: th-sun-pulse 3s ease-in-out infinite; }
      @keyframes th-sun-rotate { to { transform: rotate(360deg); } }
      @keyframes th-sun-pulse { 0%,100%{opacity:.9} 50%{opacity:1} }

      /* === cloudy === */
      .th-cloud-drift { animation: th-cloud-drift 4s ease-in-out infinite; }
      @keyframes th-cloud-drift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(1.5px)} }

      /* === drizzle === */
      .th-drizzle-drop { animation: th-drizzle-fall 1.4s ease-in infinite; }
      .th-drizzle-drop:nth-child(2){animation-delay:0s}
      .th-drizzle-drop:nth-child(3){animation-delay:.25s}
      .th-drizzle-drop:nth-child(4){animation-delay:.5s}
      .th-drizzle-drop:nth-child(5){animation-delay:.15s}
      .th-drizzle-drop:nth-child(6){animation-delay:.4s}
      .th-drizzle-drop:nth-child(7){animation-delay:.65s}
      @keyframes th-drizzle-fall { 0%{transform:translateY(0);opacity:1} 70%{transform:translateY(2.5px);opacity:.6} 100%{transform:translateY(3px);opacity:0} }

      /* === rain === */
      .th-rain-drop { animation: th-rain-fall .8s ease-in infinite; }
      .th-rain-drop:nth-child(2){animation-delay:0s}
      .th-rain-drop:nth-child(3){animation-delay:.3s}
      .th-rain-drop:nth-child(4){animation-delay:.15s}
      @keyframes th-rain-fall { 0%{transform:translateY(0);opacity:1} 80%{transform:translateY(3px);opacity:.5} 100%{transform:translateY(4px);opacity:0} }

      /* === heavyRain === */
      .th-cloud-shake { animation: th-cloud-shake .3s ease-in-out infinite; }
      .th-heavy-rain-drop { animation: th-heavy-rain-fall .5s ease-in infinite; }
      .th-heavy-rain-drop:nth-child(2){animation-delay:0s}
      .th-heavy-rain-drop:nth-child(3){animation-delay:.2s}
      .th-heavy-rain-drop:nth-child(4){animation-delay:.1s}
      @keyframes th-cloud-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-.8px)} 75%{transform:translateX(.8px)} }
      @keyframes th-heavy-rain-fall { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(4px);opacity:0} }

      /* === storm === */
      .th-lightning { animation: th-lightning-flash 3s ease-in-out infinite; }
      @keyframes th-lightning-flash {
        0%,100%{opacity:.1;filter:drop-shadow(0 0 0 transparent)}
        8%{opacity:1;filter:drop-shadow(0 0 3px rgba(251,191,36,.7))}
        12%{opacity:.15;filter:drop-shadow(0 0 0 transparent)}
        15%{opacity:1;filter:drop-shadow(0 0 4px rgba(251,191,36,.8))}
        22%{opacity:.1;filter:drop-shadow(0 0 0 transparent)}
      }

      /* === lightSnow === */
      .th-lightsnow-dot { animation: th-snow-fall-light 2.5s ease-in-out infinite; }
      .th-lightsnow-dot:nth-child(2){animation-delay:0s}
      .th-lightsnow-dot:nth-child(3){animation-delay:.4s}
      .th-lightsnow-dot:nth-child(4){animation-delay:.8s}
      .th-lightsnow-dot:nth-child(5){animation-delay:.2s}
      .th-lightsnow-dot:nth-child(6){animation-delay:.6s}
      .th-lightsnow-dot:nth-child(7){animation-delay:1s}
      @keyframes th-snow-fall-light { 0%{transform:translate(0,0);opacity:1} 50%{transform:translate(1px,2px);opacity:.7} 100%{transform:translate(-.5px,3.5px);opacity:0} }

      /* === snow === */
      .th-snow-dot { animation: th-snow-fall 1.8s ease-in-out infinite; }
      .th-snow-dot:nth-child(2){animation-delay:0s}
      .th-snow-dot:nth-child(3){animation-delay:.3s}
      .th-snow-dot:nth-child(4){animation-delay:.6s}
      .th-snow-dot:nth-child(5){animation-delay:.15s}
      .th-snow-dot:nth-child(6){animation-delay:.45s}
      .th-snow-dot:nth-child(7){animation-delay:.75s}
      @keyframes th-snow-fall { 0%{transform:translate(0,0);opacity:1} 50%{transform:translate(1.5px,2.5px);opacity:.6} 100%{transform:translate(-1px,4px);opacity:0} }

      /* === blizzard === */
      .th-blizzard-dot { animation: th-blizzard-fall .9s ease-in infinite; }
      .th-blizzard-dot:nth-child(2){animation-delay:0s}
      .th-blizzard-dot:nth-child(3){animation-delay:.15s}
      .th-blizzard-dot:nth-child(4){animation-delay:.3s}
      .th-blizzard-dot:nth-child(5){animation-delay:.08s}
      .th-blizzard-dot:nth-child(6){animation-delay:.22s}
      .th-blizzard-dot:nth-child(7){animation-delay:.38s}
      @keyframes th-blizzard-fall { 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(3px,4px);opacity:0} }

      /* === fog === */
      .th-fog-a { animation: th-fog-drift-a 3.5s ease-in-out infinite; }
      .th-fog-b { animation: th-fog-drift-b 4s ease-in-out infinite; }
      @keyframes th-fog-drift-a { 0%,100%{transform:translateX(0);opacity:.8} 50%{transform:translateX(2px);opacity:.35} }
      @keyframes th-fog-drift-b { 0%,100%{transform:translateX(0);opacity:.6} 50%{transform:translateX(-2px);opacity:.9} }

      /* === sandstorm === */
      .th-wind-1 { animation: th-wind-blow 1.2s ease-in-out infinite; }
      .th-wind-2 { animation: th-wind-blow 1s ease-in-out .2s infinite; }
      .th-wind-3 { animation: th-wind-blow 1.4s ease-in-out .4s infinite; }
      @keyframes th-wind-blow { 0%{transform:translateX(0);opacity:1} 60%{transform:translateX(3px);opacity:.5} 100%{transform:translateX(4px);opacity:0} }

      /* === aurora === */
      .th-aurora-star { animation: th-aurora-color 4s ease-in-out infinite; }
      .th-aurora-cross-a, .th-aurora-cross-b { animation: th-aurora-color 4s ease-in-out 1s infinite; }
      @keyframes th-aurora-color { 0%,100%{stroke:#88DDAA} 33%{stroke:#AADDFF} 66%{stroke:#CC88FF} }

      @media (prefers-reduced-motion: reduce) {
        .th-sun-ray,.th-sun-core,.th-cloud-drift,.th-drizzle-drop,.th-rain-drop,
        .th-cloud-shake,.th-heavy-rain-drop,.th-lightning,.th-lightsnow-dot,
        .th-snow-dot,.th-blizzard-dot,.th-fog-a,.th-fog-b,.th-wind-1,.th-wind-2,
        .th-wind-3,.th-aurora-star,.th-aurora-cross-a,.th-aurora-cross-b { animation: none !important; }
      }
    `
    document.head.appendChild(style)
  }

  private createIconButton(iconName: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = title
    Object.assign(btn.style, {
      width: '26px',
      height: '24px',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '7px',
      background: 'rgba(255,255,255,0.08)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: '0',
    })
    const icon = createLucideIcon(iconName, 14, '#fff')
    if (icon) btn.appendChild(icon)
    return btn
  }

  private createSpeedButton(speed: 1 | 5 | 20): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = t('time.speed', { speed: String(speed) })
    btn.textContent = `${speed}x`
    Object.assign(btn.style, {
      minWidth: speed === 20 ? '34px' : '28px',
      height: '24px',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '7px',
      background: 'rgba(255,255,255,0.08)',
      color: '#fff',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      padding: '0 6px',
    })
    return btn
  }

  private renderPauseButton(): void {
    this.pauseButton.title = this.paused ? t('time.resume') : t('time.pause')
    this.pauseButton.innerHTML = ''
    const icon = createLucideIcon(this.paused ? 'play' : 'pause', 14, '#fff')
    if (icon) this.pauseButton.appendChild(icon)
    this.pauseButton.style.background = this.paused ? 'rgba(212,165,116,0.72)' : 'rgba(255,255,255,0.08)'
  }

  private renderSpeedButtons(): void {
    for (const [speed, btn] of this.speedButtons) {
      const active = speed === this.activeSpeed
      btn.style.background = active ? 'rgba(212,165,116,0.72)' : 'rgba(255,255,255,0.08)'
      btn.style.color = active ? '#111' : '#fff'
    }
  }
}
