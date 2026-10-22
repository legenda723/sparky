// Туман пути (DESIGN.md → «Туман пути»): клубящийся дым как в образце references/туман-PvZ.jpg.
// Готовые картинки (scripts/gen-fog.mjs → src/path/fog/*.webp), никаких живых фильтров и размытия.
// Дым тянется от края до самого низа списка — обрыва не видно. Медленно клубится: два слоя едут вбок
// в разные стороны (только transform). Когда путь открывается дальше, край плавно отступает вниз.
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Сколько прозрачного края над первым скрытым местом: путь сквозь него чуть проглядывает. */
export const FOG_LEAD = 110
/** Высота картинки края; сплошной дым начинается сразу под ней. */
const FOG_EDGE = 256
/** Нижние px тумана в пути растворяются в его продолжение под путём (тот же рисунок, то же место — шва нет). */
const FOG_JOIN = 20
const join = `linear-gradient(to bottom, #000 calc(100% - ${FOG_JOIN}px), transparent)`

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
    <div
      ref={ref}
      aria-hidden
      data-fog
      className="pointer-events-none absolute -right-4 bottom-0 -left-4 overflow-hidden"
      style={{ top: top - FOG_LEAD, maskImage: join, WebkitMaskImage: join }}
    >
      {/* глубина: под дымом путь плавно уходит в фон — дальше двух мест его не видно, обрыва нет */}
      <div className="fog-depth absolute inset-x-0 bottom-0" style={{ top: FOG_LEAD + 10 }} />
      {/* основной дым: край и сплошной дым едут вместе, плитки стыкуются без шва */}
      <div className="fog-drift absolute inset-y-0 left-0 w-[calc(100%+512px)]">
        <div className="fog-edge" style={{ height: FOG_EDGE }} />
        <div className="fog-body absolute inset-x-0 bottom-0" style={{ top: FOG_EDGE }} />
      </div>
      {/* завитки над краем — едут в другую сторону и чуть покачиваются: дым клубится */}
      <div className="fog-bob absolute inset-x-0 top-0 h-[220px]">
        <div className="fog-drift-back fog-wisp h-full w-[calc(100%+512px)]" />
      </div>
    </div>
  )
}

/** Сколько продолжения дыма прячется под концом пути (за непрозрачным содержимым), px. */
const BELOW_HIDDEN = 300
/** Сколько продолжения дыма ниже конца пути — больше, чем можно оттянуть «резинкой», px. */
const BELOW_EXTRA = 900

/**
 * Продолжение тумана под путём — для «резинки» (useRubberBand): оттягиваешь путь вверх, а снизу тянется тот же дым.
 * Лежит под прокруткой; trackRef двигает useRubberBand — вместе с путём, в том же кадре. Рисунок и клубление —
 * ровно как у тумана в пути (тот же сдвиг плитки, та же анимация с той же точки): одно полотно, а не второе окно.
 * Пока путь не оттянут, продолжение закрыто непрозрачным содержимым.
 */
export function FogBelow({
  scrollRef,
  listRef,
  trackRef,
  top,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  listRef: RefObject<HTMLDivElement | null>
  trackRef: RefObject<HTMLDivElement | null>
  top: number
}) {
  const driftRef = useRef<HTMLDivElement>(null)

  // Место и сдвиг рисунка: как у сплошного дыма в пути. Пересчёт — когда путь меняет высоту.
  useLayoutEffect(() => {
    const box = scrollRef.current
    const list = listRef.current
    const track = trackRef.current
    const drift = driftRef.current
    if (!box || !list || !track || !drift) return
    const place = () => {
      const end = box.scrollHeight
      const bodyTop = list.offsetTop + top - FOG_LEAD + FOG_EDGE
      track.style.top = `${end - BELOW_HIDDEN}px`
      drift.style.backgroundPositionY = `${bodyTop - (end - BELOW_HIDDEN)}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(list)
    return () => ro.disconnect()
  }, [scrollRef, listRef, trackRef, top])

  // Клубится в такт туману в пути: та же анимация с той же точки отсчёта.
  useLayoutEffect(() => {
    const src = listRef.current?.querySelector('[data-fog] .fog-drift')?.getAnimations()[0]
    const own = driftRef.current?.getAnimations()[0]
    if (!src || !own) return
    let live = true
    void src.ready.then(() => {
      if (live) own.startTime = src.startTime
    })
    return () => {
      live = false
    }
  }, [listRef])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={trackRef} className="absolute inset-x-0 bg-bg" style={{ height: BELOW_HIDDEN + BELOW_EXTRA }}>
        <div ref={driftRef} className="fog-drift fog-body absolute inset-y-0 left-[var(--safe-left)] w-[calc(100%+512px)]" />
      </div>
    </div>
  )
}
