// @desc Game publish overlay — cover rendering, play/later buttons, iframe launch

import { renderCover, pickStyleForGame, type CoverStyleId } from './CoverTemplates'

export type PlayNowCallback = (gameUrl: string) => void

/**
 * Manages the game-publish overlay that appears when a game deliverable
 * is ready: renders a cover image and offers "Play Now" / "Later" actions.
 */
export class GamePublishPanel {
  private onPlayNow: PlayNowCallback | null = null

  constructor(onPlayNow: PlayNowCallback) {
    this.onPlayNow = onPlayNow
  }

  show(opts: {
    gameName: string; styleId?: CoverStyleId; iframeSrc: string; onClose?: () => void
  }): void {
    const overlay = document.getElementById('game-publish-overlay')!
    const coverContainer = document.getElementById('gp-cover-container')!
    const playBtn = document.getElementById('gp-play-btn')!
    const laterBtn = document.getElementById('gp-later-btn')!

    const style = opts.styleId || pickStyleForGame(opts.gameName)
    coverContainer.innerHTML = renderCover(style, opts.gameName)
    overlay.classList.add('visible')

    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      overlay.classList.remove('visible')
      opts.onClose?.()
    }

    playBtn.onclick = () => {
      if (opts.iframeSrc) {
        this.onPlayNow?.(opts.iframeSrc)
        close()
      } else {
        close()
      }
    }
    laterBtn.onclick = close
  }

  hide(): void {
    document.getElementById('game-publish-overlay')?.classList.remove('visible')
  }
}
