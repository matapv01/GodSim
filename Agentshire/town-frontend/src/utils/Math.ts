/**
 * Math utilities - 数学工具函数
 */

import type { Vector3 } from './Filters'

/** 二维向量 */
export interface Vector2 {
  x: number
  y: number
}

/** 将弧度转换为角度 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

/** 将角度转换为弧度 */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/** 计算二维向量的模 */
export function magnitude2D(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

/** 计算三维向量的模 */
export function magnitude3D(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/** 归一化二维向量 */
export function normalize2D(v: Vector2): Vector2 {
  const mag = magnitude2D(v)
  if (mag === 0) return { x: 0, y: 0 }
  return { x: v.x / mag, y: v.y / mag }
}

/** 归一化三维向量 */
export function normalize3D(v: Vector3): Vector3 {
  const mag = magnitude3D(v)
  if (mag === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag }
}

/** 二维向量点积 */
export function dot2D(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y
}

/** 三维向量点积 */
export function dot3D(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** 计算二维向量的角度（弧度，相对于正 X 轴） */
export function angle2D(v: Vector2): number {
  return Math.atan2(v.y, v.x)
}

/** 计算两个二维向量之间的角度（弧度） */
export function angleBetween2D(a: Vector2, b: Vector2): number {
  const dot = dot2D(normalize2D(a), normalize2D(b))
  return Math.acos(Math.max(-1, Math.min(1, dot)))
}

/** 二维向量减法 */
export function subtract2D(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** 三维向量减法 */
export function subtract3D(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/** 二维向量加法 */
export function add2D(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

/** 三维向量加法 */
export function add3D(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

/** 二维向量乘以标量 */
export function scale2D(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s }
}

/** 三维向量乘以标量 */
export function scale3D(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

/** 限制值在指定范围内 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 二维向量线性插值 */
export function lerp2D(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

/** 三维向量线性插值 */
export function lerp3D(a: Vector3, b: Vector3, t: number): Vector3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}

/** 将值从一个范围映射到另一个范围 */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

/** 平滑步进函数 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 计算两点之间的距离 */
export function distance2D(a: Vector2, b: Vector2): number {
  return magnitude2D(subtract2D(a, b))
}

/** 计算两点之间的距离（三维） */
export function distance3D(a: Vector3, b: Vector3): number {
  return magnitude3D(subtract3D(a, b))
}

/** 将角度标准化到 [-180, 180] 范围 */
export function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  return angle
}

/** 从加速度计数据计算倾斜角度 */
export function tiltFromAccel(accel: Vector3): { pitch: number; roll: number } {
  const pitch = radToDeg(Math.atan2(accel.y, Math.sqrt(accel.x * accel.x + accel.z * accel.z)))
  const roll = radToDeg(Math.atan2(-accel.x, accel.z))
  return { pitch, roll }
}
