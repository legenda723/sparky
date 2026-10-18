// Тестовые данные для проверок (SPEC 7.3). Только в режиме разработки — в сборку для владельца не попадают.
import { State } from 'ts-fsrs'
import { addCards } from '../db/cards'
import { db } from '../db/db'
import { createDeck } from '../db/decks'

const DAY = 86_400_000

const DECKS = [
  {
    deck: { title: 'Еда', emoji: '🍎', color: 'green' as const },
    words: 'apple - яблоко\nbread - хлеб\nwater - вода\nmilk - молоко\ncheese - сыр\negg - яйцо\nmeat - мясо\nfish - рыба\nrice - рис\nsoup - суп\nsugar - сахар\nsalt - соль',
  },
  {
    deck: { title: 'Дом', emoji: '🏠', color: 'blue' as const },
    words: 'house | дом | [haʊs] | My house is small. | Мой дом маленький.\nroom - комната\nkitchen - кухня\nwindow - окно\ndoor - дверь\ntable - стол\nchair - стул\nbed - кровать',
  },
  {
    deck: { title: 'Путешествия', emoji: '✈️', color: 'pink' as const },
    words: 'ticket - билет\ntrain - поезд\nairport - аэропорт\nluggage - багаж\nmap - карта\nhotel - гостиница',
  },
]

/** Добавляет 3 колоды; часть слов «уже учится», чтобы были видны все состояния и фильтры. */
export async function seedTestData(): Promise<void> {
  const now = Date.now()
  for (const { deck, words } of DECKS) {
    const d = await createDeck(db, deck)
    const texts = words.split('\n').map((line) => {
      const [front, back, transcription, example, exampleTranslation] = line.includes('|')
        ? line.split('|').map((s) => s.trim())
        : line.split(' - ')
      return { front, back, transcription, example, exampleTranslation }
    })
    const cards = await addCards(db, d.id, texts)
    await db.transaction('rw', db.cards, async () => {
      for (const [i, c] of cards.entries()) {
        const kind = i % 5
        if (kind === 0) continue // новое
        const last = new Date(now - 3 * DAY)
        if (kind === 1) await db.cards.update(c.id, { state: State.Learning, stability: 0.5, difficulty: 6, reps: 1, last_review: last, due: new Date(now + 10 * 60_000) })
        if (kind === 2) await db.cards.update(c.id, { state: State.Review, stability: 4, difficulty: 5, reps: 3, last_review: last, due: new Date(now - DAY) })
        if (kind === 3) await db.cards.update(c.id, { state: State.Review, stability: 30, difficulty: 4, reps: 6, last_review: new Date(now - 31 * DAY), due: new Date(now - DAY) })
        if (kind === 4) await db.cards.update(c.id, { state: State.Review, stability: 9, difficulty: 5, reps: 4, last_review: last, due: new Date(now + 6 * DAY), suspended: i % 2 === 0 })
      }
    })
  }
}
