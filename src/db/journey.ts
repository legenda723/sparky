// «Твой путь» в «Профиле»: дни с уроками и заморозками из итогов дня (новых полей в базе не нужно).
import type { DayMark } from '../game/calendar'
import type { SparkyDb } from './db'
import { DEFAULT_SETTINGS } from './types'

/** Ключ памяти «Твоего пути» (liveCache). */
export const JOURNEY_KEY = 'journey'

export interface Journey {
  marks: Map<string, DayMark>
  /** Первый день с уроком; нет — уроков ещё не было. */
  firstDay?: string
  /** Дней с уроками. */
  activeDays: number
  goalXp: number
}

export async function loadJourney(db: SparkyDb): Promise<Journey> {
  const [days, settings] = await Promise.all([db.days.toArray(), db.settings.get('me')])
  const marks = new Map<string, DayMark>()
  let firstDay: string | undefined
  let activeDays = 0
  for (const d of days) {
    const done = d.lessons > 0 || !!d.streakDay
    const frozen = d.freezeUsed && !done
    if (!done && !frozen && d.xp <= 0) continue
    marks.set(d.dayKey, { xp: d.xp, lessons: d.lessons, done, frozen })
    if (done) {
      activeDays++
      if (!firstDay || d.dayKey < firstDay) firstDay = d.dayKey
    }
  }
  return { marks, firstDay, activeDays, goalXp: { ...DEFAULT_SETTINGS, ...settings }.dailyGoalXp }
}
