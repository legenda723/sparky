// Туман пути (DESIGN.md → «Туман пути»): пушистые объёмные облака закрывают неоткрытое.
// Только SVG и градиент, без размытия (на iPhone оно тормозит). Две половины: когда путь открывается,
// старый туман разъезжается в стороны и тает (transform + opacity), новый проявляется ниже.
import { motion, useReducedMotion } from 'motion/react'

const HALF = 270

interface Bump {
  x: number
  y: number
  r: number
}

/** Верхний край облачного вала: бугры разного размера. */
const EDGE: Bump[] = [
  { x: 18, y: 70, r: 30 },
  { x: 62, y: 52, r: 40 },
  { x: 112, y: 66, r: 32 },
  { x: 156, y: 46, r: 44 },
  { x: 206, y: 62, r: 34 },
  { x: 252, y: 52, r: 40 },
]

/** Складки внутри вала — объём: тень под буграми. Координаты — по всей ширине вала. */
const FOLDS: Bump[] = [
  { x: 40, y: 152, r: 36 },
  { x: 128, y: 140, r: 42 },
  { x: 222, y: 156, r: 38 },
  { x: 312, y: 142, r: 42 },
  { x: 398, y: 154, r: 36 },
  { x: 84, y: 238, r: 40 },
  { x: 182, y: 230, r: 44 },
  { x: 272, y: 242, r: 38 },
  { x: 362, y: 232, r: 42 },
]

/** Ширина вала: экран iPhone с запасом по бокам. */
const WIDE = 440

/** Облачный вал под буграми: сплошное облако со складками. Один слой — без швов. */
function Bank({ height }: { height: number }) {
  return (
    <svg width={WIDE} height={height} viewBox={`0 0 ${WIDE} ${height}`} aria-hidden className="block">
      <rect x={0} y={70} width={WIDE} height={height} fill="var(--c-cloud-shade)" />
      <rect x={0} y={62} width={WIDE} height={height} fill="var(--c-cloud)" />
      {FOLDS.filter((f) => f.y < height - 20).map((f, i) => (
        <g key={i}>
          <circle cx={f.x} cy={f.y + 7} r={f.r} fill="var(--c-cloud-shade)" />
          <circle cx={f.x} cy={f.y} r={f.r} fill="var(--c-cloud)" />
        </g>
      ))}
    </svg>
  )
}

/** Верхний край: пушистые бугры. Две половины разъезжаются, когда путь открывается. */
function Half({ flip }: { flip: boolean }) {
  return (
    <svg width={HALF} height={120} viewBox={`0 0 ${HALF} 120`} aria-hidden className="block overflow-visible">
      <g transform={flip ? `translate(${HALF} 0) scale(-1 1)` : undefined}>
        {EDGE.map((b, i) => (
          <circle key={`s${i}`} cx={b.x} cy={b.y + 8} r={b.r} fill="var(--c-cloud-shade)" />
        ))}
        {EDGE.map((b, i) => (
          <circle key={`b${i}`} cx={b.x} cy={b.y} r={b.r} fill="var(--c-cloud)" />
        ))}
        {/* мягкий свет на верхушках бугров */}
        {EDGE.map((b, i) => (
          <ellipse key={`h${i}`} cx={b.x - b.r * 0.25} cy={b.y - b.r * 0.45} rx={b.r * 0.5} ry={b.r * 0.28} fill="var(--c-cloud-light)" opacity={0.6} />
        ))}
      </g>
    </svg>
  )
}

interface FogProps {
  /** Верх тумана от верха списка пути, px. */
  top: number
  height: number
}

/** Туман внизу пути. Ставится внутри AnimatePresence с ключом — при смене ключа старый разъезжается. */
export function Fog({ top, height }: FogProps) {
  const reduce = useReducedMotion() ?? false
  const part = (dir: -1 | 1) =>
    reduce ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dir * 85}%) translateY(-12px) scale(1.05)` }
  const ease = { duration: reduce ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] as const }
  return (
    <motion.div
      aria-hidden
      className="absolute -right-4 -left-4"
      style={{ top, height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      // Новый туман проявляется сразу (старый вал ещё тает поверх) — закрытое не просвечивает.
      transition={{ duration: 0.25 }}
    >
      {/* дымка над облаками: путь мягко уходит в туман */}
      <motion.div
        className="absolute inset-x-0 -top-16 h-24"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--c-cloud))', opacity: 0.6 }}
        exit={{ opacity: 0 }}
        transition={ease}
      />
      {/* вал: сплошное облако — тает на месте */}
      <motion.div className="absolute top-0 left-1/2 -translate-x-1/2" exit={{ opacity: 0 }} transition={ease}>
        <Bank height={height} />
      </motion.div>
      {/* пушистый край — две половины разъезжаются в стороны */}
      <div className="absolute inset-x-0 top-0 h-[120px] overflow-x-clip">
        <motion.div className="absolute top-0 left-[-6%]" exit={part(-1)} transition={ease}>
          <div className="cloud-drift">
            <Half flip={false} />
          </div>
        </motion.div>
        <motion.div className="absolute top-0 right-[-6%]" exit={part(1)} transition={ease}>
          <div className="cloud-drift [animation-delay:-3.5s]">
            <Half flip />
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
