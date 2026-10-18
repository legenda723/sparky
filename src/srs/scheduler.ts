// Планировщик FSRS (SPEC 6.1). UI зовёт только эти функции, а не ts-fsrs напрямую.
import { fsrs, Rating, type Card as FsrsCard, type FSRS, type Grade, type ReviewLog } from 'ts-fsrs'
import { plural } from './status'

export { Rating, type Grade }

/** Четыре оценки в порядке кнопок: Снова / Трудно / Хорошо / Легко. */
export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

const cache = new Map<number, FSRS>()

/** Планировщик с желаемой памятью из настроек (0.85–0.95). */
export function scheduler(retention: number): FSRS {
  const r = Math.min(0.95, Math.max(0.85, retention))
  let s = cache.get(r)
  if (!s) {
    s = fsrs({
      request_retention: r,
      // Разброс интервалов, как в Anki: слова одного дня потом не приходят одной кучей.
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    })
    cache.set(r, s)
  }
  return s
}

export interface Outcome<C> {
  card: C
  log: ReviewLog
}

/**
 * Все 4 исхода сразу. Подписи под кнопками и сама оценка берутся из ОДНОГО расчёта:
 * из-за разброса (fuzz) отдельный расчёт мог бы дать другой интервал, чем написано на кнопке.
 */
export function outcomes<C extends FsrsCard>(card: C, at: Date, retention: number): Record<Grade, Outcome<C>> {
  const preview = scheduler(retention).repeat(card, at)
  const out = {} as Record<Grade, Outcome<C>>
  for (const g of GRADES) out[g] = { card: { ...card, ...preview[g].card }, log: preview[g].log }
  return out
}

/** Короткая подпись интервала под кнопкой: «1 мин», «10 мин», «3 дня», «2 мес». */
export function shortInterval(due: Date, at: Date): string {
  const min = Math.max(1, Math.round((due.getTime() - at.getTime()) / 60000))
  if (min < 60) return `${min} мин`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} ч`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} ${plural(d, 'день', 'дня', 'дней')}`
  const mo = Math.round(d / 30.4)
  if (mo < 12) return `${mo} мес`
  const y = Math.round((d / 365) * 10) / 10
  return `${String(y).replace('.', ',')} г`
}
