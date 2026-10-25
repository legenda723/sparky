// «Календарь пути» в «Профиле» (DESIGN.md → «Календарь пути»): месяцы, сетка дней, насыщенность по XP, полоска стрика.
// Дни — ключи dayKey (день начинается в 04:00). Чистые функции.
import { addDays, daysBetween, weekday } from '../srs/day'
import { plural } from '../srs/status'

/** Что было в день (из итогов дня). */
export interface DayMark {
  xp: number
  lessons: number
  /** Засчитан в стрик или был урок. */
  done: boolean
  /** Закрыт заморозкой. */
  frozen: boolean
}

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** «2026-10-23» → «2026-10». */
export function monthOf(key: string): string {
  return key.slice(0, 7)
}

/** «2026-10» → «Октябрь 2026». */
export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Месяцы от первого с уроками до текущего (уроков не было — только текущий). */
export function monthsFrom(firstDay: string | undefined, today: string): string[] {
  const end = monthOf(today)
  let [y, m] = monthOf(firstDay && firstDay < today ? firstDay : today).split('-').map(Number)
  const out: string[] = []
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= end) return out
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
}

/** Сетка месяца: 6 недель × 7 дней с понедельника; дни чужих месяцев — null. */
export function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`
  const start = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, i) => {
    const key = addDays(start, i)
    return monthOf(key) === month ? key : null
  })
}

/** Насыщенность дня с уроком: 1 — меньше половины цели, 2 — до цели, 3 — цель выполнена. */
export function intensity(xp: number, goal: number): 1 | 2 | 3 {
  if (xp >= goal) return 3
  return xp >= goal / 2 ? 2 : 1
}

/** День держит стрик (урок или заморозка) — его соединяет полоска. */
export function keeps(m: DayMark | undefined): boolean {
  return !!m && (m.done || m.frozen)
}

/** Полоска стрика у ячейки: к соседу слева и справа в той же строке. */
export function bandSides(cells: (string | null)[], i: number, marks: ReadonlyMap<string, DayMark>): { left: boolean; right: boolean } {
  const at = (j: number) => {
    const k = cells[j]
    return k ? keeps(marks.get(k)) : false
  }
  if (!at(i)) return { left: false, right: false }
  const col = i % 7
  return { left: col > 0 && at(i - 1), right: col < 6 && at(i + 1) }
}

/** Всплывашка дня: «23 окт · 45 XP · 2 урока». */
export function dayLabel(key: string, today: string, m: DayMark | undefined): string {
  const [, mm, dd] = key.split('-').map(Number)
  const date = key === today ? 'Сегодня' : `${dd} ${MONTH_SHORT[mm - 1]}`
  if (m?.lessons) return `${date} · ${m.xp} XP · ${m.lessons} ${plural(m.lessons, 'урок', 'урока', 'уроков')}`
  if (m && m.xp > 0) return `${date} · ${m.xp} XP · тренировка`
  if (m?.frozen) return `${date} · заморозка ❄️`
  return key === today ? `${date} · пока без занятий` : `${date} · без занятий`
}

/** Сколько дней прошло с первого урока (0 — сегодня первый). */
export function daysSince(firstDay: string, today: string): number {
  return Math.max(0, daysBetween(firstDay, today))
}
