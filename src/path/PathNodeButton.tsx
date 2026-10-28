import { Check, Crown, Lock, RotateCcw, Star } from 'lucide-react'
import { forwardRef } from 'react'
import type { DeckColor } from '../db/types'
import type { PathNode } from '../game/path'
import { plural } from '../srs/status'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'
import { DECK_COLORS } from '../words/deckLook'

/** Овальная объёмная кнопка, как в образце references/путь-duolingo.jpg: лицо 70×56, низ 8 px. */
const W = 70
const H = 56
const DEPTH = 8
const RING = 92
const RING_WIDTH = 6

function look(node: PathNode, color: DeckColor): { fill: string; shadow: string } {
  if (node.state === 'mastered') return { fill: 'var(--c-xp)', shadow: 'var(--c-xp-shadow)' }
  if (node.state === 'locked') return { fill: 'var(--c-disabled)', shadow: 'var(--c-disabled-shadow)' }
  return DECK_COLORS[color]
}

function Icon({ node, review }: { node: PathNode; review: boolean }) {
  // Урок повторения (решение владельца 2026-10-28): вместо звезды — значок повтора.
  if (review) return <RotateCcw size={34} strokeWidth={3} className="text-on-color" />
  switch (node.state) {
    case 'current':
      return <Star size={34} strokeWidth={2.5} className="fill-current text-on-color" />
    case 'passed':
      return <Check size={36} strokeWidth={4} className="text-on-color" />
    case 'mastered':
      return <Crown size={34} strokeWidth={2.5} className="fill-current text-on-xp" />
    case 'locked':
      return <Lock size={30} strokeWidth={3} className="text-muted" />
  }
}

const LABEL = { current: 'текущий', passed: 'пройден', mastered: 'освоен', locked: 'закрыт' } as const

/** Кольцо прогресса текущего узла: сколько его слов уже знакомы. */
function ProgressRing({ value, color }: { value: number; color: string }) {
  const r = (RING - RING_WIDTH) / 2
  const len = 2 * Math.PI * r
  return (
    <svg
      aria-hidden
      width={RING}
      height={RING}
      className="pointer-events-none absolute -rotate-90"
      style={{ left: (W - RING) / 2, top: (H + DEPTH - RING) / 2 }}
    >
      <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--c-border)" strokeWidth={RING_WIDTH} />
      {value > 0 && (
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={RING_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${len * value} ${len}`}
        />
      )}
    </svg>
  )
}

interface Props {
  node: PathNode
  color: DeckColor
  /** «Урок 3» — для чтения с экрана. */
  label: string
  onSelect: () => void
  /** Урок повторения: сколько слов повторить (значок повтора и бейдж с числом). */
  review?: number
}

/** Узел пути (DESIGN.md → «Узел пути»): круг 72, объёмный, нажатие на 6 px. */
export const PathNodeButton = forwardRef<HTMLButtonElement, Props>(function PathNodeButton({ node, color, label, onSelect, review }, ref) {
  const { pressed, pressHandlers } = usePress()
  const { fill, shadow } = look(node, color)
  const isReview = review !== undefined && review > 0
  return (
    <div className="relative" style={{ width: W, height: H + DEPTH }}>
      {node.state === 'current' && (
        // Мягкое сияние: кольцо цвета колоды расходится и тает.
        <span aria-hidden className="path-halo absolute -inset-4 rounded-[50%]" style={{ background: DECK_COLORS[color].fill }} />
      )}
      {node.state === 'current' && node.cardIds.length > 0 && (
        <ProgressRing value={node.introduced / node.cardIds.length} color={DECK_COLORS[color].fill} />
      )}
      <button
        ref={ref}
        type="button"
        aria-label={isReview ? `${label}: повторение, ${review} ${plural(review, 'слово', 'слова', 'слов')}` : `${label}, ${LABEL[node.state]}`}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          feedback('tap')
          onSelect()
        }}
        className="press-3d absolute inset-x-0 top-0 flex items-center justify-center rounded-[50%]"
        style={{ height: H, background: fill, ['--press-shadow' as string]: shadow, ['--press-depth' as string]: `${DEPTH}px` }}
      >
        {/* блик сверху — «сочный» объём, как у прогресс-бара (у закрытого — нет) */}
        {node.state !== 'locked' && (
          <span aria-hidden className="absolute top-[6px] left-1/2 h-[7px] w-[32px] -translate-x-1/2 rounded-full bg-on-color/20" />
        )}
        <Icon node={node} review={isReview} />
      </button>
      {isReview && (
        // Бейдж с числом повторений — у правого верхнего края, едет вместе с нажатием.
        <span
          aria-hidden
          className="pointer-events-none absolute -top-2 -right-3 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-bg bg-primary px-1.5 text-caption leading-none font-black text-on-color transition-[translate] duration-[130ms]"
          style={{ translate: pressed ? `0 ${DEPTH}px` : undefined }}
        >
          {review > 99 ? '99+' : review}
        </span>
      )}
    </div>
  )
})
