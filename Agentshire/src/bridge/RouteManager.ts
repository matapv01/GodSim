// @desc A* pathfinding, NPC movement requests with ack/timeout, and destination claim management
import type { GameEvent } from '../../town-frontend/src/data/GameProtocol.js'
import { CITIZEN_DESTINATION_POINTS, ROUTE_GRAPHS, type RouteNode, type RouteSceneId } from './data/route-config.js'

export const CITIZEN_SPAWN_ORIGIN = { x: 20, z: 24 }
export const PLAZA_CENTER = { x: 18, z: 13 }
export const LEAVE_PLAZA_MIN_DISTANCE = 6.2
export const GREET_RING_RADIUS = 2.2
export const STEWARD_FACE_POS = { x: 17, z: 15.8 }

/** Manages NPC navigation: A* route planning on the town/office graph, move-and-wait with timeout, and destination slot allocation to prevent overcrowding */
export class RouteManager {
  moveRequestSeq = 0
  pendingMoveRequests = new Map<
    string,
    {
      npcId: string
      resolve: (status: 'arrived' | 'interrupted') => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  destinationClaimCount = new Map<string, number>()
  npcDestinationClaim = new Map<string, string>()
  npcLastDestination = new Map<string, string>()

  private emitFn: (events: GameEvent[]) => void

  constructor(emitFn: (events: GameEvent[]) => void) {
    this.emitFn = emitFn
  }

  nextMoveRequestId(npcId: string): string {
    this.moveRequestSeq += 1
    return `${npcId}-move-${this.moveRequestSeq}`
  }

  /** Called by DirectorBridge when frontend reports NPC arrival or interruption */
  resolveMoveRequest(requestId: string, npcId: string, status: 'arrived' | 'interrupted'): void {
    if (!requestId) return
    const pending = this.pendingMoveRequests.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingMoveRequests.delete(requestId)
    if (pending.npcId !== npcId) {
      console.warn(`[RouteManager][MoveAck] requestId=${requestId} npc mismatch expected=${pending.npcId} actual=${npcId}`)
    }
    pending.resolve(status)
  }

  /** Emit a move command and return a promise that resolves when the frontend acks arrival or timeout expires */
  moveNpcAndWait(
    npcId: string,
    target: { x: number; y: number; z: number },
    speed: number,
    timeoutMs = 25000,
  ): Promise<'arrived' | 'interrupted'> {
    const requestId = this.nextMoveRequestId(npcId)
    return new Promise<'arrived' | 'interrupted'>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingMoveRequests.delete(requestId)
        console.warn(`[RouteManager][MoveAck] timeout npc=${npcId} requestId=${requestId}`)
        resolve('interrupted')
      }, timeoutMs)

