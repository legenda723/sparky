// Очки опыта (SPEC 8.1). Чистые функции.

export const XP = {
  /** Верный ответ. */
  correct: 2,
  /** Новое слово выучено: первый верный ответ после знакомства. */
  newWord: 3,
  /** Урок завершён. */
  lesson: 10,
  /** Идеальный урок — без ошибок в заданиях, которые проверяет приложение. */
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
  /**
   * Оценку поставил сам владелец (карточка с переворотом): XP одинаковый при любой оценке и без бонуса серии —
   * чтобы награда не тянула нажать кнопку получше (решение владельца, SPEC 8.1).
   */
  selfGraded?: boolean
}

/** XP за ответ в задании с оценкой FSRS. Ошибка в проверяемом задании — 0 (без наказания). */
export function answerXp({ correct, newWord, streak, selfGraded }: AnswerXpInput): number {
  if (selfGraded) return XP.correct + (newWord ? XP.newWord : 0)
  if (!correct) return 0
  return XP.correct + (newWord ? XP.newWord : 0) + (streak >= XP.streakFrom ? XP.streakBonus : 0)
}

/** XP за тренировочный ответ (без оценки FSRS). */
export function practiceXp(correct: boolean): number {
  return correct ? XP.practice : 0
}

/** Урок идеальный: были задания, которые проверяет приложение, и ни одной ошибки в них. */
export function isPerfect(checkedWrong: number, checked: number): boolean {
  return checked > 0 && checkedWrong === 0
}

/** Бонус за завершение урока: +10, идеальный — ещё +5 (считаются только задания, которые проверяет приложение). */
export function lessonXp(checkedWrong: number, checked: number): number {
  return XP.lesson + (isPerfect(checkedWrong, checked) ? XP.perfect : 0)
}

/** Тренировка (SPEC 6.5): бонус за завершение — вдвое меньше. */
export function trainingLessonXp(checkedWrong: number, checked: number): number {
  return Math.floor(lessonXp(checkedWrong, checked) / 2)
}
