// Как ответ превращается в оценку FSRS (SPEC 6.4).
import { Rating, type Grade } from 'ts-fsrs'

/**
 * Задания урока (SPEC 6.3). «listen» — аудирование с выбором, «listen-type» — с вводом.
 * Пары оценку FSRS не ставят, но тип нужен для итогов.
 */
export type ExerciseType =
  | 'intro'
  | 'flip'
  | 'choice-en-ru'
  | 'choice-ru-en'
  | 'listen'
  | 'picture'
  | 'type'
  | 'listen-type'
  | 'pairs'

/** Задания с выбором из вариантов («узнать»): только при знакомстве и в шагах обучения. */
export const CHOICE_TYPES = ['choice-en-ru', 'choice-ru-en', 'listen', 'picture'] as const
export type ChoiceType = (typeof CHOICE_TYPES)[number]

/** Задания с вводом слова. */
export const TYPING_TYPES = ['type', 'listen-type'] as const
export type TypingType = (typeof TYPING_TYPES)[number]

export function isChoice(t: ExerciseType | undefined): t is ChoiceType {
  return (CHOICE_TYPES as readonly string[]).includes(t ?? '')
}

export function isTyping(t: ExerciseType | undefined): t is TypingType {
  return (TYPING_TYPES as readonly string[]).includes(t ?? '')
}

/** Порог «слишком долго»: выбор — 12 с, ввод — 20 с (SPEC → «Решения»). */
export const SLOW_MS = { choice: 12_000, type: 20_000 } as const

export interface AutoAnswer {
  type: ChoiceType | TypingType
  correct: boolean
  /** Была подсказка. */
  hinted?: boolean
  /** Ввод с одной опечаткой. */
  typo?: boolean
  durationMs: number
}

/** Выбор, аудирование, «Картинка → слово», ввод: ошибка → Снова; с заминкой → Трудно; верно → Хорошо. */
export function gradeAuto(a: AutoAnswer): Grade {
  if (!a.correct) return Rating.Again
  const slow = a.durationMs > (isTyping(a.type) ? SLOW_MS.type : SLOW_MS.choice)
  if (a.hinted || a.typo || slow) return Rating.Hard
  return Rating.Good
}

/** Ответ засчитан как верный (для точности и итогов дня). */
export function isCorrect(grade: Grade): boolean {
  return grade !== Rating.Again
}
