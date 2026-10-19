// При открытии приложения заранее читаем колоды, слова и путь, чтобы экраны открывались сразу.
// После восстановления и сброса — обновляет память экранов.
import { db } from '../db/db'
import { setCached } from '../db/liveCache'
import { loadPath, PATH_KEY } from '../db/path'
import { now } from '../srs/clock'
import type { Card } from '../db/types'
import { statsByDeck } from './deckStats'

export const KEYS = {
  decks: 'decks',
  stats: 'deckStats',
  deck: (id: string) => `deck:${id}`,
  cards: (id: string) => `cards:${id}`,
}

export async function prefetchWords(): Promise<void> {
  const [decks, cards, path] = await Promise.all([db.decks.orderBy('order').toArray(), db.cards.toArray(), loadPath(db, now())])
  setCached(PATH_KEY, path)
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
