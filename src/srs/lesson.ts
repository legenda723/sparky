// Сборщик урока и его ход (SPEC 6.2). Чистые функции: на входе карточки и время, на выходе очередь.
import { State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { isCorrect } from './grade'
import { nextDayStart } from './day'
import { scheduler } from './scheduler'

/** Если следующий показ наступит в течение 20 минут — слово возвращается в конец этого же урока. */
export const RETURN_WINDOW_MS = 20 * 60_000
/** Одно слово возвращается в урок не больше 3 раз, дальше — в следующем уроке. */
export const MAX_RETURNS = 3
/** Новых слов за урок — как в будущем узле пути. */
export const MAX_NEW_PER_LESSON = 5
/** Новое слово занимает в уроке ~3 задания: знакомство, переворот и возврат. */
export const NEW_WORD_COST = 3
/** Новое слово — через каждые 2 повторения. */
const NEW_EVERY = 3

export interface LessonCardInput extends FsrsCard {
  id: string
  deckId: string
  order: number
  suspended: boolean
  deletedAt?: number
}

export interface LessonLimits {
  /** Размер урока (10 / 15 / 20). */
  size: number
  /** Новых слов в день. */
  newPerDay: number
  /** Сколько новых уже было сегодня. */
  newToday: number
  /** Лимит повторений в день, 0 — без лимита. */
  reviewLimit: number
  /** Сколько повторений уже было сегодня. */
  reviewsToday: number
  retention: number
}

export type TaskKind = 'intro' | 'flip'

export interface Task {
  kind: TaskKind
  cardId: string
}

export interface LessonPlan {
  tasks: Task[]
  newCount: number
  reviewCount: number
}

/** Что ждёт сегодня: повторения (включая слова в обучении) и сколько новых ещё можно. */
export function todayCounts(
  cards: LessonCardInput[],
  deckOrder: Map<string, number>,
  at: Date,
  limits: LessonLimits,
): { due: number; newAvailable: number } {
  const { reviews, learning, fresh } = sortCards(cards, deckOrder, at, limits.retention)
  const reviewRoom = limits.reviewLimit > 0 ? Math.max(0, limits.reviewLimit - limits.reviewsToday) : Infinity
  return {
    due: Math.min(reviews.length, reviewRoom) + learning.length,
    newAvailable: Math.min(fresh.length, Math.max(0, limits.newPerDay - limits.newToday)),
  }
}

function sortCards(cards: LessonCardInput[], deckOrder: Map<string, number>, at: Date, retention: number) {
  const tomorrow = nextDayStart(at).getTime()
  const learnAhead = at.getTime() + RETURN_WINDOW_MS
  const live = cards.filter((c) => !c.suspended && c.deletedAt === undefined && deckOrder.has(c.deckId))
  const s = scheduler(retention)
  // Повторения на сегодня: срок наступает до завтрашних 04:00. Самые «забытые» — первыми.
  const reviews = live
    .filter((c) => c.state === State.Review && c.due.getTime() < tomorrow)
    .map((c) => ({ c, r: s.get_retrievability(c, at, false) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c)
  // Слова в обучении — по точному времени (с запасом 20 минут, как в Anki).
  const learning = live
    .filter((c) => (c.state === State.Learning || c.state === State.Relearning) && c.due.getTime() <= learnAhead)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
  // Новые — по порядку: колоды сверху вниз, внутри колоды — по порядку слов.
  const fresh = live
    .filter((c) => c.state === State.New)
    .sort((a, b) => deckOrder.get(a.deckId)! - deckOrder.get(b.deckId)! || a.order - b.order)
  return { reviews, learning, fresh }
}

/**
 * Собирает урок: сначала повторения, потом слова в обучении; новые — через каждые 2 задания,
 * каждое новое — «знакомство» и сразу «переворот».
 */
export function buildLesson(
  cards: LessonCardInput[],
  deckOrder: Map<string, number>,
  at: Date,
  limits: LessonLimits,
): LessonPlan {
  const { reviews, learning, fresh } = sortCards(cards, deckOrder, at, limits.retention)
  const reviewRoom = limits.reviewLimit > 0 ? Math.max(0, limits.reviewLimit - limits.reviewsToday) : Infinity
  const old = [...reviews.slice(0, reviewRoom), ...learning].slice(0, limits.size)
  const newRoom = Math.max(0, limits.newPerDay - limits.newToday)
  const budgetForNew = Math.floor((limits.size - old.length) / NEW_WORD_COST)
  const newCards = fresh.slice(0, Math.min(MAX_NEW_PER_LESSON, newRoom, budgetForNew))

  const tasks: Task[] = []
  let oi = 0
  let ni = 0
  while (oi < old.length || ni < newCards.length) {
    const slot = tasks.length
    const wantNew = ni < newCards.length && (oi >= old.length || slot % NEW_EVERY === NEW_EVERY - 1)
    if (wantNew) {
      const id = newCards[ni++].id
      tasks.push({ kind: 'intro', cardId: id }, { kind: 'flip', cardId: id })
    } else {
      tasks.push({ kind: 'flip', cardId: old[oi++].id })
    }
  }
  return { tasks, newCount: newCards.length, reviewCount: old.length }
}

/** Ход урока. Неизменяемый: «Отменить оценку» просто возвращает прошлое состояние. */
export interface LessonState {
  queue: Task[]
  index: number
  returns: Record<string, number>
  correct: number
  wrong: number
}

export function startLesson(plan: LessonPlan): LessonState {
  return { queue: plan.tasks, index: 0, returns: {}, correct: 0, wrong: 0 }
}

export function currentTask(s: LessonState): Task | undefined {
  return s.queue[s.index]
}

export function isFinished(s: LessonState): boolean {
  return s.index >= s.queue.length
}

/** После знакомства — дальше (оценки нет). */
export function afterIntro(s: LessonState): LessonState {
  return { ...s, index: s.index + 1 }
}

/** После оценки: если слово скоро понадобится снова — в конец урока. */
export function afterGrade(s: LessonState, cardId: string, grade: Grade, nextDue: Date, at: Date): LessonState {
  const returned = s.returns[cardId] ?? 0
  const comesBack = nextDue.getTime() - at.getTime() <= RETURN_WINDOW_MS && returned < MAX_RETURNS
  const ok = isCorrect(grade)
  return {
    queue: comesBack ? [...s.queue, { kind: 'flip', cardId }] : s.queue,
    index: s.index + 1,
    returns: comesBack ? { ...s.returns, [cardId]: returned + 1 } : s.returns,
    correct: s.correct + (ok ? 1 : 0),
    wrong: s.wrong + (ok ? 0 : 1),
  }
}

/** Доля верных, 0–100. */
export function accuracy(s: LessonState): number {
  const total = s.correct + s.wrong
  return total ? Math.round((s.correct / total) * 100) : 100
}