      this.pendingMoveRequests.set(requestId, { npcId, resolve, timer })
      this.emitFn([{ type: 'npc_move_to', npcId, target, speed, requestId }])
    })
  }

  distance2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
    const dx = a.x - b.x
    const dz = a.z - b.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  /** Calculate a position on the greeting ring around the steward for the Nth citizen */
  getGreetPoint(idx: number): { x: number; z: number } {
    const angle = (idx * 1.37) % (Math.PI * 2)
    const r = GREET_RING_RADIUS + (Math.random() - 0.5) * 0.45
    return {
      x: STEWARD_FACE_POS.x + Math.cos(angle) * r,
      z: STEWARD_FACE_POS.z + Math.sin(angle) * r,
    }
  }

  computeLeavePlazaPoint(from: { x: number; z: number }): { x: number; z: number } {
    let dx = from.x - PLAZA_CENTER.x
    let dz = from.z - PLAZA_CENTER.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.0001) {
      const angle = Math.random() * Math.PI * 2
      dx = Math.cos(angle)
      dz = Math.sin(angle)
    } else {
      dx /= len
      dz /= len
    }
    const targetDist = LEAVE_PLAZA_MIN_DISTANCE + 0.7 + Math.random() * 1.8
    return {
      x: PLAZA_CENTER.x + dx * targetDist,
      z: PLAZA_CENTER.z + dz * targetDist,
    }
  }

  /** Register that an NPC has claimed a destination slot */
  claimDestinationForNpc(npcId: string, destinationId: string): void {
    const prev = this.npcDestinationClaim.get(npcId)
    if (prev === destinationId) return
    if (prev) {
      const prevCount = this.destinationClaimCount.get(prev) ?? 0
      if (prevCount <= 1) this.destinationClaimCount.delete(prev)
      else this.destinationClaimCount.set(prev, prevCount - 1)
    }
    this.npcDestinationClaim.set(npcId, destinationId)
    this.destinationClaimCount.set(destinationId, (this.destinationClaimCount.get(destinationId) ?? 0) + 1)
    this.npcLastDestination.set(npcId, destinationId)
  }

  /** Release a previously claimed destination slot */
  releaseDestinationClaim(npcId: string, destinationId: string): void {
    const current = this.npcDestinationClaim.get(npcId)
    if (current !== destinationId) return
    this.npcDestinationClaim.delete(npcId)
    const count = this.destinationClaimCount.get(destinationId) ?? 0
    if (count <= 1) this.destinationClaimCount.delete(destinationId)
    else this.destinationClaimCount.set(destinationId, count - 1)
  }

  releaseDestinationClaimLater(npcId: string, destinationId: string, delayMs: number): void {
    setTimeout(() => {
      this.releaseDestinationClaim(npcId, destinationId)
    }, delayMs)
  }

  /** Score and select the best destination point for a citizen, avoiding recently visited or overcrowded spots */
  chooseCitizenDestination(npcId: string, from: { x: number; z: number }): { id: string; x: number; z: number; score: number } {
    const last = this.npcLastDestination.get(npcId)
    let best: { id: string; x: number; z: number; score: number } | null = null
    const candidates = CITIZEN_DESTINATION_POINTS.filter((d) => {
      const plazaDistance = this.distance2D({ x: d.x, z: d.z }, PLAZA_CENTER)
      if (plazaDistance < LEAVE_PLAZA_MIN_DISTANCE) return false
      return (this.destinationClaimCount.get(d.id) ?? 0) === 0
    })
    const pool = candidates.length > 0 ? candidates : CITIZEN_DESTINATION_POINTS

    for (const d of pool) {
      const plazaDistance = this.distance2D({ x: d.x, z: d.z }, PLAZA_CENTER)
      if (plazaDistance < LEAVE_PLAZA_MIN_DISTANCE) continue
      const distFromCurrent = this.distance2D(from, { x: d.x, z: d.z })
      const claimCount = this.destinationClaimCount.get(d.id) ?? 0
      const sameAsLastPenalty = d.id === last ? 8 : 0
      const claimPenalty = claimCount * 6
      const randomBonus = Math.random() * 2.5
      const score = randomBonus - distFromCurrent * 0.42 - claimPenalty - sameAsLastPenalty
      if (!best || score > best.score) {
        best = { id: d.id, x: d.x, z: d.z, score }
      }
    }

    if (best) return best
    const fallback = CITIZEN_DESTINATION_POINTS[Math.floor(Math.random() * CITIZEN_DESTINATION_POINTS.length)]
    return { id: fallback.id, x: fallback.x, z: fallback.z, score: -999 }
  }

  getRouteGraph(scene: RouteSceneId): Record<string, RouteNode> {
    return ROUTE_GRAPHS[scene] ?? ROUTE_GRAPHS.town
  }

  inferRouteScene(from: { x: number; z: number }, to: { x: number; z: number }): RouteSceneId {
    if (from.z <= 8.5 && to.z <= 8.5) return 'office'
    return 'town'
  }

  isRouteDebugEnabled(): boolean {
    try {
      const g = globalThis as unknown as { location?: { search?: string }; localStorage?: { getItem?: (key: string) => string | null } }
      const search = typeof g.location?.search === 'string'
        ? new URLSearchParams(g.location.search)
        : null
      if (search?.get('routeDebug') === '1') return true
      const local = g.localStorage?.getItem?.('agentshire_route_debug')
      return local === '1' || local === 'true'
    } catch {
      return false
    }
  }

  getNearestRouteNodeId(pos: { x: number; z: number }, scene: RouteSceneId): string {
    const graph = this.getRouteGraph(scene)
    const fallbackId = Object.keys(graph)[0] ?? 'plaza_c'
    let bestId = fallbackId
    let bestDist = Number.POSITIVE_INFINITY
    for (const [id, node] of Object.entries(graph)) {
      const d = this.distance2D(pos, node)
      if (d < bestDist) {
        bestDist = d
        bestId = id
      }
    }
    return bestId
  }

  planRouteNodePath(startId: string, endId: string, scene: RouteSceneId): string[] {
    const graph = this.getRouteGraph(scene)
    if (startId === endId) return [startId]
    const open = new Set<string>([startId])
    const cameFrom = new Map<string, string>()
    const gScore = new Map<string, number>()
    const fScore = new Map<string, number>()

    const heuristic = (a: string, b: string): number =>
      this.distance2D(graph[a], graph[b])

    gScore.set(startId, 0)
    fScore.set(startId, heuristic(startId, endId))

    while (open.size > 0) {
      let current: string | null = null
      let bestF = Number.POSITIVE_INFINITY
      for (const id of open) {
        const f = fScore.get(id) ?? Number.POSITIVE_INFINITY
        if (f < bestF) {
          bestF = f
          current = id
        }
      }
      if (!current) break
      if (current === endId) {
        const path: string[] = [current]
        while (cameFrom.has(current)) {
          current = cameFrom.get(current)!
          path.push(current)
        }
        path.reverse()
        return path
      }
      open.delete(current)
      const node = graph[current]
      for (const neighbor of node.neighbors) {
        const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY)
          + this.distance2D(node, graph[neighbor])
        if (tentative < (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
          cameFrom.set(neighbor, current)
          gScore.set(neighbor, tentative)
          fScore.set(neighbor, tentative + heuristic(neighbor, endId))
          open.add(neighbor)
        }
      }
    }

    return [startId, endId]
  }

  /** Plan a multi-waypoint route through the graph from source to destination */
  planSceneRoute(scene: RouteSceneId, from: { x: number; z: number }, to: { x: number; z: number }): Array<{ x: number; z: number }> {
    const graph = this.getRouteGraph(scene)
    const start = this.getNearestRouteNodeId(from, scene)
    const end = this.getNearestRouteNodeId(to, scene)
    const nodePath = this.planRouteNodePath(start, end, scene)
    const points: Array<{ x: number; z: number }> = []

    for (const [idx, id] of nodePath.entries()) {
      if (idx === 0 && this.distance2D(from, graph[id]) < 1.2) continue
      if (idx === nodePath.length - 1 && this.distance2D(to, graph[id]) < 1.2) continue
      points.push({ x: graph[id].x, z: graph[id].z })
    }
    points.push({ x: to.x, z: to.z })
    return points
  }
}
