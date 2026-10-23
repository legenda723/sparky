// Опыт для «резинки» пути (SPEC 12, этап 7): продолжение тумана вниз как отрисовка за краем элемента
// («ink overflow»), которая по спецификации не удлиняет прокрутку. Если iPhone её рисует в зоне «резинки»,
// продолжение едет вместе с путём нативно — тот же слой, без JS. Два варианта: SVG и border-image.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import edgeDark from '../path/fog/fog-edge-dark.webp'
import edgeLight from '../path/fog/fog-edge-light.webp'
import bodyDark from '../path/fog/fog-body-dark.webp'
import bodyLight from '../path/fog/fog-body-light.webp'
import { ChoiceChips } from '../ui/ChoiceChips'

type Variant = 'svg' | 'border' | 'none'

/** Высота сплошного дыма в опыте: 768 = 256 + 512, при выносе 1024 рисунок border-image встаёт ровно в продолжение. */
const BODY = 768
const EDGE = 256
/** На сколько продолжение уходит ниже конца прокрутки, px. */
const BELOW = 1024

// Картинки по теме — те же правила, что у тумана пути в index.css.
const css = `
.lab-edge { background: url('${edgeLight}') repeat-x 0 0 / 512px 256px; }
.lab-body { background: url('${bodyLight}') repeat 0 0 / 512px 512px; }
.lab-border { border-image-source: url('${bodyLight}'); }
.lab-svg-edge { fill: url(#lab-edge-light); }
.lab-svg-body { fill: url(#lab-body-light); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .lab-edge { background-image: url('${edgeDark}'); }
  :root:not([data-theme='light']) .lab-body { background-image: url('${bodyDark}'); }
  :root:not([data-theme='light']) .lab-border { border-image-source: url('${bodyDark}'); }
  :root:not([data-theme='light']) .lab-svg-edge { fill: url(#lab-edge-dark); }
  :root:not([data-theme='light']) .lab-svg-body { fill: url(#lab-body-dark); }
}
:root[data-theme='dark'] .lab-edge { background-image: url('${edgeDark}'); }
:root[data-theme='dark'] .lab-body { background-image: url('${bodyDark}'); }
:root[data-theme='dark'] .lab-border { border-image-source: url('${bodyDark}'); }
:root[data-theme='dark'] .lab-svg-edge { fill: url(#lab-edge-dark); }
:root[data-theme='dark'] .lab-svg-body { fill: url(#lab-body-dark); }
`

export function OverscrollLab() {
  const [variant, setVariant] = useState<Variant>('svg')
  const boxRef = useRef<HTMLDivElement>(null)
  const extRef = useRef<SVGRectElement | HTMLDivElement | null>(null)
  const [heights, setHeights] = useState<{ with: number; without: number } | null>(null)

  // scrollHeight с продолжением и без: продолжение на миг прячем и меряем ещё раз — должно совпасть.
  useLayoutEffect(() => {
    const box = boxRef.current
    const ext = extRef.current
    if (!box) return
    const measure = () => {
      const withExt = box.scrollHeight
      if (!ext) return setHeights({ with: withExt, without: withExt })
      if (ext instanceof SVGRectElement) ext.setAttribute('height', String(BODY))
      else ext.style.display = 'none'
      const without = box.scrollHeight
      if (ext instanceof SVGRectElement) ext.setAttribute('height', String(BODY + BELOW))
      else ext.style.display = ''
      setHeights({ with: withExt, without })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [variant])

  return (
    <section className="mb-8 flex flex-col gap-3">
      <style>{css}</style>
      <h2 className="m-0 text-heading font-black text-text">Резинка тумана</h2>
      <p className="m-0 text-small font-semibold text-muted">
        Долистай окно ниже до конца и потяни вверх — медленно и рывком. Нужно: снизу тянется тот же дым вместе с путём,
        без отставания и без шва. «Без продолжения» — для сравнения.
      </p>
      <ChoiceChips<Variant>
        label="Вариант"
        options={[
          { value: 'svg', label: 'А: SVG' },
          { value: 'border', label: 'Б: border-image' },
          { value: 'none', label: 'Без продолжения' },
        ]}
        value={variant}
        onChange={setVariant}
      />
      <p className="m-0 text-small font-bold text-text">
        {heights
          ? `Длина прокрутки: ${heights.with} px, без продолжения: ${heights.without} px — ${heights.with === heights.without ? 'совпадает ✓' : 'НЕ совпадает ✗'}`
          : '…'}
      </p>

      <div ref={boxRef} className="h-[480px] overflow-x-clip overflow-y-auto overscroll-y-contain rounded-2xl border-2 border-border bg-bg">
        <div className="relative">
          {/* «путь» над туманом */}
          <div className="flex flex-col items-center gap-10 pt-8 pb-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex size-[72px] items-center justify-center rounded-full bg-primary text-title font-black text-on-color"
                style={{ marginLeft: n % 2 ? -80 : 80 }}
              >
                {n}
              </div>
            ))}
          </div>
          <div className="relative overflow-x-clip" style={{ height: EDGE + BODY }}>
            <div className="fog-depth absolute inset-x-0 bottom-0" style={{ top: 120 }} />
            {variant === 'svg' && <SvgFog extRef={extRef} />}
            {variant !== 'svg' && (
              <div className="fog-drift absolute top-0 left-0 h-full w-[1536px] will-change-transform">
                <div className="lab-edge" style={{ height: EDGE }} />
                <div className="lab-body absolute inset-x-0 bottom-0" style={{ top: EDGE }} />
                {variant === 'border' && (
                  <div
                    ref={(el) => {
                      extRef.current = el
                    }}
                    className="lab-border absolute inset-x-0 bottom-0 h-0"
                    style={{
                      borderStyle: 'solid',
                      borderWidth: 0,
                      borderImageSlice: '0 fill',
                      borderImageWidth: 0,
                      borderImageOutset: `0 0 ${BELOW}px 0`,
                      borderImageRepeat: 'repeat',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Вариант А: прямоугольник сплошного дыма уходит на BELOW px ниже рамки SVG (overflow: visible). */
function SvgFog({ extRef }: { extRef: RefObject<SVGRectElement | HTMLDivElement | null> }) {
  return (
    <svg
      aria-hidden
      className="fog-drift absolute top-0 left-0 will-change-transform"
      width={1536}
      height={EDGE + BODY}
      overflow="visible"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {(['light', 'dark'] as const).map((t) => (
          <g key={t}>
            <pattern id={`lab-edge-${t}`} patternUnits="userSpaceOnUse" width={512} height={EDGE}>
              <image href={t === 'light' ? edgeLight : edgeDark} width={512} height={EDGE} />
            </pattern>
            <pattern id={`lab-body-${t}`} patternUnits="userSpaceOnUse" y={EDGE} width={512} height={512}>
              <image href={t === 'light' ? bodyLight : bodyDark} width={512} height={512} />
            </pattern>
          </g>
        ))}
      </defs>
      <rect className="lab-svg-edge" x={0} y={0} width={1536} height={EDGE} />
      <rect
        ref={(el) => {
          extRef.current = el
        }}
        className="lab-svg-body"
        x={0}
        y={EDGE}
        width={1536}
        height={BODY + BELOW}
      />
    </svg>
  )
}
