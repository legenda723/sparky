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

const FOOD = 'apple яблоко|bread хлеб|water вода|milk молоко|cheese сыр|egg яйцо|meat мясо|fish рыба|rice рис|soup суп|sugar сахар|salt соль|tea чай|coffee кофе|juice сок|cake торт|butter масло|honey мёд|pear груша|plum слива'
const HOME = 'house дом|room комната|kitchen кухня|window окно|door дверь|table стол|chair стул|bed кровать'
const WORK = 'job работа|boss начальник|office офис|desk стол|meeting встреча|email письмо|task задача|team команда|salary зарплата|break перерыв|plan план|report отчёт|call звонок|client клиент|project проект'

function texts(list: string) {
  return list.split('|').map((pair) => {
    const [front, back] = pair.split(' ')
    return { front, back }
  })
}

/**
 * Путь со всеми состояниями (SPEC 7.1, этап 7): «Еда» — освоен, пройден (3 слова к повторению), пройден, пройден,
 * текущий (2 из 5 знакомы); «Дом» — закрытые; «Работа» — пройденные после текущего; «Путешествия» — без слов.
 */
export async function seedPathData(): Promise<void> {
  const now = Date.now()
  const known = (stability: number, dueInDays: number) => ({
    state: State.Review,
    stability,
    difficulty: 5,
    reps: 4,
    last_review: new Date(now - 2 * DAY),
    due: new Date(now + dueInDays * DAY),
  })
  const food = await createDeck(db, { title: 'Еда', emoji: '🍎', color: 'green' })
  const foodCards = await addCards(db, food.id, texts(FOOD))
  const home = await createDeck(db, { title: 'Дом', emoji: '🏠', color: 'blue' })
  await addCards(db, home.id, texts(HOME))
  const work = await createDeck(db, { title: 'Работа', emoji: '💼', color: 'purple' })
  const workCards = await addCards(db, work.id, texts(WORK))
  await createDeck(db, { title: 'Путешествия', emoji: '✈️', color: 'pink' })
  await db.transaction('rw', db.cards, async () => {
    for (const [i, c] of foodCards.entries()) {
      if (i < 5) await db.cards.update(c.id, known(30, 20))
      else if (i < 8) await db.cards.update(c.id, known(4, -1))
      else if (i < 17) await db.cards.update(c.id, known(5, 3))
    }
    for (const c of workCards) await db.cards.update(c.id, known(8, 5))
  })
}
