// Сборщик урока и его ход (SPEC 6.2). Чистые функции: на входе карточки и время, на выходе очередь.
import { State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { isChoice, isCorrect, type ExerciseType } from './grade'
import { PAIRS_COUNT, pickExercise, pickOptions, shuffle, type ExerciseCard, type PoolCard, type Rng } from './exercise'
import { nextDayStart } from './day'
import { scheduler } from './scheduler'

/** Если следующий показ наступит в течение 20 минут — слово возвращается в конец этого же урока. */
export const RETURN_WINDOW_MS = 20 * 60_000
/** Одно слово возвращается в урок не больше 3 раз, дальше — в следующем уроке. */
export const MAX_RETURNS = 3
/** Новых слов за урок — как в будущем узле пути. */
export const MAX_NEW_PER_LESSON = 5
/** Новое слово занимает в уроке ~3 задания: знакомство, выбор и возврат. */
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

/**
 * Место в уроке: «intro» — знакомство; «graded» — задание с оценкой FSRS (какое именно — решается при показе,
 * по тогдашнему состоянию слова); «pairs» — бонус «Пары»; «easy» — лёгкий выбор в конце, без оценки.
 */
export type TaskKind = 'intro' | 'graded' | 'pairs' | 'easy'

export interface Task {
  kind: TaskKind
  /** У «Пар» — пусто. */
  cardId: string
  /** Задание, выбранное при показе (prepareCurrent). */
  exercise?: ExerciseType
  /** Варианты выбора — id слов, включая правильное. */
  options?: string[]
  /** Слова для «Пар». */
  pairIds?: string[]
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
 * каждое новое — «знакомство» и сразу задание с оценкой (выбор). Какое задание — решается при показе (prepareCurrent).
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
      tasks.push({ kind: 'intro', cardId: id }, { kind: 'graded', cardId: id })
    } else {
      tasks.push({ kind: 'graded', cardId: old[oi++].id })
    }
  }
  return { tasks: withPairs(tasks), newCount: newCards.length, reviewCount: old.length }
}

/** Доля урока, после которой ставятся «Пары». */
const PAIRS_AT = 0.6

/**
 * «Пары» (одни за урок, в счёт размера не входят) — после 5 разных слов и не раньше 60% урока.
 * Могут встать и после последнего запланированного задания: возвраты слов в обучении идут уже за ними.
 */
function withPairs(tasks: Task[]): Task[] {
  const seen = new Set<string>()
  let after = -1
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].kind === 'graded') seen.add(tasks[i].cardId)
    if (seen.size >= PAIRS_COUNT) {
      after = i
      break
    }
  }
  if (after < 0) return tasks
  const at = Math.max(after + 1, Math.round(tasks.length * PAIRS_AT))
  return [...tasks.slice(0, at), { kind: 'pairs', cardId: '' }, ...tasks.slice(at)]
}

/** Ход урока. Неизменяемый: «Отменить оценку» просто возвращает прошлое состояние. */
export interface LessonState {
  queue: Task[]
  index: number
  returns: Record<string, number>
  /** Верных и ошибок — только по заданиям с оценкой FSRS (для точности). */
  correct: number
  wrong: number
  /** Верных подряд (задания с оценкой и лёгкое задание) — «5 ПОДРЯД!». */
  streak: number
  bestStreak: number
  /** Последний ответ (с оценкой или лёгкое задание) был верным. */
  lastOk: boolean
  /** Сколько лёгких заданий добавлено в конце (больше MAX_EASY — нет: не из чего собрать или уже хватит). */
  easyCount: number
  /** Новые слова этого урока, за которые ещё не дан бонус «новое слово выучено» (первый верный ответ). */
  newPending: string[]
  /** XP за ответы урока (бонус за завершение — отдельно). */
  xp: number
}

export function startLesson(plan: LessonPlan): LessonState {
  return {
    queue: plan.tasks,
    index: 0,
    returns: {},
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    lastOk: true,
    easyCount: 0,
    newPending: [],
    xp: 0,
  }
}

export function currentTask(s: LessonState): Task | undefined {
  return s.queue[s.index]
}

export function isFinished(s: LessonState): boolean {
  return s.index >= s.queue.length
}

/** После знакомства — дальше (оценки нет). Слово ждёт первого верного ответа — за него бонус XP. */
export function afterIntro(s: LessonState, cardId?: string): LessonState {
  return { ...s, index: s.index + 1, newPending: cardId ? [...s.newPending, cardId] : s.newPending }
}

/** Верный ответ на это слово будет первым после знакомства — +3 XP «новое слово выучено». */
export function isNewWordBonus(s: LessonState, cardId: string): boolean {
  return s.newPending.includes(cardId)
}

function withStreak(s: LessonState, ok: boolean): Pick<LessonState, 'streak' | 'bestStreak'> {
  const streak = ok ? s.streak + 1 : 0
  return { streak, bestStreak: Math.max(s.bestStreak, streak) }
}

/** После оценки: если слово скоро понадобится снова — в конец урока. */
export function afterGrade(s: LessonState, cardId: string, grade: Grade, nextDue: Date, at: Date, xp = 0): LessonState {
  const returned = s.returns[cardId] ?? 0
  const comesBack = nextDue.getTime() - at.getTime() <= RETURN_WINDOW_MS && returned < MAX_RETURNS
  const ok = isCorrect(grade)
  return {
    ...s,
    ...withStreak(s, ok),
    queue: comesBack ? [...s.queue, { kind: 'graded', cardId }] : s.queue,
    index: s.index + 1,
    returns: comesBack ? { ...s.returns, [cardId]: returned + 1 } : s.returns,
    correct: s.correct + (ok ? 1 : 0),
    wrong: s.wrong + (ok ? 0 : 1),
    lastOk: ok,
    newPending: ok ? s.newPending.filter((id) => id !== cardId) : s.newPending,
    xp: s.xp + xp,
  }
}

