// Дорожка между местами пути (DESIGN.md → «Дорожка пути»): по три маленьких серых кружочка в каждом
// промежутке — по плавной кривой от места к месту, только в свободном месте между ними.

export interface RoadPoint {
  /** Сдвиг от середины, px. */
  x: number
  /** От верха дорожки, px. */
  y: number
  /** Сколько px над центром места занято (кружок, кольцо, пузырь «НАЧАТЬ»). */
  clearTop: number
  /** Сколько px под центром места занято (кружок с тенью, кольцо). */
  clearBottom: number
}

/** Кружочков в промежутке. */
const DOTS = 3
const DOT_R = 3.5

/** Точка на плавном изгибе от a к b (выходит и входит вертикально), t — 0..1. */
function at(a: RoadPoint, b: RoadPoint, t: number): { x: number; y: number } {
  const mid = (a.y + b.y) / 2
  const u = 1 - t
  const x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x
  const y = u * u * u * a.y + 3 * u * u * t * mid + 3 * u * t * t * mid + t * t * t * b.y
  return { x, y }
}

/** t, при котором изгиб на высоте y (по высоте он идёт монотонно). */
function tAtY(a: RoadPoint, b: RoadPoint, y: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (at(a, b, m).y < y) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

export function Road({ points }: { points: RoadPoint[] }) {
  const dots: { x: number; y: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const from = a.y + a.clearBottom
    const to = b.y - b.clearTop
    if (to - from < DOT_R * 4) continue
    // три кружочка поровну в свободном промежутке
    for (let k = 1; k <= DOTS; k++) {
      const y = from + ((to - from) * k) / (DOTS + 1)
      dots.push(at(a, b, tAtY(a, b, y)))
    }
  }
  return (
    // Узкая полоска посередине (нулевую ширину браузер не рисует): координаты — сдвиг от центра дорожки, как у самих мест.
    <svg aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-full w-px overflow-visible">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={DOT_R} fill="var(--c-road)" />
      ))}
    </svg>
  )
}
