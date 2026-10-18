// При открытии приложения заранее читаем колоды и слова, чтобы вкладка «Слова» и колоды открывались сразу.
import { db } from '../db/db'
import { setCached } from '../db/liveCache'
import type { Card } from '../db/types'
import { statsByDeck } from './deckStats'

export const KEYS = {
  decks: 'decks',
  stats: 'deckStats',
  deck: (id: string) => `deck:${id}`,
  cards: (id: string) => `cards:${id}`,
}

export async function prefetchWords(): Promise<void> {
  const [decks, cards] = await Promise.all([db.decks.orderBy('order').toArray(), db.cards.toArray()])
  setCached(KEYS.decks, decks.filter((d) => d.deletedAt === undefined))
  setCached(KEYS.stats, statsByDeck(cards, new Date()))
  const byDeck = new Map<string, Card[]>()
  for (const c of cards) {
    if (c.deletedAt !== undefined) continue
    const list = byDeck.get(c.deckId) ?? []
    list.push(c)
    byDeck.set(c.deckId, list)
  }
  for (const d of decks) {
    setCached(KEYS.deck(d.id), d)
    setCached(KEYS.cards(d.id), (byDeck.get(d.id) ?? []).sort((a, b) => a.order - b.order))
  }
}
