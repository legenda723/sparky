// Стрик (SPEC 8.1): дни подряд с уроком, заморозки за пропуски, отметки. Чистые функции.
// Дни — ключи dayKey (день начинается в 04:00), поэтому урок в 01:30 ночи засчитывается во вчерашний день.
import { addDays, daysBetween, weekday } from '../srs/day'

/** Отметки стрика — праздник. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const
/** Каждые 7 дней стрика подряд — +1 заморозка (решение владельца: заморозки не покупаются). */
export const FREEZE_EVERY = 7
/** Больше двух заморозок в запасе не бывает. */
export const FREEZE_MAX = 2
/** С 20:00, пока день не засчитан, огонь тревожно покачивается. */
export const ALARM_HOUR = 20

export interface StreakState {
  streak: number
  bestStreak: number
  /** Последний день, который держит стрик: засчитанный или закрытый заморозкой. */
  lastStreakDay?: string
  freezes: number
}

export interface Reconciled {
  state: StreakState
  /** Пропущенные дни, закрытые заморозками (по порядку). */
  frozen: string[]
  /** Стрик сгорел: пропусков больше, чем заморозок. */
  lost: boolean
}

/**
 * Пропущенные дни до сегодняшнего: хватает заморозок — они тратятся сами, по одной за день, и стрик живёт
 * (замороженные дни его не увеличивают); не хватает — стрик сгорает, заморозки остаются.
 * Сегодняшний день не пропущен — он ещё идёт.
 */
export function reconcileStreak(s: StreakState, today: string): Reconciled {
  if (!s.lastStreakDay || s.streak === 0) return { state: s, frozen: [], lost: false }
  const missed = daysBetween(s.lastStreakDay, today) - 1
  if (missed <= 0) return { state: s, frozen: [], lost: false }
  if (missed > s.freezes) return { state: { ...s, streak: 0 }, frozen: [], lost: true }
  const frozen = Array.from({ length: missed }, (_, i) => addDays(s.lastStreakDay!, i + 1))
  return { state: { ...s, freezes: s.freezes - missed, lastStreakDay: frozen.at(-1) }, frozen, lost: false }
}

export interface Counted extends Reconciled {
  /** День засчитан только что (первый урок за день). */
  counted: boolean
  /** Достигнута отметка 3, 7, 14… */
  milestone?: number
  /** За эти 7 дней подряд добавилась заморозка. */
  freezeEarned: boolean
}

/** Засчитать сегодняшний день (завершён урок). Второй урок за тот же день ничего не меняет. */
export function countStreakDay(s: StreakState, today: string): Counted {
  const r = reconcileStreak(s, today)
  const st = r.state
  if (st.lastStreakDay === today) return { ...r, counted: false, freezeEarned: false }
  const continues = st.streak > 0 && st.lastStreakDay === addDays(today, -1)
  const streak = continues ? st.streak + 1 : 1
  const freezeEarned = streak % FREEZE_EVERY === 0 && st.freezes < FREEZE_MAX
  const milestone = (STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : undefined
  return {
    ...r,
    state: {
      streak,
      bestStreak: Math.max(st.bestStreak, streak),
      lastStreakDay: today,
      freezes: st.freezes + (freezeEarned ? 1 : 0),
    },
    counted: true,
    milestone,
    freezeEarned,
  }
}

/** Сегодняшний день уже засчитан. */
export function isDayDone(s: StreakState, today: string): boolean {
  return s.streak > 0 && s.lastStreakDay === today
}

/** Тревожный огонь: вечер (с 20:00 и до конца дня в 04:00), а день не засчитан. Без стрика тревожиться не о чем. */
export function isStreakAlarm(s: StreakState, today: string, now: Date): boolean {
  const h = now.getHours()
  return reconcileStreak(s, today).state.streak > 0 && !isDayDone(s, today) && (h >= ALARM_HOUR || h < 4)
}

export type WeekDayState = 'done' | 'frozen' | 'missed' | 'today' | 'future'

export interface WeekDay {
  key: string
  /** «Пн» … «Вс». */
  label: string
  state: WeekDayState
}

const LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * Неделя с понедельника для календаря стрика. marks — засчитанные и замороженные дни.
 * Сегодня — «done», если уже засчитан, иначе «today».
 */
export function streakWeek(today: string, marks: ReadonlyMap<string, 'done' | 'frozen'>): WeekDay[] {
  const monday = addDays(today, -weekday(today))
  return LABELS.map((label, i) => {
    const key = addDays(monday, i)
    const mark = marks.get(key)
    const state: WeekDayState =
      key > today ? 'future' : mark ?? (key === today ? 'today' : 'missed')
    return { key, label, state }
  })
}
