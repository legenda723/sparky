// Туман пути (DESIGN.md → «Туман пути»): клубящийся дым как в образце references/туман-PvZ.jpg.
// Готовые картинки (scripts/gen-fog.mjs → src/path/fog/*.webp), никаких живых фильтров и размытия.
// Дым тянется от края до самого низа списка — обрыва не видно. Медленно клубится: два слоя едут вбок
// в разные стороны (только transform). Когда путь открывается дальше, край плавно отступает вниз.
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import bodyDark from './fog/fog-body-dark.webp'
import bodyLight from './fog/fog-body-light.webp'
import edgeDark from './fog/fog-edge-dark.webp'
import edgeLight from './fog/fog-edge-light.webp'

/** Сколько прозрачного края над первым скрытым местом: путь сквозь него чуть проглядывает. */
export const FOG_LEAD = 110
/** Высота картинки края; сплошной дым начинается сразу под ней. */
const FOG_EDGE = 256
/**
 * Сплошной дым уходит на столько px ниже конца пути — это отрисовка за краем SVG, длину прокрутки она не меняет.
 * Видна, только когда iPhone оттягивает путь «резинкой»: едет вместе с путём (тот же слой), шва нет.
 */
const FOG_BELOW = 900

export function Fog({ top }: { top: number }) {
  const reduce = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<SVGRectElement>(null)
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

  // Сплошной дым — до низа тумана и ещё FOG_BELOW ниже (высота тумана меняется вместе с путём).
  useLayoutEffect(() => {
    const el = ref.current
    const body = bodyRef.current
    if (!el || !body) return
    const fit = () => body.setAttribute('height', String(Math.max(0, el.offsetHeight - FOG_EDGE) + FOG_BELOW))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      data-fog
      className="pointer-events-none absolute -right-4 bottom-0 -left-4 overflow-x-clip"
      style={{ top: top - FOG_LEAD }}
    >
      {/* глубина: под дымом путь плавно уходит в фон — дальше двух мест его не видно, обрыва нет */}
      <div className="fog-depth absolute inset-x-0 bottom-0" style={{ top: FOG_LEAD + 10 }} />
      {/* основной дым: край и сплошной дым — одна картинка, едут вместе, плитки стыкуются без шва */}
      <svg className="fog-drift absolute top-0 left-0 h-full w-[calc(100%+512px)]" overflow="visible" style={{ overflow: 'visible' }}>
        <defs>
          {(['light', 'dark'] as const).map((t) => (
            <g key={t}>
              {/* под краем в плитке — первая плитка сплошного дыма: при сглаживании нижняя строка края смешивается
                  с тем, что под ней и так нарисовано, а не с прозрачным верхом следующей плитки (иначе светлая линия) */}
              <pattern id={`fog-edge-${t}`} patternUnits="userSpaceOnUse" width={512} height={FOG_EDGE + 512}>
                <image href={t === 'light' ? edgeLight : edgeDark} width={512} height={FOG_EDGE} />
                <image href={t === 'light' ? bodyLight : bodyDark} y={FOG_EDGE} width={512} height={512} />
              </pattern>
              <pattern id={`fog-body-${t}`} patternUnits="userSpaceOnUse" y={FOG_EDGE} width={512} height={512}>
                <image href={t === 'light' ? bodyLight : bodyDark} width={512} height={512} />
              </pattern>
            </g>
          ))}
        </defs>
        <rect className="fog-svg-edge" width="100%" height={FOG_EDGE} />
        <rect ref={bodyRef} className="fog-svg-body" y={FOG_EDGE} width="100%" height={FOG_BELOW} />
      </svg>
      {/* завитки над краем — едут в другую сторону и чуть покачиваются: дым клубится */}
      <div className="fog-bob absolute inset-x-0 top-0 h-[220px]">
        <div className="fog-drift-back fog-wisp h-full w-[calc(100%+512px)]" />
      </div>
    </div>
  )
}
