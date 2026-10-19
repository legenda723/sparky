// Дорожка между местами пути (DESIGN.md → «Дорожка пути»): пройденная часть — сплошная цвета колоды, впереди — точки.

export interface RoadPoint {
  /** Сдвиг от середины, px. */
  x: number
  /** От верха дорожки, px. */
  y: number
  /** Путь дошёл до этого места — участок к нему сплошной. */
  reached: boolean
}

/** Плавный изгиб от точки к точке: выходит и входит вертикально. */
function segment(a: RoadPoint, b: RoadPoint): string {
  const mid = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`
}

export function Road({ points, color }: { points: RoadPoint[]; color: string }) {
  const solid: string[] = []
  const dotted: string[] = []
  for (let i = 1; i < points.length; i++) {
    const d = segment(points[i - 1], points[i])
    if (points[i].reached) solid.push(d)
    else dotted.push(d)
  }
  return (
    // Узкая полоска посередине (нулевую ширину браузер не рисует): координаты — сдвиг от центра дорожки, как у самих кружков.
    <svg aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-full w-px overflow-visible">
      {solid.length > 0 && (
        <path d={solid.join(' ')} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={12} strokeLinecap="round" />
      )}
      {dotted.length > 0 && (
        <path d={dotted.join(' ')} fill="none" stroke="var(--c-road)" strokeWidth={8} strokeLinecap="round" strokeDasharray="0 15" />
      )}
    </svg>
  )
}
