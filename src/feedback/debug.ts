// Журнал звуков и вибраций — только в режиме разработки, чтобы проверять отклик без ушей.
export interface DebugEntry {
  kind: 'sound' | 'haptic'
  name: string
  at: number
}

const log: DebugEntry[] = []

declare global {
  interface Window {
    __sparkyFeedbackLog?: DebugEntry[]
  }
}

export function debugLog(kind: DebugEntry['kind'], name: string): void {
  if (!import.meta.env.DEV) return
  log.push({ kind, name, at: Math.round(performance.now()) })
  if (log.length > 50) log.shift()
  window.__sparkyFeedbackLog = log
}
