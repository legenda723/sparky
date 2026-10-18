// Какое задание дать слову (SPEC 6.3), варианты для выбора и проверка ввода (SPEC 6.3, 6.4). Чистые функции.
import { State, type Card as FsrsCard } from 'ts-fsrs'
import type { ChoiceType, ExerciseType } from './grade'
import { hasHomophone } from './homophones'

/** Повторение «моложе» 7 дней стабильности — ввод без аудирования (ступенька по сроку памяти). */
export const YOUNG_REVIEW_DAYS = 7
/** Вариантов в выборе: правильный + 3 неправильных. */
export const CHOICE_OPTIONS = 4
/** Слов в задании «Пары». */
export const PAIRS_COUNT = 5
/** Опечатка прощается в словах от 5 букв. */
export const TYPO_MIN_LENGTH = 5

/** Случайное число 0–1. В приложении — Math.random, в тестах — повторяемое. */
export type Rng = () => number

/** Слово, из которого можно взять неправильный вариант. */
export interface PoolCard {
  id: string
  deckId: string
  front: string
  back: string
  /** Владелец уже видел это слово: такие варианты — первыми, чтобы не показывать будущие слова. */
  introduced: boolean
}

export interface ExerciseCard extends FsrsCard {
  id: string
  /** Английское слово: у слов-созвучий (their / there) нет аудирования. */
  front?: string
  imageId?: string
}

/**
 * Задания, подходящие слову по его состоянию. Главное правило: выбор — только для новых и учащихся слов.
 * Слово, у которого есть созвучие, не дают на слух.
 */
export function exerciseCandidates(card: ExerciseCard): ExerciseType[] {
  const byState = candidatesByState(card)
  if (!card.front || !hasHomophone(card.front)) return byState
  return byState.filter((t) => t !== 'listen' && t !== 'listen-type')
}

function candidatesByState(card: ExerciseCard): ExerciseType[] {
  if (card.state === State.New) return ['choice-en-ru']
  if (card.state === State.Learning || card.state === State.Relearning) {
    return ['choice-en-ru', 'choice-ru-en', 'listen', ...(card.imageId ? (['picture'] as const) : [])]
  }
  return card.stability < YOUNG_REVIEW_DAYS ? ['flip', 'type'] : ['type', 'listen-type', 'flip']
}

/** Сторона слова, которая служит вариантом ответа: в EN→RU — перевод, в остальных — английское. */
export function answerSide(t: ChoiceType): 'front' | 'back' {
  return t === 'choice-en-ru' ? 'back' : 'front'
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Три неправильных варианта + правильный, перемешанные. Берём слова, которые владелец уже видел,
 * из той же колоды, похожей длины. Слова с тем же английским или тем же переводом не берём —
 * они тоже были бы правильными. Не хватает — null (тогда вместо выбора — переворот).
 */
export function pickOptions(target: PoolCard, pool: PoolCard[], side: 'front' | 'back', rng: Rng): string[] | null {
  const tf = norm(target.front)
  const tb = norm(target.back)
  const len = target[side].length
  const scored = pool
    .filter((c) => c.id !== target.id && norm(c.front) !== tf && norm(c.back) !== tb)
    .map((c) => ({
      c,
      score: (c.introduced ? 0 : 100) + (c.deckId === target.deckId ? 0 : 10) + Math.abs(c[side].length - len) + rng() * 4,
    }))
    .sort((a, b) => a.score - b.score)
  const seen = new Set([norm(target[side])])
  const picked: string[] = []
  for (const { c } of scored) {
    const text = norm(c[side])
    if (seen.has(text)) continue
    seen.add(text)
    picked.push(c.id)
    if (picked.length === CHOICE_OPTIONS - 1) break
  }
  if (picked.length < CHOICE_OPTIONS - 1) return null
  return shuffle([target.id, ...picked], rng)
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface PreparedExercise {
  exercise: ExerciseType
  /** Для выбора — id слов-вариантов (включая правильное). */
  options?: string[]
}

/**
 * Задание для слова: из подходящих по состоянию, не то же, что было только что (если есть другое).
 * Выбор без достаточного числа вариантов отпадает; если отпало всё — переворот.
 */
export function pickExercise(
  card: ExerciseCard,
  pool: PoolCard[],
  last: ExerciseType | undefined,
  rng: Rng,
): PreparedExercise {
  const target = pool.find((c) => c.id === card.id)
  const ready: PreparedExercise[] = []
  for (const exercise of exerciseCandidates(card)) {
    if (exercise === 'choice-en-ru' || exercise === 'choice-ru-en' || exercise === 'listen' || exercise === 'picture') {
      // В аудировании слова-созвучия не бывают и вариантами: their / there вообще не звучат в этом задании.
      const from = exercise === 'listen' ? pool.filter((c) => !hasHomophone(c.front)) : pool
      const options = target && pickOptions(target, from, answerSide(exercise), rng)
      if (options) ready.push({ exercise, options })
    } else {
      ready.push({ exercise })
    }
  }
  if (ready.length === 0) return { exercise: 'flip' }
  const fresh = ready.filter((r) => r.exercise !== last)
  const from = fresh.length ? fresh : ready
  return from[Math.floor(rng() * from.length)]
}

// --- Проверка ввода ---

/** Регистр, лишние пробелы, артикли a/an/the, точка в конце и вид апострофа не важны. */
export function normalizeTyped(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim()
    .replace(/^(a|an|the) /, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export type TypedVerdict = 'correct' | 'typo' | 'wrong'

/**
 * Проверка ввода: точное совпадение (после нормализации) — верно; одна опечатка в слове от 5 букв —
 * верно с пометкой. Если в слове записано несколько вариантов через «/» («color / colour») — подходит любой.
 */
export function checkTyped(input: string, answer: string): TypedVerdict {
  const got = normalizeTyped(input)
  if (!got) return 'wrong'
  const variants = [answer, ...answer.split('/')].map(normalizeTyped).filter(Boolean)
  if (variants.includes(got)) return 'correct'
  if (variants.some((v) => v.length >= TYPO_MIN_LENGTH && levenshtein(got, v) === 1)) return 'typo'
  return 'wrong'
}

/** Подсказка во вводе — первая буква (артикль не в счёт). */
export function typingHint(answer: string): string {
  const main = normalizeTyped(answer.split('/')[0] ?? answer)
  return main.slice(0, 1)
}
