// Пружина как в iOS (DESIGN.md → «Движение»): чистые функции, без DOM.
// Пружину заранее просчитываем и отдаём видеокарте готовой кривой `linear(...)` —
// так она идёт 120 кадров (в энергосбережении 60), даже если страница занята или
// iPhone снизил её частоту до 30.

export interface Spring {
  /** «Отклик», с: чем меньше, тем быстрее (как response в SwiftUI) */
  response: number
  /** Затухание: 1 — без отскока, меньше 1 — с отскоком */
  damping: number
}

/** Листы и переходы: быстро трогается и мягко тормозит без отскока. */
export const SPRING_SHEET: Spring = { response: 0.42, damping: 1 }

/** Путь, для которого подобрана SPRING_SHEET (окно подтверждения, ~300 px). */
const SHEET_BASE_PX = 300
/** Самая мягкая пружина — для полноэкранного листа. */
const SHEET_MAX_RESPONSE = 0.56

/**
 * Пружина шторки под длину пути: длинный путь (полноэкранный лист) — чуть мягче,
 * иначе он пролетает экран заметно быстрее короткого окна (отзыв владельца).
 */
export function sheetSpring(distance: number): Spring {
  const k = Math.max(1, Math.abs(distance) / SHEET_BASE_PX) ** 0.25
  return { ...SPRING_SHEET, response: Math.min(SHEET_MAX_RESPONSE, SPRING_SHEET.response * k) }
}

/**
 * Сколько пути ещё осталось (1 → 0) через t секунд. v0 — начальная скорость
 * в долях пути в секунду (к цели — положительная).
 */
export function springRemaining(s: Spring, v0: number, t: number): number {
  const w = (2 * Math.PI) / s.response
  const z = s.damping
  if (z >= 1) return (1 + (w - v0) * t) * Math.exp(-w * t)
  const wd = w * Math.sqrt(1 - z * z)
  return Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w - v0) / wd) * Math.sin(wd * t))
}

export interface SpringCurve {
  /** длительность, мс (0 — двигать нечего) */
  ms: number
  /** CSS-кривая для Web Animations */
  easing: string
}

/** Не дольше этого, даже у очень мягкой пружины. */
const MAX_S = 1.5
/** Точек кривой в секунду: глазу хватает, строка остаётся короткой. */
const POINTS_PER_S = 60

/**
 * Пружина на путь distance (px) с начальной скоростью velocity (px/с, к цели).
 * Конец — когда до цели меньше полупикселя и пружина почти стоит.
 */
export function springCurve(s: Spring, distance: number, velocity = 0): SpringCurve {
  const d = Math.abs(distance)
  if (d < 0.5) return { ms: 0, easing: 'linear' }
  const v0 = velocity / d
  const step = 1 / POINTS_PER_S
  const left = [1]
  let t = step
  for (; t <= MAX_S; t += step) {
    const r = springRemaining(s, v0, t)
    left.push(r)
    const prevR = left[left.length - 2]
    if (Math.abs(r) * d < 0.5 && Math.abs(r - prevR) * d < 0.5) break
  }
  left[left.length - 1] = 0
  const points = left.map((r) => +(1 - r).toFixed(4))
  return { ms: Math.round((left.length - 1) * step * 1000), easing: `linear(${points.join(', ')})` }
}
