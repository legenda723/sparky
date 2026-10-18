// Состояние слова для списка и фильтров (SPEC 7.3) и человеческие подписи к карточке.
import { fsrs, State, type Card as FsrsCard } from 'ts-fsrs'

export type CardStatus = 'new' | 'learning' | 'known' | 'mastered'

/** «Освоено» — стабильность от 21 дня (SPEC 7.1, 7.3, 7.4). */
export const MASTERED_DAYS = 21

export function cardStatus(card: FsrsCard): CardStatus {
  if (card.state === State.New) return 'new'
  if (card.state === State.Learning || card.state === State.Relearning) return 'learning'
  return card.stability >= MASTERED_DAYS ? 'mastered' : 'known'
}

/** Пора повторять: уже знакомое слово, срок подошёл. */
export function isDue(card: FsrsCard & { suspended: boolean }, now: Date): boolean {
  return !card.suspended && card.state !== State.New && card.due.getTime() <= now.getTime()
}

const scheduler = fsrs()

/** Вероятность вспомнить сейчас, 0–1. У нового слова — null. */
export function recallChance(card: FsrsCard, now: Date): number | null {
  if (card.state === State.New) return null
  return scheduler.get_retrievability(card, now, false)
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** «через 12 дней», «через 10 минут», «сейчас». */
export function inHuman(due: Date, now: Date): string {
  const min = Math.round((due.getTime() - now.getTime()) / 60000)
  if (min <= 0) return 'сейчас'
  if (min < 60) return `через ${min} ${plural(min, 'минуту', 'минуты', 'минут')}`
  const h = Math.round(min / 60)
  if (h < 24) return `через ${h} ${plural(h, 'час', 'часа', 'часов')}`
  const d = Math.round(h / 24)
  if (d < 31) return `через ${d} ${plural(d, 'день', 'дня', 'дней')}`
  const mo = Math.round(d / 30)
  if (mo < 12) return `через ${mo} ${plural(mo, 'месяц', 'месяца', 'месяцев')}`
  const y = Math.round(d / 365)
  return `через ${y} ${plural(y, 'год', 'года', 'лет')}`
}

