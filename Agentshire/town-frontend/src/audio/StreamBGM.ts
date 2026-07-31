// @desc YouTube streaming BGM via official IFrame Player API (no local downloads)

import type { TimePeriod, SceneType } from '../types'

export type StreamTrack = 'day' | 'dusk' | 'night' | 'work'

const TRACK_ORDER: StreamTrack[] = ['day', 'dusk', 'night', 'work']
const API_TIMEOUT_MS = 8000
const STREAM_VOLUME = 22

function resolveTrack(period: TimePeriod, scene: SceneType): StreamTrack {
  if (scene === 'office') return 'work'
  if (period === 'night') return 'night'
  if (period === 'dusk' || period === 'dawn') return 'dusk'
  return 'day'
}

function extractVideoId(input: string): string {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  const m = raw.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1] : raw
}

interface StreamBgmOptions {
  onFallback?: () => void
}

export class StreamBGM {
  private playlist: Partial<Record<StreamTrack, string>> = {}
  private enabled = false
  private ready = false
  private player: any = null
  private currentTrack: StreamTrack | null = null
  private volume = STREAM_VOLUME
  private opts: StreamBgmOptions

  constructor(opts: StreamBgmOptions = {}) {
    this.opts = opts
  }

  isActive(): boolean {
    return this.ready && this.enabled
  }

  async init(): Promise<boolean> {
    const env = import.meta.env
    if (String(env.VITE_BGM_STREAM_ENABLED ?? '').trim() !== 'true') return false

    this.playlist = {
      day: extractVideoId(env.VITE_BGM_YOUTUBE_DAY),
      dusk: extractVideoId(env.VITE_BGM_YOUTUBE_DUSK),
      night: extractVideoId(env.VITE_BGM_YOUTUBE_NIGHT),
      work: extractVideoId(env.VITE_BGM_YOUTUBE_WORK),
    }
    const firstVideoId = TRACK_ORDER.map(t => this.playlist[t]).find(Boolean)
    if (!firstVideoId) return false

    this.enabled = true
    return this.bootPlayer(firstVideoId)
  }

  update(period: TimePeriod, scene: SceneType): void {
    if (!this.isActive() || !this.player) return
    const desired = resolveTrack(period, scene)
    if (desired === this.currentTrack) return
    this.currentTrack = desired

    const videoId = this.playlist[desired]
    if (!videoId) {
      this.player.pauseVideo()
      return
    }
    this.player.loadVideoById(videoId)
  }

  setEnabled(on: boolean): void {
    if (!this.player) return
    if (on) {
      if (this.ready) this.player.playVideo()
    } else {
      this.player.pauseVideo()
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v)) * 100
    if (this.player) this.player.setVolume(this.volume)
  }

  private bootPlayer(firstVideoId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const container = document.createElement('div')
      container.style.cssText =
        'position:fixed;left:-9999px;top:0;width:320px;height:180px;opacity:0.01;pointer-events:none;z-index:-10;'
      const host = document.createElement('div')
      host.id = 'stream-bgm-host'
      container.appendChild(host)
      document.body.appendChild(container)

      const timeout = window.setTimeout(() => {
        this.enabled = false
        this.opts.onFallback?.()
        resolve(false)
      }, API_TIMEOUT_MS)

      const createPlayer = (): void => {
        const YT = (window as any).YT
        if (!YT?.Player) {
          window.clearTimeout(timeout)
          this.enabled = false
          this.opts.onFallback?.()
          resolve(false)
          return
        }

        this.player = new YT.Player('stream-bgm-host', {
          width: '320',
          height: '180',
          videoId: firstVideoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              window.clearTimeout(timeout)
              this.ready = true
              this.player?.setVolume(this.volume)
              this.player?.playVideo()
              resolve(true)
            },
            onStateChange: (e: any) => {
              if (e?.data === 0 && this.ready) this.player?.playVideo()
            },
            onError: () => {
              this.ready = false
              this.enabled = false
              window.clearTimeout(timeout)
              this.opts.onFallback?.()
              resolve(false)
            },
          },
        })
      }

      if ((window as any).YT?.Player) {
        createPlayer()
        return
      }

      const prevHandler = (window as any).onYouTubeIframeAPIReady
      ;(window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevHandler === 'function') prevHandler()
        createPlayer()
      }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    })
  }
}
