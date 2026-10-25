// Игра в базе (SPEC 8.1): конец урока (стрик, уровень, достижения), сверка стрика при открытии
// (заморозки за пропущенные дни), задания дня, «Выучить ещё 5 новых слов».
import { State } from 'ts-fsrs'
import { newAchievements, type Achievement, type AchievementStats } from '../game/achievements'
import { levelInfo } from '../game/progress'
import { pickQuests, updateQuests, type Quest } from '../game/quests'
import { countStreakDay, reconcileStreak, streakFromHistory, type Counted, type StreakState } from '../game/streak'
import { dayKey } from '../srs/day'
import { todayCounts } from '../srs/lesson'
import { MASTERED_DAYS } from '../srs/status'
import { changeDay, dayTables, getDay, questStats } from './day'
import type { SparkyDb } from './db'
import { loadLessonInput } from './review'
import { DEFAULT_PROFILE, type Profile } from './types'

function streakOf(p: Profile): StreakState {
  return { streak: p.streak, bestStreak: p.bestStreak, lastStreakDay: p.lastStreakDay, freezes: p.freezes }
}

/** Пропущенные дни, закрытые заморозками, — отметка в итогах дня (календарь стрика). */
async function markFrozen(db: SparkyDb, keys: string[]): Promise<void> {
  for (const key of keys) await db.days.put({ ...(await getDay(db, key)), freezeUsed: true })
}

export interface FinishInput {
  /** Бонус за завершение (SPEC 8.1). */
  xp?: number
  /** Урок без ошибок в заданиях, которые проверяет приложение. */
  perfect?: boolean
  /** Урок засчитывает день в стрик (тренировка — только когда учить нечего, SPEC 8.1). По умолчанию — да. */
  countsStreak?: boolean
}

export interface FinishResult {
  /** Засчитывание дня; нет — урок день не засчитывает. */
  streak?: Counted
  levelBefore: number
  levelAfter: number
  achievements: Achievement[]
  /** Задания дня после урока. */
  quests: Quest[]
}

/** Всё, по чему решаются достижения. */
async function achievementStats(db: SparkyDb, p: Profile): Promise<AchievementStats> {
  let words = 0
  let mastered = 0
  await db.cards.each((c) => {
    if (c.deletedAt !== undefined) return
    if (c.state !== State.New) words++
    if (c.state === State.Review && c.stability >= MASTERED_DAYS) mastered++
  })
  let lessons = 0
  let perfectLessons = 0
  await db.days.each((d) => {
    lessons += d.lessons
    perfectLessons += d.perfectLessons ?? 0
  })
  return { words, mastered, bestStreak: p.bestStreak, totalXp: p.totalXp, lessons, perfectLessons }
}

/** Урок завершён: +1 урок, бонус XP, день в стрик, новый уровень, достижения — одной транзакцией. */
export async function finishLesson(db: SparkyDb, at: Date, f: FinishInput = {}): Promise<FinishResult> {
  const key = dayKey(at)
  return db.transaction('rw', [db.cards, ...dayTables(db)], async () => {
    await changeDay(db, key, { delta: { lessons: 1, xp: f.xp ?? 0, perfectLessons: f.perfect ? 1 : 0 } })
    let profile = { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }
    let streak: Counted | undefined
    if (f.countsStreak ?? true) {
      streak = countStreakDay(streakOf(profile), key)
      profile = { ...profile, ...streak.state }
      await markFrozen(db, streak.frozen)
      if (streak.counted) await changeDay(db, key, { patch: { streakDay: true } })
    }
    const levelBefore = profile.level
    const levelAfter = Math.max(levelBefore, levelInfo(profile.totalXp).level)
    const achievements = newAchievements(await achievementStats(db, profile), profile.achievements)
    profile = { ...profile, level: levelAfter, achievements: [...profile.achievements, ...achievements.map((a) => a.id)] }
    await db.profile.put(profile)
    const quests = ((await db.quests.get(key))?.quests ?? []) as Quest[]
    return { streak, levelBefore, levelAfter, achievements, quests }
  })
}

export interface Settled {
  /** Дни, которые только что закрыли заморозки. */
  frozen: string[]
  /** Стрик только что сгорел. */
  lost: boolean
}

/**
 * При открытии (и возвращении в приложение): пропущенные дни закрываются заморозками или стрик сгорает.
 * Первый раз после этапа 8 стрик считается по прошлым дням с уроками (до этапа 8 он не считался).
 */
export async function settleDay(db: SparkyDb, at: Date): Promise<Settled> {
  const today = dayKey(at)
  return db.transaction('rw', db.profile, db.days, async () => {
    let profile = { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }
    if (profile.lastStreakDay === undefined && profile.streak === 0) {
      const past = (await db.days.toArray()).filter((d) => d.lessons > 0)
      if (past.length > 0) {
        const s = streakFromHistory(new Set(past.map((d) => d.dayKey)), today, profile.bestStreak)
        profile = { ...profile, ...s }
        for (const d of past) if (!d.streakDay) await db.days.put({ ...d, streakDay: true })
        await db.profile.put(profile)
      }
    }
    const r = reconcileStreak(streakOf(profile), today)
    if (r.frozen.length === 0 && !r.lost) return { frozen: [], lost: false }
    await markFrozen(db, r.frozen)
    await db.profile.put({ ...profile, ...r.state })
    return { frozen: r.frozen, lost: r.lost }
  })
}

/** Задания на сегодня: выбираются один раз за день из выполнимых сегодня; прогресс — по итогам дня. */
export async function ensureQuests(db: SparkyDb, at: Date): Promise<Quest[]> {
  const key = dayKey(at)
  const have = await db.quests.get(key)
  if (have) return have.quests as Quest[]
  const input = await loadLessonInput(db, at)
  const today = todayCounts(input.cards, input.deckOrder, at, input.limits)
  const picked = pickQuests(key, { goalXp: input.settings.dailyGoalXp, newAvailable: today.newAvailable, due: today.due })
  return db.transaction('rw', db.quests, db.days, async () => {
    // Пока выбирали, задания мог создать другой вызов — не перезаписываем.
    const again = await db.quests.get(key)
    if (again) return again.quests as Quest[]
    const quests = updateQuests(picked, questStats(await getDay(db, key)))
    await db.quests.put({ dayKey: key, quests, chestClaimed: false })
    return quests
  })
}

/** «Выучить ещё 5 новых слов» (SPEC 6.5): лимит новых на сегодня выше на n. */
export async function addExtraNew(db: SparkyDb, at: Date, n = 5): Promise<void> {
  const key = dayKey(at)
  await db.transaction('rw', dayTables(db), async () => {
    const day = await getDay(db, key)
    await changeDay(db, key, { patch: { extraNew: (day.extraNew ?? 0) + n } })
  })
}
