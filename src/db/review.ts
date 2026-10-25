// Ответы в уроке. Каждый ответ сохраняется сразу, одной транзакцией: слово + журнал + итоги дня + XP в профиле
// + прогресс заданий дня (src/db/day.ts).
import { State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { dayKey, dayStart } from '../srs/day'
import { isCorrect, type ExerciseType } from '../srs/grade'
import type { LessonLimits } from '../srs/lesson'
import type { Outcome } from '../srs/scheduler'
import type { SparkyDb } from './db'
import { changeDay, dayTables, getDay, type DayDelta } from './day'
import { DEFAULT_SETTINGS, type Card, type Settings } from './types'

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
  /** Лучшая серия дня до ответа. */
  comboBefore: number
}

export interface AnswerInput {
  before: Card
  grade: Grade
  outcome: Outcome<Card>
  exerciseType: ExerciseType
  durationMs: number
  /** XP за ответ (SPEC 8.1). */
  xp?: number
  /** Серия в уроке после ответа — только задания, которые проверяет приложение (у переворота нет). */
  combo?: number
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
  return db.transaction('rw', [db.cards, db.reviewLogs, ...dayTables(db)], async () => {
    await putSchedule(db, a.outcome.card)
    const comboBefore = (await getDay(db, key)).bestCombo ?? 0
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
    await changeDay(db, key, { delta, combo: a.combo })
    return { cardBefore: a.before, logId: logId as number, dayKey: key, delta, comboBefore }
  })
}

/** «Отменить последнюю оценку»: слово — как было, запись журнала — убрать, итоги дня — назад. */
export async function undoAnswer(db: SparkyDb, u: UndoToken): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewLogs, ...dayTables(db)], async () => {
    await putSchedule(db, u.cardBefore)
    await db.reviewLogs.delete(u.logId)
    await changeDay(db, u.dayKey, { delta: u.delta, sign: -1, restoreCombo: u.comboBefore })
  })
}

/** Знакомство с новым словом: оценки нет, отмечаем, что слово показано (для лимита новых и пути). */
export async function markIntroduced(db: SparkyDb, id: string, at: Date, durationMs: number): Promise<void> {
  await db.transaction('rw', [db.cards, ...dayTables(db)], async () => {
    const card = await db.cards.get(id)
    if (card && card.introducedAt === undefined) await db.cards.update(id, { introducedAt: at.getTime() })
    await changeDay(db, dayKey(at), { delta: { msSpent: Math.round(durationMs) } })
  })
}

/** Тренировка без оценки FSRS (лёгкое задание в конце, «Пары»): только XP, время и серия. */
export async function savePractice(db: SparkyDb, at: Date, xp: number, durationMs: number, combo?: number): Promise<void> {
  await db.transaction('rw', dayTables(db), async () => {
    await changeDay(db, dayKey(at), { delta: { xp, msSpent: Math.round(durationMs) }, combo })
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
      // «Выучить ещё 5 новых слов» (SPEC 6.5) поднимает лимит только на сегодня.
      newPerDay: settings.newPerDay + (day?.extraNew ?? 0),
      newToday,
      reviewLimit: settings.reviewLimit,
      // Все оценки за день (и новых слов, и возвратов) — проще и строже; по умолчанию лимита нет.
      reviewsToday: day?.reviews ?? 0,
      retention: settings.retention,
    }
    return { cards, deckOrder, limits, settings }
  })
}
