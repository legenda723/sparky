// Ответы в уроке. Каждый ответ сохраняется сразу, одной транзакцией: слово + журнал + итоги дня + XP в профиле.
import { State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { dayKey, dayStart } from '../srs/day'
import { isCorrect, type ExerciseType } from '../srs/grade'
import type { LessonLimits } from '../srs/lesson'
import type { Outcome } from '../srs/scheduler'
import type { SparkyDb } from './db'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type Card, type DayRecord, type Settings } from './types'

export function emptyDay(key: string): DayRecord {
  return { dayKey: key, xp: 0, lessons: 0, reviews: 0, newLearned: 0, correct: 0, wrong: 0, msSpent: 0, goalMet: false, freezeUsed: false }
}

type DayDelta = Partial<Pick<DayRecord, 'xp' | 'lessons' | 'reviews' | 'newLearned' | 'correct' | 'wrong' | 'msSpent'>>

async function addToDay(db: SparkyDb, key: string, delta: DayDelta, sign: 1 | -1 = 1): Promise<void> {
  const day = (await db.days.get(key)) ?? emptyDay(key)
  for (const [k, v] of Object.entries(delta) as [keyof DayDelta, number][]) {
    day[k] = Math.max(0, day[k] + sign * v)
  }
  await db.days.put(day)
  // XP копится и в профиле (всего XP) — в той же транзакции.
  if (delta.xp) {
    const profile = (await db.profile.get('me')) ?? DEFAULT_PROFILE
    await db.profile.put({ ...profile, totalXp: Math.max(0, profile.totalXp + sign * delta.xp) })
  }
}

const FSRS_KEYS = [
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'state',
  'last_review',
] as const satisfies readonly (keyof FsrsCard)[]

/**
 * Пишет в слово только поля расписания FSRS. Остальное (отметка знакомства, правки владельца)
 * берётся из базы: копия в памяти урока могла устареть.
 */
async function putSchedule(db: SparkyDb, from: Card): Promise<void> {
  const stored = await db.cards.get(from.id)
  if (!stored) return
  const next: Card = { ...stored }
  for (const k of FSRS_KEYS) (next as unknown as Record<string, unknown>)[k] = from[k]
  await db.cards.put(next)
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
  /** XP за ответ (SPEC 8.1). */
  xp?: number
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
    xp: a.xp ?? 0,
  }
  return db.transaction('rw', db.cards, db.reviewLogs, db.days, db.profile, async () => {
    await putSchedule(db, a.outcome.card)
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
  await db.transaction('rw', db.cards, db.reviewLogs, db.days, db.profile, async () => {
    await putSchedule(db, u.cardBefore)
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

/** Тренировка без оценки FSRS (лёгкое задание в конце, «Пары»): только XP и время. */
export async function savePractice(db: SparkyDb, at: Date, xp: number, durationMs: number): Promise<void> {
  await db.transaction('rw', db.days, db.profile, async () => {
    await addToDay(db, dayKey(at), { xp, msSpent: Math.round(durationMs) })
  })
}

/** Урок завершён: +1 урок за день и бонус XP за завершение. */
export async function finishLesson(db: SparkyDb, at: Date, xp = 0): Promise<void> {
  await db.transaction('rw', db.days, db.profile, async () => {
    await addToDay(db, dayKey(at), { lessons: 1, xp })
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
      // Все оценки за день (и новых слов, и возвратов) — проще и строже; по умолчанию лимита нет.
      reviewsToday: day?.reviews ?? 0,
      retention: settings.retention,
    }
    return { cards, deckOrder, limits, settings }
  })
}
