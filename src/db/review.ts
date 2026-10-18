// Ответы в уроке. Каждый ответ сохраняется сразу, одной транзакцией: слово + журнал + итоги дня.
import { State, type Grade } from 'ts-fsrs'
import { dayKey, dayStart } from '../srs/day'
import { isCorrect, type ExerciseType } from '../srs/grade'
import type { LessonLimits } from '../srs/lesson'
import type { Outcome } from '../srs/scheduler'
import type { SparkyDb } from './db'
import { DEFAULT_SETTINGS, type Card, type DayRecord, type Settings } from './types'

export function emptyDay(key: string): DayRecord {
  return { dayKey: key, xp: 0, lessons: 0, reviews: 0, newLearned: 0, correct: 0, wrong: 0, msSpent: 0, goalMet: false, freezeUsed: false }
}

type DayDelta = Partial<Pick<DayRecord, 'lessons' | 'reviews' | 'newLearned' | 'correct' | 'wrong' | 'msSpent'>>

async function addToDay(db: SparkyDb, key: string, delta: DayDelta, sign: 1 | -1 = 1): Promise<void> {
  const day = (await db.days.get(key)) ?? emptyDay(key)
  for (const [k, v] of Object.entries(delta) as [keyof DayDelta, number][]) {
    day[k] = Math.max(0, day[k] + sign * v)
  }
  await db.days.put(day)
}

/** Всё, что нужно, чтобы отменить оценку: слово до неё, запись журнала и что прибавилось к дню. */
export interface UndoToken {
  cardBefore: Card
  logId: number
  dayKey: string
  delta: DayDelta
}

export interface AnswerInput {
  before: Card
  grade: Grade
  outcome: Outcome<Card>
  exerciseType: ExerciseType
  durationMs: number
}

export async function saveAnswer(db: SparkyDb, a: AnswerInput): Promise<UndoToken> {
  const { log } = a.outcome
  const key = dayKey(log.review)
  const ok = isCorrect(a.grade)
  const delta: DayDelta = {
    reviews: 1,
    newLearned: a.before.state === State.New ? 1 : 0,
    correct: ok ? 1 : 0,
    wrong: ok ? 0 : 1,
    msSpent: Math.round(a.durationMs),
  }
  return db.transaction('rw', db.cards, db.reviewLogs, db.days, async () => {
    await db.cards.put(a.outcome.card)
    const logId = await db.reviewLogs.add({
      cardId: a.before.id,
      rating: log.rating,
      state: log.state,
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      review: log.review,
      exerciseType: a.exerciseType,
      durationMs: Math.round(a.durationMs),
    })
    await addToDay(db, key, delta)
    return { cardBefore: a.before, logId: logId as number, dayKey: key, delta }
  })
}

/** «Отменить последнюю оценку»: слово — как было, запись журнала — убрать, итоги дня — назад. */
export async function undoAnswer(db: SparkyDb, u: UndoToken): Promise<void> {
  await db.transaction('rw', db.cards, db.reviewLogs, db.days, async () => {
    await db.cards.put(u.cardBefore)
    await db.reviewLogs.delete(u.logId)
    await addToDay(db, u.dayKey, u.delta, -1)
  })
}

/** Знакомство с новым словом: оценки нет, отмечаем, что слово показано (для лимита новых и пути). */
export async function markIntroduced(db: SparkyDb, id: string, at: Date, durationMs: number): Promise<void> {
  await db.transaction('rw', db.cards, db.days, async () => {
    const card = await db.cards.get(id)
    if (card && card.introducedAt === undefined) await db.cards.update(id, { introducedAt: at.getTime() })
    await addToDay(db, dayKey(at), { msSpent: Math.round(durationMs) })
  })
}

export async function finishLesson(db: SparkyDb, at: Date): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    await addToDay(db, dayKey(at), { lessons: 1 })
  })
}

export interface LessonInput {
  cards: Card[]
  deckOrder: Map<string, number>
  limits: LessonLimits
  settings: Settings
}

/** Всё для сборки урока: живые слова живых колод, порядок колод, лимиты на сегодня. */
export async function loadLessonInput(db: SparkyDb, at: Date): Promise<LessonInput> {
  return db.transaction('r', db.decks, db.cards, db.days, db.settings, async () => {
    const decks = (await db.decks.orderBy('order').toArray()).filter((d) => d.deletedAt === undefined && !d.archived)
    const deckOrder = new Map(decks.map((d, i) => [d.id, i]))
    const cards = (await db.cards.toArray()).filter((c) => c.deletedAt === undefined && deckOrder.has(c.deckId))
    const settings = { ...DEFAULT_SETTINGS, ...(await db.settings.get('me')) }
    const since = dayStart(at).getTime()
    const newToday = cards.filter((c) => c.introducedAt !== undefined && c.introducedAt >= since).length
    const day = await db.days.get(dayKey(at))
    const limits: LessonLimits = {
      size: settings.lessonSize,
      newPerDay: settings.newPerDay,
      newToday,
      reviewLimit: settings.reviewLimit,
      reviewsToday: day?.reviews ?? 0,
      retention: settings.retention,
    }
    return { cards, deckOrder, limits, settings }
  })
}
