// Игра в базе (SPEC 8.1): конец урока (стрик, уровень, достижения), сверка стрика при открытии
// (заморозки за пропущенные дни), задания дня, «Выучить ещё 5 новых слов».
import { State } from 'ts-fsrs'
import type { LessonTarget } from '../app/routes'
import { newAchievements, type Achievement, type AchievementStats } from '../game/achievements'
import { buildPath } from '../game/path'
import { levelInfo } from '../game/progress'
import { activeQuests, pickQuests, updateQuests, type Quest } from '../game/quests'
import { countStreakDay, reconcileStreak, streakFromHistory, type Counted, type StreakState } from '../game/streak'
import { dayKey } from '../srs/day'
import { extraReviewsEstimate } from '../srs/forecast'
import { todayCounts } from '../srs/lesson'
import { cardStatus, MASTERED_DAYS } from '../srs/status'
import { changeDay, dayTables, getDay, questStats } from './day'
import type { SparkyDb } from './db'
import { loadLessonInput, type LessonInput } from './review'
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
  /** Тренировка — не урок: не идёт в счёт уроков (задание «Пройди 2 урока», значки за уроки). */
  training?: boolean
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

/**
 * Стрик до этапа 8 не считался: первый раз он считается по прошлым дням с уроками.
 * Потом lastStreakDay уже есть — пересчёта нет. Вызывать внутри транзакции с profile и days.
 */
async function streakFromPast(db: SparkyDb, profile: Profile, today: string): Promise<Profile> {
  if (profile.lastStreakDay !== undefined || profile.streak !== 0) return profile
  const past = (await db.days.toArray()).filter((d) => d.lessons > 0)
  if (past.length === 0) return profile
  const next = { ...profile, ...streakFromHistory(new Set(past.map((d) => d.dayKey)), today, profile.bestStreak) }
  for (const d of past) if (!d.streakDay) await db.days.put({ ...d, streakDay: true })
  await db.profile.put(next)
  return next
}

/** Урок завершён: +1 урок, бонус XP, день в стрик, новый уровень, достижения — одной транзакцией. */
export async function finishLesson(db: SparkyDb, at: Date, f: FinishInput = {}): Promise<FinishResult> {
  const key = dayKey(at)
  return db.transaction('rw', [db.cards, ...dayTables(db)], async () => {
    // Прошлые дни — до записи этого урока, чтобы сегодняшний засчитался праздником «Стрик +1».
    await streakFromPast(db, { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }, key)
    await changeDay(db, key, { delta: { lessons: f.training ? 0 : 1, xp: f.xp ?? 0, perfectLessons: f.perfect ? 1 : 0 } })
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
    const quests = activeQuests(((await db.quests.get(key))?.quests ?? []) as Quest[])
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
    const profile = await streakFromPast(db, { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }, today)
    const r = reconcileStreak(streakOf(profile), today)
    if (r.frozen.length === 0 && !r.lost) return { frozen: [], lost: false }
    await markFrozen(db, r.frozen)
    await db.profile.put({ ...profile, ...r.state })
    return { frozen: r.frozen, lost: r.lost }
  })
}

/**
 * Задания на сегодня: выбираются один раз за день из выполнимых сегодня; прогресс — по итогам дня.
 * Старое «Набери XP» (записи до 2026-10-27) остаётся в базе, но не возвращается.
 */
export async function ensureQuests(db: SparkyDb, at: Date): Promise<Quest[]> {
  const key = dayKey(at)
  const have = await db.quests.get(key)
  if (have) return activeQuests(have.quests as Quest[])
  const input = await loadLessonInput(db, at)
  const today = todayCounts(input.cards, input.deckOrder, at, input.limits)
  const picked = pickQuests(key, { newAvailable: today.newAvailable, due: today.due, lessonSize: input.limits.size })
  return db.transaction('rw', db.quests, db.days, async () => {
    // Пока выбирали, задания мог создать другой вызов — не перезаписываем.
    const again = await db.quests.get(key)
    if (again) return activeQuests(again.quests as Quest[])
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

/** «План на сегодня выполнен» (SPEC 6.5): повторять нечего и новые на сегодня кончились. */
export interface PlanStatus {
  done: boolean
  /** Новых слов в колодах вообще (без дневного лимита) — есть ли смысл в «+5 новых». */
  freshLeft: number
  /** Сколько примерно повторений за неделю добавят 5 новых слов (с запасом на «Снова»). */
  extraEstimate: number
  /** Знакомых слов (есть что тренировать). */
  known: number
}

/** План на сегодня — по уже загруженным словам и лимитам. */
export function planFrom(input: LessonInput, at: Date): PlanStatus {
  const today = todayCounts(input.cards, input.deckOrder, at, input.limits)
  const freshLeft = input.cards.filter((c) => c.state === State.New && !c.suspended).length
  return {
    done: today.due === 0 && today.newAvailable === 0,
    freshLeft,
    extraEstimate: extraReviewsEstimate(Math.min(5, freshLeft), at, input.settings.retention),
    known: input.cards.filter((c) => c.state !== State.New && !c.suspended).length,
  }
}

export async function planStatus(db: SparkyDb, at: Date): Promise<PlanStatus> {
  return planFrom(await loadLessonInput(db, at), at)
}

/** Экран «План выполнен» после урока — один раз за день: если план выполнен и экрана сегодня ещё не было. */
export async function claimPlanScreen(db: SparkyDb, at: Date): Promise<PlanStatus | null> {
  const status = await planStatus(db, at)
  if (!status.done) return null
  const key = dayKey(at)
  return db.transaction('rw', dayTables(db), async () => {
    if ((await getDay(db, key)).planShown) return null
    await changeDay(db, key, { patch: { planShown: true } })
    return status
  })
}

/** «Выучить ещё 5 новых слов»: лимит выше — и сразу урок текущего узла (его новые слова). Нет узла — null. */
export async function moreNewWords(db: SparkyDb, at: Date): Promise<LessonTarget | null> {
  await addExtraNew(db, at)
  const [decks, input] = await Promise.all([db.decks.toArray(), loadLessonInput(db, at)])
  const cur = buildPath(decks, input.cards).current
  return cur ? { kind: 'node', index: cur.index } : null
}

/** Ключ памяти игровой части «Профиля» (liveCache). */
export const PROFILE_GAME_KEY = 'profile-game'

/** «Профиль» (SPEC 7.5): имя и фото, уровень, стрик, слова, достижения. */
export interface ProfileGame {
  name: string
  avatar?: Blob
  totalXp: number
  streak: number
  bestStreak: number
  /** Слова в состояниях «знаю» и «освоены» (как фильтры колоды, SPEC 7.3). */
  knownWords: number
  achievements: string[]
}

export async function loadProfileGame(db: SparkyDb, at: Date): Promise<ProfileGame> {
  const p = { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }
  let knownWords = 0
  await db.cards.each((c) => {
    const s = cardStatus(c)
    if (c.deletedAt === undefined && (s === 'known' || s === 'mastered')) knownWords++
  })
  return {
    name: p.name,
    avatar: p.avatarId ? (await db.media.get(p.avatarId))?.blob : undefined,
    totalXp: p.totalXp,
    streak: reconcileStreak(streakOf(p), dayKey(at)).state.streak,
    bestStreak: p.bestStreak,
    knownWords,
    achievements: p.achievements,
  }
}

