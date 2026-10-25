import { describe, expect, it } from 'vitest'
import { extraReviewsEstimate } from '../srs/forecast'
import { ACHIEVEMENTS, newAchievements, type AchievementStats } from './achievements'
import { lessonCelebrations, type LessonEvents } from './celebrate'
import { pickQuests, questNews, questTitle, updateQuests, type QuestDayStats } from './quests'
import { countStreakDay } from './streak'

const day = (d: Partial<QuestDayStats> = {}): QuestDayStats => ({
  xp: 0,
  reviews: 0,
  newLearned: 0,
  lessons: 0,
  perfectLessons: 0,
  bestCombo: 0,
  msSpent: 0,
  ...d,
})

const rich = { goalXp: 50, newAvailable: 10, due: 30 }

describe('задания дня (8.1)', () => {
  it('три разных задания, первое — «Набери XP» по цели дня; для одного дня — всегда те же', () => {
    const q = pickQuests('2026-10-25', rich)
    expect(q).toHaveLength(3)
    expect(q[0]).toEqual({ kind: 'xp', target: 50, progress: 0, done: false })
    expect(new Set(q.map((x) => x.kind)).size).toBe(3)
    expect(pickQuests('2026-10-25', rich)).toEqual(q)
  })

  it('в разные дни набор меняется', () => {
    const sets = new Set(Array.from({ length: 10 }, (_, i) => pickQuests(`2026-11-${10 + i}`, rich).map((x) => x.kind).join()))
    expect(sets.size).toBeGreaterThan(1)
  })

  it('невыполнимого не бывает: нет новых слов — нет «Выучи новые», нечего повторять — нет «Повтори»', () => {
    for (let i = 0; i < 30; i++) {
      const kinds = pickQuests(`2026-12-${String(i + 1).padStart(2, '0')}`, { goalXp: 20, newAvailable: 0, due: 0 }).map((x) => x.kind)
      expect(kinds).not.toContain('newWords')
      expect(kinds).not.toContain('reviews')
      expect(kinds).not.toContain('combo')
      expect(kinds).not.toContain('perfect')
    }
  })

  it('цели по силам: новых 3 — «Выучи 3 новых слова», повторений 12 — «Повтори 10 слов»', () => {
    const all = Array.from({ length: 40 }, (_, i) => pickQuests(`2027-01-${i}`, { goalXp: 50, newAvailable: 3, due: 12 })).flat()
    expect(all.find((q) => q.kind === 'newWords')?.target).toBe(3)
    expect(all.find((q) => q.kind === 'reviews')?.target).toBe(10)
    expect(questTitle({ kind: 'newWords', target: 3 })).toBe('Выучи 3 новых слова')
    expect(questTitle({ kind: 'newWords', target: 5 })).toBe('Выучи 5 новых слов')
  })

  it('прогресс — по итогам дня, не больше цели; отмена оценки возвращает его назад', () => {
    const q = [
      { kind: 'xp' as const, target: 50, progress: 0, done: false },
      { kind: 'combo' as const, target: 10, progress: 0, done: false },
      { kind: 'minutes' as const, target: 10, progress: 0, done: false },
    ]
    const a = updateQuests(q, day({ xp: 62, bestCombo: 4, msSpent: 9 * 60_000 + 59_000 }))
    expect(a.map((x) => [x.progress, x.done])).toEqual([
      [50, true],
      [4, false],
      [9, false],
    ])
    const b = updateQuests(a, day({ xp: 48, bestCombo: 4, msSpent: 9 * 60_000 }))
    expect(b[0]).toMatchObject({ progress: 48, done: false })
  })

  it('что выполнилось за урок; все три — праздник побольше', () => {
    const base = pickQuests('2026-10-25', rich)
    const before = base.map((q, i) => ({ ...q, done: i === 0 }))
    const after = base.map((q) => ({ ...q, done: true }))
    expect(questNews(before, after)).toEqual({ done: after.slice(1), all: true })
    expect(questNews(after, after)).toEqual({ done: [], all: false })
  })
})

