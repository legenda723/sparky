import 'fake-indexeddb/auto'
import { Rating, State } from 'ts-fsrs'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLesson } from '../srs/lesson'
import { outcomes } from '../srs/scheduler'
import { addCards } from './cards'
import { SparkyDb } from './db'
import { createDeck } from './decks'
import { finishLesson, loadLessonInput, markIntroduced, saveAnswer, undoAnswer } from './review'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`review-${++n}`)
  opened.push(d)
  return d
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const T = new Date('2026-10-18T15:00')

async function setup() {
  const db = freshDb()
  const deck = await createDeck(db, { title: 'Еда', emoji: '🍎', color: 'green' })
  const cards = await addCards(db, deck.id, [
    { front: 'apple', back: 'яблоко' },
    { front: 'bread', back: 'хлеб' },
  ])
  return { db, cards }
}

describe('сохранение ответа', () => {
  it('слово, журнал и итоги дня — сразу', async () => {
    const { db, cards } = await setup()
    const before = cards[0]
    const o = outcomes(before, T, 0.9)[Rating.Good]
    await saveAnswer(db, { before, grade: Rating.Good, outcome: o, exerciseType: 'flip', durationMs: 3200 })

    const card = await db.cards.get(before.id)
    expect(card!.state).toBe(State.Learning)
    expect(card!.front).toBe('apple')
    const logs = await db.reviewLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ cardId: before.id, rating: Rating.Good, exerciseType: 'flip', durationMs: 3200 })
    expect(await db.days.get('2026-10-18')).toMatchObject({ reviews: 1, newLearned: 1, correct: 1, wrong: 0, msSpent: 3200 })
  })

  it('«Отменить оценку» возвращает слово, убирает запись журнала и итоги дня', async () => {
    const { db, cards } = await setup()
    const before = cards[0]
    // Первый ответ остаётся
    const first = outcomes(before, T, 0.9)[Rating.Good]
    await saveAnswer(db, { before, grade: Rating.Good, outcome: first, exerciseType: 'flip', durationMs: 1000 })
    const mid = (await db.cards.get(before.id))!
    const dayMid = await db.days.get('2026-10-18')
    // Второй — промах пальцем, отменяем
    const t2 = new Date(T.getTime() + 11 * 60_000)
    const miss = outcomes(mid, t2, 0.9)[Rating.Again]
    const undo = await saveAnswer(db, { before: mid, grade: Rating.Again, outcome: miss, exerciseType: 'flip', durationMs: 2000 })
    expect(await db.reviewLogs.count()).toBe(2)

    await undoAnswer(db, undo)
    expect(await db.cards.get(before.id)).toEqual(mid)
    const logs = await db.reviewLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].rating).toBe(Rating.Good)
    expect(await db.days.get('2026-10-18')).toEqual(dayMid)
  })

  it('знакомство отмечает слово и учитывается в лимите новых на сегодня', async () => {
    const { db, cards } = await setup()
    await markIntroduced(db, cards[0].id, T, 5000)
    expect((await db.cards.get(cards[0].id))!.introducedAt).toBe(T.getTime())
    const input = await loadLessonInput(db, T)
    expect(input.limits.newToday).toBe(1)
    // Знакомство без оценки: слово всё ещё новое — урок снова его предложит
    expect(buildLesson(input.cards, input.deckOrder, T, input.limits).newCount).toBe(2)
    // Ночью в 01:30 — тот же день, завтра в 04:00 — счёт с нуля
    expect((await loadLessonInput(db, new Date('2026-10-19T01:30'))).limits.newToday).toBe(1)
    expect((await loadLessonInput(db, new Date('2026-10-19T04:00'))).limits.newToday).toBe(0)
  })

  it('урок завершён — +1 урок к дню', async () => {
    const { db } = await setup()
    await finishLesson(db, T)
    expect((await db.days.get('2026-10-18'))!.lessons).toBe(1)
  })

  it('удалённые колоды и слова не попадают в урок', async () => {
    const { db, cards } = await setup()
    await db.cards.update(cards[1].id, { deletedAt: 1 })
    const input = await loadLessonInput(db, T)
    expect(input.cards.map((c) => c.front)).toEqual(['apple'])
  })
})
