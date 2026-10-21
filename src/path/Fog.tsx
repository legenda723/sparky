// Туман пути (DESIGN.md → «Туман пути»): клубящийся дым как в образце references/туман-PvZ.jpg.
// Готовые картинки (scripts/gen-fog.mjs → src/path/fog/*.webp), никаких живых фильтров и размытия.
// Дым тянется от края до самого низа списка — обрыва не видно. Медленно клубится: два слоя едут вбок
// в разные стороны (только transform). Когда путь открывается дальше, край плавно отступает вниз.
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'

/** Сколько прозрачного края над первым скрытым местом: путь сквозь него чуть проглядывает. */
export const FOG_LEAD = 110

export function Fog({ top }: { top: number }) {
  const reduce = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const prevTop = useRef(top)

  // Край отступает: элемент сразу встаёт на новое место, а видно — как он плавно едет вниз со старого.
  useLayoutEffect(() => {
    const from = prevTop.current
    prevTop.current = top
    const el = ref.current
    if (!el || from === top || reduce) return
    el.animate([{ transform: `translateY(${from - top}px)` }, { transform: 'translateY(0)' }], {
      duration: 1400,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    })
  }, [top, reduce])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute -right-4 bottom-0 -left-4 overflow-hidden" style={{ top: top - FOG_LEAD }}>
      {/* глубина: под дымом путь плавно уходит в фон — дальше двух мест его не видно, обрыва нет */}
      <div className="fog-depth absolute inset-x-0 bottom-0" style={{ top: FOG_LEAD + 10 }} />
      {/* основной дым: край и сплошной дым едут вместе, плитки стыкуются без шва */}
      <div className="fog-drift absolute inset-y-0 left-0 w-[calc(100%+512px)]">
        <div className="fog-edge h-[256px]" />
        <div className="fog-body absolute inset-x-0 top-[256px] bottom-0" />
      </div>
      {/* завитки над краем — едут в другую сторону и чуть покачиваются: дым клубится */}
      <div className="fog-bob absolute inset-x-0 top-0 h-[220px]">
        <div className="fog-drift-back fog-wisp h-full w-[calc(100%+512px)]" />
      </div>
    </div>
  )
}
