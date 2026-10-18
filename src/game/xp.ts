// Очки опыта (SPEC 8.1). Чистые функции; уровни и дневная цель — этап 8.

export const XP = {
  /** Верный ответ. */
  correct: 2,
  /** Новое слово выучено: первый верный ответ после знакомства. */
  newWord: 3,
  /** Урок завершён. */
  lesson: 10,
  /** Идеальный урок — без ошибок. */
  perfect: 5,
  /** В серии от 5 верных подряд — +1 к каждому ответу. */
  streakBonus: 1,
  streakFrom: 5,
  /** Тренировка (лёгкое задание в конце, «Пары») — половина за верный ответ. */
  practice: 1,
} as const

export interface AnswerXpInput {
  correct: boolean
  /** Слово до ответа было новым (только что познакомились). */
  newWord: boolean
  /** Серия верных подряд вместе с этим ответом. */
  streak: number
}

/** XP за ответ в задании с оценкой FSRS. Ошибка — 0 (без наказания). */
export function answerXp({ correct, newWord, streak }: AnswerXpInput): number {
  if (!correct) return 0
  return XP.correct + (newWord ? XP.newWord : 0) + (streak >= XP.streakFrom ? XP.streakBonus : 0)
}

/** XP за тренировочный ответ (без оценки FSRS). */
export function practiceXp(correct: boolean): number {
  return correct ? XP.practice : 0
}

/** Бонус за завершение урока: +10, без ошибок — ещё +5. */
export function lessonXp(wrong: number, graded: number): number {
  return XP.lesson + (wrong === 0 && graded > 0 ? XP.perfect : 0)
}
