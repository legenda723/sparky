// Текущее время для повторения. В режиме разработки витрина может «перемотать» его вперёд,
// чтобы проверить, какие слова придут завтра. В опубликованной версии сдвига нет.

const KEY = 'sparky.devClockOffsetMs'

function offsetMs(): number {
  if (!import.meta.env.DEV) return 0
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

export function now(): Date {
  return new Date(Date.now() + offsetMs())
}

/** Только для витрины в режиме разработки. */
export function getDevClockOffset(): number {
  return offsetMs()
}

export function setDevClockOffset(ms: number): void {
  if (!import.meta.env.DEV) return
  try {
    if (ms) localStorage.setItem(KEY, String(ms))
    else localStorage.removeItem(KEY)
  } catch {
    // без localStorage перемотка просто не сохранится
  }
}