/** После «Пар» или лёгкого задания (FSRS не трогают). Лёгкое задание продолжает или обрывает серию. */
export function afterPractice(s: LessonState, xp: number, streakOk?: boolean): LessonState {
  return {
    ...s,
    ...(streakOk === undefined ? {} : { ...withStreak(s, streakOk), lastOk: streakOk }),
    index: s.index + 1,
    xp: s.xp + xp,
  }
}

/** Что нужно, чтобы подготовить задание: слова урока (свежие), все слова для вариантов, случайность. */
export interface PrepareContext {
  cards: Map<string, ExerciseCard>
  pool: PoolCard[]
  rng: Rng
}

/** Слова, которые уже встречались в уроке до текущего места (знакомство или задание с оценкой). */
function seenCardIds(s: LessonState): string[] {
  const ids: string[] = []
  for (const t of s.queue.slice(0, s.index)) {
    if ((t.kind === 'intro' || t.kind === 'graded') && !ids.includes(t.cardId)) ids.push(t.cardId)
  }
  return ids
}

/** Лёгких заданий в конце — не больше двух: если на первом ошиблись, даём ещё одно, чтобы выйти с успехом. */
const MAX_EASY = 2

/** Урок и так закончился верным выбором (или верным лёгким заданием) — ещё одно лёгкое не нужно. */
function endsEasy(s: LessonState): boolean {
  const last = s.queue[s.index - 1]
  if (!last) return true
  return (last.kind === 'easy' || (last.kind === 'graded' && isChoice(last.exercise))) && s.lastOk
}

/**
 * Лёгкое задание в конце (SPEC 6.2, 6.3): выбор EN→RU по самому знакомому слову, которое уже было в этом уроке
 * (кроме слова, на котором только что ошиблись). Без оценки FSRS.
 */
function easyTask(s: LessonState, ctx: PrepareContext): Task | null {
  const last = s.queue[s.index - 1]
  const failed = last && !s.lastOk ? last.cardId : undefined
  const ranked = seenCardIds(s)
    .filter((id) => id !== failed)
    .map((id) => ctx.cards.get(id))
    .filter((c): c is ExerciseCard => c !== undefined)
    .sort((a, b) => b.stability - a.stability)
  for (const c of ranked) {
    const target = ctx.pool.find((p) => p.id === c.id)
    const options = target && pickOptions(target, ctx.pool, 'back', ctx.rng)
    if (options) return { kind: 'easy', cardId: c.id, exercise: 'choice-en-ru', options }
  }
  return null
}

/** Слова для «Пар»: 5 разных из уже встречавшихся в уроке, с разными английскими словами и переводами. */
function pairsFor(s: LessonState, ctx: PrepareContext): string[] | null {
  const ids: string[] = []
  const fronts = new Set<string>()
  const backs = new Set<string>()
  for (const id of shuffle(seenCardIds(s), ctx.rng)) {
    const c = ctx.pool.find((p) => p.id === id)
    if (!c) continue
    const f = c.front.trim().toLowerCase()
    const b = c.back.trim().toLowerCase()
    if (fronts.has(f) || backs.has(b)) continue
    fronts.add(f)
    backs.add(b)
    ids.push(id)
    if (ids.length === PAIRS_COUNT) return ids
  }
  return null
}

/**
 * Готовит текущее задание к показу: тип — по тогдашнему состоянию слова (SPEC 6.3), варианты, слова для «Пар».
 * Задание, которое не из чего собрать, пропускается. В конце урока при необходимости добавляется лёгкое задание.
 * Звать после каждого шага урока. Уже подготовленное задание не меняется (после «Отменить» — то же самое).
 */
export function prepareCurrent(s: LessonState, ctx: PrepareContext): LessonState {
  let state = s
  for (;;) {
    if (isFinished(state)) {
      if (state.easyCount >= MAX_EASY || endsEasy(state)) return state
      const easy = easyTask(state, ctx)
      if (!easy) return { ...state, easyCount: MAX_EASY }
      return { ...state, queue: [...state.queue, easy], easyCount: state.easyCount + 1 }
    }
    const task = state.queue[state.index]
    if (task.kind === 'intro' || task.exercise) return state
    let ready: Task | null = null
    if (task.kind === 'pairs') {
      const pairIds = pairsFor(state, ctx)
      if (pairIds) ready = { ...task, exercise: 'pairs', pairIds }
    } else {
      const card = ctx.cards.get(task.cardId)
      const last = state.queue[state.index - 1]?.exercise
      if (card) ready = { ...task, ...pickExercise(card, ctx.pool, last, ctx.rng) }
    }
    if (!ready) {
      state = { ...state, index: state.index + 1 }
      continue
    }
    const queue = [...state.queue]
    queue[state.index] = ready
    return { ...state, queue }
  }
}

/** Доля верных, 0–100. */
export function accuracy(s: LessonState): number {
  const total = s.correct + s.wrong
  return total ? Math.round((s.correct / total) * 100) : 100
}
