/**
 * Filters - 信号滤波工具
 * 用于平滑传感器噪声
 */

/** 三维向量 */
export interface Vector3 {
  x: number
  y: number
  z: number
}

/**
 * 低通滤波器 - 平滑高频噪声
 */
export class LowPassFilter {
  private value: number | null = null

  constructor(public alpha: number = 0.2) {}

  filter(input: number): number {
    if (this.value === null) {
      this.value = input
    } else {
      this.value = this.alpha * input + (1 - this.alpha) * this.value
    }
    return this.value
  }

  reset(): void {
    this.value = null
  }

  get current(): number | null {
    return this.value
  }
}

/**
 * 三维低通滤波器
 */
export class LowPassFilter3D {
  private filterX: LowPassFilter
  private filterY: LowPassFilter
  private filterZ: LowPassFilter

  constructor(alpha: number = 0.2) {
    this.filterX = new LowPassFilter(alpha)
    this.filterY = new LowPassFilter(alpha)
    this.filterZ = new LowPassFilter(alpha)
  }

  filter(input: Vector3): Vector3 {
    return {
      x: this.filterX.filter(input.x),
      y: this.filterY.filter(input.y),
      z: this.filterZ.filter(input.z),
    }
  }

  reset(): void {
    this.filterX.reset()
    this.filterY.reset()
    this.filterZ.reset()
  }
}

/**
 * 高通滤波器 - 去除低频漂移，保留快速变化
 */
export class HighPassFilter {
  private lastInput: number | null = null
  private lastOutput: number = 0

  constructor(public alpha: number = 0.8) {}

  filter(input: number): number {
    if (this.lastInput === null) {
      this.lastInput = input
      this.lastOutput = 0
      return 0
    }
    this.lastOutput = this.alpha * (this.lastOutput + input - this.lastInput)
    this.lastInput = input
    return this.lastOutput
  }

  reset(): void {
    this.lastInput = null
    this.lastOutput = 0
  }
}

/**
 * 三维高通滤波器
 */
export class HighPassFilter3D {
  private filterX: HighPassFilter
  private filterY: HighPassFilter
  private filterZ: HighPassFilter

  constructor(alpha: number = 0.8) {
    this.filterX = new HighPassFilter(alpha)
    this.filterY = new HighPassFilter(alpha)
    this.filterZ = new HighPassFilter(alpha)
  }

  filter(input: Vector3): Vector3 {
    return {
      x: this.filterX.filter(input.x),
      y: this.filterY.filter(input.y),
      z: this.filterZ.filter(input.z),
    }
  }

  reset(): void {
    this.filterX.reset()
    this.filterY.reset()
    this.filterZ.reset()
  }
}

/**
 * 互补滤波器 - 融合加速度计和陀螺仪数据
 */
export class ComplementaryFilter {
  private angle: number = 0
  private lastTime: number | null = null

  constructor(public alpha: number = 0.98) {}

  filter(accelAngle: number, gyroRate: number): number {
    const now = performance.now()
    if (this.lastTime === null) {
      this.lastTime = now
      this.angle = accelAngle
      return this.angle
    }
    const dt = (now - this.lastTime) / 1000
    this.lastTime = now
    this.angle = this.alpha * (this.angle + gyroRate * dt) + (1 - this.alpha) * accelAngle
    return this.angle
  }

  reset(): void {
    this.angle = 0
    this.lastTime = null
  }

  get current(): number {
    return this.angle
  }
}

/**
 * 移动平均滤波器
 */
export class MovingAverageFilter {
  private values: number[] = []

  constructor(public windowSize: number = 5) {}

  filter(input: number): number {
    this.values.push(input)
    if (this.values.length > this.windowSize) {
      this.values.shift()
    }
    return this.values.reduce((a, b) => a + b, 0) / this.values.length
  }

  reset(): void {
    this.values = []
  }
}

/**
 * 三维移动平均滤波器
 */
export class MovingAverageFilter3D {
  private filterX: MovingAverageFilter
  private filterY: MovingAverageFilter
  private filterZ: MovingAverageFilter

  constructor(windowSize: number = 5) {
    this.filterX = new MovingAverageFilter(windowSize)
    this.filterY = new MovingAverageFilter(windowSize)
    this.filterZ = new MovingAverageFilter(windowSize)
  }

  filter(input: Vector3): Vector3 {
    return {
      x: this.filterX.filter(input.x),
      y: this.filterY.filter(input.y),
      z: this.filterZ.filter(input.z),
    }
  }

  reset(): void {
    this.filterX.reset()
    this.filterY.reset()
    this.filterZ.reset()
  }
}