const zero: AchievementStats = { words: 0, mastered: 0, bestStreak: 0, totalXp: 0, lessons: 0, perfectLessons: 0 }

describe('достижения (8.1)', () => {
  it('около 12 значков, у каждого свой id', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
  it('выдаются по порогам и только один раз', () => {
    expect(newAchievements(zero, [])).toEqual([])
    const first = newAchievements({ ...zero, words: 5, lessons: 1 }, [])
    expect(first.map((a) => a.id)).toEqual(['first-word', 'first-lesson'])
    expect(newAchievements({ ...zero, words: 5, lessons: 1 }, ['first-word', 'first-lesson'])).toEqual([])
    const ids = newAchievements({ words: 120, mastered: 1, bestStreak: 7, totalXp: 1000, lessons: 30, perfectLessons: 10 }, []).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['words-100', 'mastered-1', 'streak-7', 'xp-1000', 'perfect-10']))
    expect(ids).not.toContain('words-500')
  })
})

describe('праздники после урока', () => {
  const none: LessonEvents = { quests: { done: [], all: false }, levelBefore: 2, levelAfter: 2, achievements: [] }

  it('первый урок за день — «Стрик +1»; второй в тот же день — ничего лишнего', () => {
    const first = countStreakDay({ streak: 3, bestStreak: 3, lastStreakDay: '2026-10-24', freezes: 0 }, '2026-10-25')
    expect(lessonCelebrations({ ...none, streak: first })).toEqual([
      { kind: 'streak', streak: 4, milestone: undefined, freezeEarned: false, freezes: 0 },
    ])
    const second = countStreakDay(first.state, '2026-10-25')
    expect(lessonCelebrations({ ...none, streak: second })).toEqual([])
  })

  it('порядок: задания → стрик (с отметкой) → уровень → достижения', () => {
    const streak = countStreakDay({ streak: 6, bestStreak: 6, lastStreakDay: '2026-10-24', freezes: 0 }, '2026-10-25')
    const quest = { kind: 'xp' as const, target: 50, progress: 50, done: true }
    const ach = ACHIEVEMENTS.filter((a) => a.id === 'streak-7')
    const list = lessonCelebrations({ quests: { done: [quest], all: false }, streak, levelBefore: 2, levelAfter: 3, achievements: ach })
    expect(list.map((c) => c.kind)).toEqual(['quests', 'streak', 'level', 'achievements'])
    expect(list[1]).toMatchObject({ streak: 7, milestone: 7, freezeEarned: true, freezes: 1 })
    expect(list[2]).toEqual({ kind: 'level', level: 3 })
  })

  it('тренировка, которая день не засчитывает, стрик не празднует', () => {
    expect(lessonCelebrations({ ...none, streak: undefined })).toEqual([])
  })
})

describe('«Выучить ещё 5 новых слов»: сколько повторений добавится', () => {
  const at = new Date(2026, 9, 25, 15, 0)
  it('с запасом на «Снова»: 5 новых слов — около 10 повторений за неделю, число стабильное', () => {
    // Все «Хорошо» — 1 показ на слово за неделю; забытое на первом повторении — 4 показа; забывается 3 из 10.
    expect(extraReviewsEstimate(5, at, 0.9)).toBe(10)
    expect(extraReviewsEstimate(5, at, 0.9)).toBe(extraReviewsEstimate(5, at, 0.9))
    // С запасом — больше, чем если бы всё было «Хорошо» (1 на слово).
    expect(extraReviewsEstimate(5, at, 0.9)).toBeGreaterThan(5)
  })
  it('чем выше желаемая память — тем повторений не меньше', () => {
    expect(extraReviewsEstimate(5, at, 0.95)).toBeGreaterThanOrEqual(extraReviewsEstimate(5, at, 0.85))
  })
})
