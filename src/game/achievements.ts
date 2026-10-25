// Достижения (SPEC 8.1): ~12 значков, выдаются раз и навсегда. Без кристаллов — только праздник.

/** Всё, по чему решаются достижения (считается по базе в конце урока). */
export interface AchievementStats {
  /** Слов прошли знакомство. */
  words: number
  /** Слов освоено (стабильность ≥ 21 дня). */
  mastered: number
  bestStreak: number
  totalXp: number
  lessons: number
  perfectLessons: number
}

export interface Achievement {
  id: string
  emoji: string
  title: string
  /** За что. */
  text: string
  done: (s: AchievementStats) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-word', emoji: '🌱', title: 'Первое слово', text: 'Выучи первое слово', done: (s) => s.words >= 1 },
  { id: 'first-lesson', emoji: '🎒', title: 'Первый урок', text: 'Пройди первый урок', done: (s) => s.lessons >= 1 },
  { id: 'words-50', emoji: '📗', title: '50 слов', text: 'Выучи 50 слов', done: (s) => s.words >= 50 },
  { id: 'words-100', emoji: '📚', title: '100 слов', text: 'Выучи 100 слов', done: (s) => s.words >= 100 },
  { id: 'words-500', emoji: '🏛️', title: '500 слов', text: 'Выучи 500 слов', done: (s) => s.words >= 500 },
  { id: 'mastered-1', emoji: '👑', title: 'Освоено!', text: 'Освой первое слово — помнишь его 3 недели', done: (s) => s.mastered >= 1 },
  { id: 'mastered-50', emoji: '🧠', title: 'Крепкая память', text: 'Освой 50 слов', done: (s) => s.mastered >= 50 },
  { id: 'streak-7', emoji: '🔥', title: 'Неделя подряд', text: 'Занимайся 7 дней подряд', done: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', emoji: '☄️', title: 'Месяц подряд', text: 'Занимайся 30 дней подряд', done: (s) => s.bestStreak >= 30 },
  { id: 'xp-1000', emoji: '⚡', title: '1000 XP', text: 'Набери 1000 XP', done: (s) => s.totalXp >= 1000 },
  { id: 'xp-5000', emoji: '🌟', title: '5000 XP', text: 'Набери 5000 XP', done: (s) => s.totalXp >= 5000 },
  { id: 'perfect-10', emoji: '🎯', title: 'Без ошибок', text: 'Пройди 10 уроков без ошибок', done: (s) => s.perfectLessons >= 10 },
  { id: 'lessons-100', emoji: '🏆', title: '100 уроков', text: 'Пройди 100 уроков', done: (s) => s.lessons >= 100 },
]

/** Новые достижения: выполнены, а в профиле их ещё нет. */
export function newAchievements(stats: AchievementStats, have: readonly string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id) && a.done(stats))
}
