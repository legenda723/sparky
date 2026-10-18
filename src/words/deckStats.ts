import type { SparkyDb } from '../db/db'
import type { Card, Id } from '../db/types'
import { cardStatus, isDue } from '../srs/status'

export interface DeckStats {
  total: number
  mastered: number
  due: number
}

export function statsByDeck(cards: Card[], now: Date): Map<Id, DeckStats> {
  const map = new Map<Id, DeckStats>()
  for (const c of cards) {
    if (c.deletedAt !== undefined) continue
    const s = map.get(c.deckId) ?? { total: 0, mastered: 0, due: 0 }
    s.total++
    if (cardStatus(c) === 'mastered') s.mastered++
    if (isDue(c, now)) s.due++
    map.set(c.deckId, s)
  }
  return map
}

export async function loadDeckStats(db: SparkyDb): Promise<Map<Id, DeckStats>> {
  return statsByDeck(await db.cards.toArray(), new Date())
}
