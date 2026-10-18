// Дни приложения: день начинается в 04:00 по местному времени (как в Anki, SPEC → раздел 5).
// Вся логика дат — только через эти функции.

export const DAY_START_HOUR = 4

/** Ключ дня «ГГГГ-ММ-ДД»: в 01:30 ночи — ещё вчерашний день. */
export function dayKey(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (date.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Начало дня приложения (04:00), в который попадает дата. */
export function dayStart(date: Date): Date {
  const [y, m, d] = dayKey(date).split('-').map(Number)
  return new Date(y, m - 1, d, DAY_START_HOUR)
}

/** Начало следующего дня приложения (завтра в 04:00). */
export function nextDayStart(date: Date): Date {
  const start = dayStart(date)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, DAY_START_HOUR)
}
