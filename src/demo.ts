// Временный показ «путь на уроке 20» (просьба владельца, убрать после просмотра).
// Работает только в отдельной базе «sparky-demo» (включается в Профиле): 22 урока, 1–19 пройдены, сундуки открыты.
import { State } from 'ts-fsrs'
import { addCards } from './db/cards'
import { db, DEMO, DEMO_FLAG } from './db/db'
import { createDeck } from './db/decks'
import { openChest } from './db/path'
import { chestKey } from './game/path'

export async function seedDemo(): Promise<void> {
  if (!DEMO || db.name !== 'sparky-demo' || (await db.decks.count()) > 0) return
  const deck = await createDeck(db, { title: 'Мои слова', emoji: '📚', color: 'green' })
  const texts = Array.from({ length: 110 }, (_, i) => ({ front: `word ${i + 1}`, back: `слово ${i + 1}` }))
  const cards = await addCards(db, deck.id, texts)
  const now = Date.now()
  await db.cards.bulkPut(
    cards.slice(0, 95).map((c) => ({
      ...c,
      state: State.Review,
      stability: 30,
      difficulty: 5,
      reps: 3,
      due: new Date(now + 10 * 864e5),
      last_review: new Date(now - 864e5),
      introducedAt: now - 864e5,
    })),
  )
  for (let k = 1; k <= 6; k++) await openChest(db, chestKey(deck.id, k), 15)
}

/** Включить или выключить показ: переключает базу и перезапускает приложение. */
export function setDemo(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, '1')
    else localStorage.removeItem(DEMO_FLAG)
  } catch {
    return
  }
  location.replace(`${location.pathname}#/path`)
  location.reload()
}
