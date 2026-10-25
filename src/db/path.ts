// Данные экрана «Путь» (SPEC 7.1): путь и полоса сверху (стрик, цель дня, задания дня).
import { buildPath, type PathModel } from '../game/path'
import type { Quest } from '../game/quests'
import { isDayDone, isStreakAlarm, reconcileStreak, streakWeek, type StreakState, type WeekDay } from '../game/streak'
import { addDays, dayKey, weekday } from '../srs/day'
import { newPerLesson, todayCounts, type TodayCounts } from '../srs/lesson'
import type { SparkyDb } from './db'
import { planFrom, type PlanStatus } from './game'
import { loadLessonInput } from './review'
import { DEFAULT_PROFILE } from './types'

/** Ключ памяти экрана «Путь» (liveCache). */
export const PATH_KEY = 'path'

export interface PathData {
  path: PathModel
  today: TodayCounts
  /** Сколько новых слов помещается в один урок (по размеру урока). */
  newPerLesson: number
  /** Английское слово и перевод — для списка слов пройденного узла. */
  words: Map<string, { front: string; back: string }>
  header: PathHeader
  /** План на сегодня (SPEC 6.5): выполнен ли, есть ли ещё новые слова, сколько повторений добавят «+5 новых». */
  plan: PlanStatus
}

/** Полоса «Пути» (DESIGN.md → «Полоса пути»). */
export interface PathHeader {
  /** Стрик на сегодня (пропуски уже учтены). */
  streak: StreakState
  dayDone: boolean
  /** Вечер, а день не засчитан — огонь тревожится. */
  alarm: boolean
  week: WeekDay[]
  dayXp: number
  goalXp: number
  quests: Quest[]
}

export async function loadHeader(db: SparkyDb, at: Date, goalXp: number): Promise<PathHeader> {
  const today = dayKey(at)
  const monday = addDays(today, -weekday(today))
  const [profile, days, questDay] = await Promise.all([
    db.profile.get('me'),
    db.days.where('dayKey').between(monday, today, true, true).toArray(),
    db.quests.get(today),
  ])
  const p = { ...DEFAULT_PROFILE, ...profile }
  const streak = reconcileStreak(
    { streak: p.streak, bestStreak: p.bestStreak, lastStreakDay: p.lastStreakDay, freezes: p.freezes },
    today,
  ).state
  const marks = new Map<string, 'done' | 'frozen'>()
  for (const d of days) {
    if (d.streakDay) marks.set(d.dayKey, 'done')
    else if (d.freezeUsed) marks.set(d.dayKey, 'frozen')
  }
  return {
    streak,
    dayDone: isDayDone(streak, today),
    alarm: isStreakAlarm(streak, today, at),
    week: streakWeek(today, marks),
    dayXp: days.find((d) => d.dayKey === today)?.xp ?? 0,
    goalXp,
    quests: (questDay?.quests ?? []) as Quest[],
  }
}

/** Путь, что ждёт сегодня и полоса сверху — одним чтением. */
export async function loadPath(db: SparkyDb, at: Date): Promise<PathData> {
  const [decks, input] = await Promise.all([db.decks.orderBy('order').toArray(), loadLessonInput(db, at)])
  const header = await loadHeader(db, at, input.settings.dailyGoalXp)
  return {
    header,
    plan: planFrom(input, at),
    path: buildPath(decks, input.cards),
    today: todayCounts(input.cards, input.deckOrder, at, input.limits),
    newPerLesson: newPerLesson(input.limits.size),
    words: new Map(input.cards.map((c) => [c.id, { front: c.front, back: c.back }])),
  }
}
