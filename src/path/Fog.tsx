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
/**
 * У последнего места дым гуще (просьба владельца): поверх лежат дымчатая заливка цвета дыма и ещё три слоя того же
 * дыма (один совпадает с основным, два сдвинуты — закрывают просветы); всё вместе проявляется плавно за
 * FOG_THICK_RAMP px — ровной границы нет.
 */
const FOG_THICK_RAMP = 70

/**
 * top — край тумана; thickAt — где дым густеет; fade — когда под туманом плашка раздела: растворение в фон идёт
 * от from (сразу под первым местом под туманом) до to (низ плашки), чтобы плашка гасла, как уроки (дым не гуще).
 */
export function Fog({ top, thickAt, fade }: { top: number; thickAt?: number | null; fade?: { from: number; to: number } | null }) {
  const reduce = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<SVGRectElement>(null)
  const thickRef = useRef<SVGGElement>(null)
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
    const fit = () => {
      body.setAttribute('height', String(Math.max(0, el.offsetHeight - FOG_EDGE) + FOG_BELOW))
      for (const r of thickRef.current?.children ?? []) r.setAttribute('height', String(el.offsetHeight + FOG_BELOW))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Где густеет дым — в координатах тумана (он начинается на FOG_LEAD выше top).
  const thick = thickAt == null ? null : thickAt - top + FOG_LEAD
  // Растворение в фон (в координатах тумана): обычно от чуть ниже края за 190 px (.fog-depth);
  // с плашкой под туманом — от места под краем до низа плашки.
  const depthTop = fade ? Math.max(0, fade.from - top + FOG_LEAD) : FOG_LEAD + 10
  const depthStyle = fade
    ? { top: depthTop, backgroundImage: `linear-gradient(to bottom, transparent, var(--c-bg) ${Math.max(40, fade.to - fade.from)}px)` }
    : { top: depthTop }

  return (
    <div
      ref={ref}
      aria-hidden
      data-fog
      className="pointer-events-none absolute -right-4 bottom-0 -left-4 overflow-x-clip"
      style={{ top: top - FOG_LEAD }}
    >
      {/* глубина: под дымом путь плавно уходит в фон — дальше двух мест его не видно, обрыва нет */}
      <div className="fog-depth absolute inset-x-0 bottom-0" style={depthStyle} />
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
              {/* тот же дым, сдвинутый на полплитки, — закрывает просветы первого слоя */}
              <pattern id={`fog-thick-${t}`} patternUnits="userSpaceOnUse" x={256} y={FOG_EDGE + 200} width={512} height={512}>
                <image href={t === 'light' ? bodyLight : bodyDark} width={512} height={512} />
              </pattern>
              <pattern id={`fog-thick2-${t}`} patternUnits="userSpaceOnUse" x={128} y={FOG_EDGE + 330} width={512} height={512}>
                <image href={t === 'light' ? bodyLight : bodyDark} width={512} height={512} />
              </pattern>
            </g>
          ))}
          {thick !== null && (
            <mask id="fog-thick" maskUnits="userSpaceOnUse" x="-100%" y={-FOG_EDGE} width="300%" height="100000">
              <linearGradient id="fog-thick-ramp" gradientUnits="userSpaceOnUse" x1={0} y1={thick - 10} x2={0} y2={thick + FOG_THICK_RAMP - 10}>
                <stop offset={0} stopColor="#fff" stopOpacity={0} />
                <stop offset={1} stopColor="#fff" stopOpacity={1} />
              </linearGradient>
              <rect x="-100%" y={-FOG_EDGE} width="300%" height="100000" fill="url(#fog-thick-ramp)" />
            </mask>
          )}
        </defs>
        <rect className="fog-svg-edge" width="100%" height={FOG_EDGE} />
        <rect ref={bodyRef} className="fog-svg-body" y={FOG_EDGE} width="100%" height={FOG_BELOW} />
        <g ref={thickRef} mask="url(#fog-thick)" display={thick === null ? 'none' : undefined}>
          {['fog-svg-wash', 'fog-svg-body', 'fog-svg-thick', 'fog-svg-thick2'].map((c) => (
            <rect key={c} className={c} width="100%" height={FOG_BELOW} />
          ))}
        </g>
      </svg>
      {/* завитки над краем — едут в другую сторону и чуть покачиваются: дым клубится */}
      <div className="fog-bob absolute inset-x-0 top-0 h-[220px]">
        <div className="fog-drift-back fog-wisp h-full w-[calc(100%+512px)]" />
      </div>
    </div>
  )
}
