// Когда включать новую версию приложения (SPEC 8.3): при открытии — сразу, во время работы — по кнопке, посреди урока — никогда.

/** Сколько после открытия новая версия включается сама, без вопроса. */
export const AUTO_APPLY_MS = 10_000
/** Сколько приложение должно пробыть свёрнутым, чтобы возврат считался новым открытием. */
export const REOPEN_AFTER_HIDDEN_MS = 60_000

export type UpdateDecision = 'apply' | 'prompt' | 'wait'

/** Что делать с готовой новой версией. `sinceOpenMs` — сколько прошло с открытия (или возврата в приложение). */
export function decideUpdate(sinceOpenMs: number, busy: boolean): UpdateDecision {
  if (busy) return 'wait'
  return sinceOpenMs < AUTO_APPLY_MS ? 'apply' : 'prompt'
}

// «Занято» — идёт урок (этап 4 будет ставить флаг). Пока занято, обновление ждёт.
let busy = false
const listeners = new Set<() => void>()

export function setUpdateBlocked(value: boolean): void {
  busy = value
  listeners.forEach((l) => l())
}

export function isUpdateBlocked(): boolean {
  return busy
}

export function subscribeUpdateBlocked(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
