// Поиск и фильтр слов в колоде (SPEC 7.3).
import type { Card } from '../db/types'
import { cardStatus, type CardStatus } from '../srs/status'
import { normalizeWord } from './parseList'

export type StatusFilter = 'all' | CardStatus

export function filterCards(cards: Card[], status: StatusFilter, query: string): Card[] {
  const q = normalizeWord(query)
  return cards.filter(
    (c) =>
      (status === 'all' || cardStatus(c) === status) &&
      (!q || normalizeWord(c.front).includes(q) || normalizeWord(c.back).includes(q)),
  )
}
