// При открытии приложения заранее читаем колоды, слова и путь, чтобы экраны открывались сразу.
// После восстановления и сброса — обновляет память экранов.
import { db } from '../db/db'
import { loadProfileGame, PROFILE_GAME_KEY } from '../db/game'
import { JOURNEY_KEY, loadJourney } from '../db/journey'
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
  // Путь — отдельно: его ошибка не должна мешать памяти колод и слов.
  void loadPath(db, now())
    .then((path) => setCached(PATH_KEY, path))
    .catch(() => {})
  void loadProfileGame(db, now())
    .then((g) => setCached(PROFILE_GAME_KEY, g))
    .catch(() => {})
  void loadJourney(db)
    .then((j) => setCached(JOURNEY_KEY, j))
    .catch(() => {})
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
