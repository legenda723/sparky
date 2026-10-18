// Как ответ превращается в оценку FSRS (SPEC 6.4).
import { Rating, type Grade } from 'ts-fsrs'

/** Задания урока. Этап 4: знакомство и переворот; остальные — этап 6. */
export type ExerciseType = 'intro' | 'flip' | 'choice-en-ru' | 'choice-ru-en' | 'listen' | 'picture' | 'type'

/** Порог «слишком долго»: выбор — 12 с, ввод — 20 с (SPEC → «Решения»). */
export const SLOW_MS = { choice: 12_000, type: 20_000 } as const

export interface AutoAnswer {
  type: Exclude<ExerciseType, 'intro' | 'flip'>
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
  const slow = a.durationMs > (a.type === 'type' ? SLOW_MS.type : SLOW_MS.choice)
  if (a.hinted || a.typo || slow) return Rating.Hard
  return Rating.Good
}

/** Ответ засчитан как верный (для точности и итогов дня). */
export function isCorrect(grade: Grade): boolean {
  return grade !== Rating.Again
}
