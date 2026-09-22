/**
 * Purpose: Bridge callback-produced Story Builder events to an async iterable.
 * Pattern: Producer-consumer queue.
 * Usage: Created per streaming Story Builder request by index.ts.
 * Related: src/backend/core/story-builder/index.ts
 */
export interface AsyncQueue<T> extends AsyncIterable<T> {
  push(value: T): void
  close(): void
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: T[] = []
  const waiting: Array<(result: IteratorResult<T>) => void> = []
  let closed = false

  return {
    push(value: T) {
      const resolve = waiting.shift()
      if (resolve) {
        resolve({ value, done: false })
        return
      }
      values.push(value)
    },
    close() {
      closed = true
      for (const resolve of waiting.splice(0)) {
        resolve({ value: undefined, done: true })
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<T>> {
          const value = values.shift()
          if (value !== undefined) return Promise.resolve({ value, done: false })
          if (closed) return Promise.resolve({ value: undefined, done: true })
          return new Promise((resolve) => waiting.push(resolve))
        },
      }
    },
  }
}
