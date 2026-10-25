// Итоги дня (таблица days) и всё, что от них зависит, — в той же транзакции, что и ответ:
// XP в профиле, отметка «цель дня выполнена», прогресс ежедневных заданий (SPEC 5, 8.1).
import { updateQuests, type Quest, type QuestDayStats } from '../game/quests'
import type { SparkyDb } from './db'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type DayRecord } from './types'

export function emptyDay(key: string): DayRecord {
  return {
    dayKey: key,
    xp: 0,
    lessons: 0,
    reviews: 0,
    newLearned: 0,
    correct: 0,
    wrong: 0,
    msSpent: 0,
    goalMet: false,
    freezeUsed: false,
    bestCombo: 0,
    perfectLessons: 0,
    streakDay: false,
    extraNew: 0,
    planShown: false,
  }
}

/** Запись дня; в старых записях (до этапа 8) новых полей нет — дополняем значениями по умолчанию. */
export async function getDay(db: SparkyDb, key: string): Promise<DayRecord> {
  return { ...emptyDay(key), ...(await db.days.get(key)) }
}

/** Таблицы, которые трогает запись итогов дня, — их берёт каждая транзакция ответа. */
export function dayTables(db: SparkyDb) {
  return [db.days, db.profile, db.quests, db.settings]
}

export type DayDelta = Partial<
  Pick<DayRecord, 'xp' | 'lessons' | 'reviews' | 'newLearned' | 'correct' | 'wrong' | 'msSpent' | 'perfectLessons'>
>

export function questStats(d: DayRecord): QuestDayStats {
  return {
    xp: d.xp,
    reviews: d.reviews,
    newLearned: d.newLearned,
    lessons: d.lessons,
    perfectLessons: d.perfectLessons ?? 0,
    bestCombo: d.bestCombo ?? 0,
    msSpent: d.msSpent,
  }
}

/** Прогресс заданий дня — по свежим итогам (если задания на этот день уже выбраны). */
async function syncQuests(db: SparkyDb, day: DayRecord): Promise<void> {
  const q = await db.quests.get(day.dayKey)
  if (q) await db.quests.put({ ...q, quests: updateQuests(q.quests as Quest[], questStats(day)) })
}

export interface DayChange {
  delta?: DayDelta
  /** -1 — откатить (отмена оценки). */
  sign?: 1 | -1
  /** Серия в уроке после этого ответа — лучшая серия дня растёт. */
  combo?: number
  /** Отмена: лучшая серия дня — как была до ответа. */
  restoreCombo?: number
  /** Ещё правки записи дня (засчитан в стрик, «+5 новых»). */
  patch?: Partial<DayRecord>
}

/** Меняет итоги дня и всё, что от них зависит. Вызывать внутри транзакции с dayTables. */
export async function changeDay(db: SparkyDb, key: string, c: DayChange): Promise<DayRecord> {
  const sign = c.sign ?? 1
  const day = await getDay(db, key)
  for (const [k, v] of Object.entries(c.delta ?? {}) as [keyof DayDelta, number][]) {
    day[k] = Math.max(0, (day[k] ?? 0) + sign * v)
  }
  if (c.combo !== undefined) day.bestCombo = Math.max(day.bestCombo ?? 0, c.combo)
  if (c.restoreCombo !== undefined) day.bestCombo = c.restoreCombo
  Object.assign(day, c.patch)
  const settings = { ...DEFAULT_SETTINGS, ...(await db.settings.get('me')) }
  day.goalMet = day.xp >= settings.dailyGoalXp
  await db.days.put(day)
  // XP копится и в профиле (всего XP).
  if (c.delta?.xp) {
    const profile = (await db.profile.get('me')) ?? DEFAULT_PROFILE
    await db.profile.put({ ...profile, totalXp: Math.max(0, profile.totalXp + sign * c.delta.xp) })
  }
  await syncQuests(db, day)
  return day
}
