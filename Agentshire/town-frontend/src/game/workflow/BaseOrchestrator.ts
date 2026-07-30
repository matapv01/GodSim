// @desc Shared base class for workflow orchestrators: abort, delay, NPC arrival polling
import type { NPC } from '../../npc/NPC'

export abstract class BaseOrchestrator<TConfig> {
  protected aborted = false

  async execute(cfg: TConfig): Promise<void> {
    this.aborted = false
    await this.run(cfg)
  }

  abort(): void {
    this.aborted = true
  }

  protected shouldAbort(): boolean {
    return this.aborted
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  protected async waitNpcArrival(
    npcs: NPC[],
    targets: Array<{ x: number; z: number }>,
    opts: { threshold?: number; teleportMs?: number; forceMs?: number; pollMs?: number } = {},
  ): Promise<void> {
    const threshold = opts.threshold ?? 0.8
    const teleportMs = opts.teleportMs ?? 10_000
    const forceMs = opts.forceMs ?? 15_000
    const pollMs = opts.pollMs ?? 300

    const start = Date.now()
    const teleported = new Set<string>()

    const allArrived = () => npcs.every((npc, i) => {
      const t = targets[i] ?? targets[targets.length - 1]
      const pos = npc.getPosition()
      const dx = pos.x - t.x
      const dz = pos.z - t.z
      return dx * dx + dz * dz < threshold * threshold
    })

    while (!allArrived() && !this.aborted) {
      const elapsed = Date.now() - start
      if (elapsed > forceMs) break
      if (elapsed > teleportMs) {
        for (let i = 0; i < npcs.length; i++) {
          const npc = npcs[i]
          if (teleported.has(npc.id)) continue
          const t = targets[i] ?? targets[targets.length - 1]
          const pos = npc.getPosition()
          const dx = pos.x - t.x
          const dz = pos.z - t.z
          if (dx * dx + dz * dz >= threshold * threshold) {
            npc.mesh.position.set(t.x, 0, t.z)
            teleported.add(npc.id)
          }
        }
      }
      await this.delay(pollMs)
    }
  }

  protected abstract run(cfg: TConfig): Promise<void>
}
