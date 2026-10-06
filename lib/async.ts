/** Small async helpers shared by screens (no app imports — safe anywhere). */

export class TimeoutError extends Error {
  constructor(message = 'timeout') {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Rejects with a TimeoutError when `p` hasn't settled after `ms`. The underlying
 * request is not aborted — use only where a hang would otherwise block the UI.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError()), ms)
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      },
    )
  })
}
