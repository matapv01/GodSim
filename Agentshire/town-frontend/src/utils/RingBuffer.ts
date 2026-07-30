/**
 * RingBuffer - 固定大小的环形缓冲区
 * 用于存储传感器数据的滑动窗口
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private _size = 0

  constructor(public readonly capacity: number) {
    this.buffer = new Array(capacity)
  }

  get size(): number {
    return this._size
  }

  get isFull(): boolean {
    return this._size === this.capacity
  }

  get isEmpty(): boolean {
    return this._size === 0
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this._size < this.capacity) {
      this._size++
    }
  }

  latest(): T | undefined {
    if (this._size === 0) return undefined
    const index = (this.head - 1 + this.capacity) % this.capacity
    return this.buffer[index]
  }

  get(n: number): T | undefined {
    if (n < 0 || n >= this._size) return undefined
    const index = (this.head - 1 - n + this.capacity * 2) % this.capacity
    return this.buffer[index]
  }

  oldest(): T | undefined {
    if (this._size === 0) return undefined
    if (this._size < this.capacity) return this.buffer[0]
    return this.buffer[this.head]
  }

  toArray(): T[] {
    const result: T[] = []
    for (let i = this._size - 1; i >= 0; i--) {
      const item = this.get(i)
      if (item !== undefined) result.push(item)
    }
    return result
  }

  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this._size = 0
  }

  reduce<U>(fn: (acc: U, item: T, index: number) => U, initial: U): U {
    let acc = initial
    for (let i = this._size - 1; i >= 0; i--) {
      const item = this.get(i)
      if (item !== undefined) acc = fn(acc, item, this._size - 1 - i)
    }
    return acc
  }

  forEach(fn: (item: T, index: number) => void): void {
    for (let i = this._size - 1; i >= 0; i--) {
      const item = this.get(i)
      if (item !== undefined) fn(item, this._size - 1 - i)
    }
  }
}
