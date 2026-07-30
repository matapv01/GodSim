import type { NPC } from './NPC'

/**
 * 让 follower NPC 持续跟随 leader NPC，保持在其身后一定距离。
 * 用于管家跟随镇长场景。
 */
export class FollowBehavior {
  private follower: NPC | null = null
  private leader: NPC | null = null
  private active = false

  private followDistance = 2.5
  private stopDistance = 1.8
  private offsetAngle = Math.PI * 0.75
  private followerSpeed = 3.2
  private recheckInterval = 300
  private timeSinceCheck = 0

  setTarget(leader: NPC | null, follower: NPC | null): void {
    this.leader = leader
    this.follower = follower
  }

  start(): void {
    this.active = true
    this.timeSinceCheck = 0
  }

  stop(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  update(dtMs: number): void {
    if (!this.active || !this.leader || !this.follower) return

    this.timeSinceCheck += dtMs
    if (this.timeSinceCheck < this.recheckInterval) return
    this.timeSinceCheck = 0

    const leaderPos = this.leader.getPosition()
    const followerPos = this.follower.getPosition()
    const dx = leaderPos.x - followerPos.x
    const dz = leaderPos.z - followerPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist <= this.stopDistance) return
    if (dist <= this.followDistance && this.follower.state === 'walking') return

    if (dist > this.followDistance) {
      const leaderAngle = Math.atan2(
        this.leader.mesh.rotation.y ? -Math.sin(this.leader.mesh.rotation.y) : 0,
        this.leader.mesh.rotation.y ? -Math.cos(this.leader.mesh.rotation.y) : -1,
      )
      const targetX = leaderPos.x + Math.cos(leaderAngle + this.offsetAngle) * this.stopDistance
      const targetZ = leaderPos.z + Math.sin(leaderAngle + this.offsetAngle) * this.stopDistance
      this.follower.moveTo({ x: targetX, z: targetZ }, this.followerSpeed)
    }
  }
}
