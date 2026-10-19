import { Check, Crown, Lock, Star } from 'lucide-react'
import { forwardRef } from 'react'
import type { DeckColor } from '../db/types'
import type { PathNode } from '../game/path'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'
import { DECK_COLORS } from '../words/deckLook'

const SIZE = 72
const RING = 92
const RING_WIDTH = 6

function look(node: PathNode, color: DeckColor): { fill: string; shadow: string } {
  if (node.state === 'mastered') return { fill: 'var(--c-xp)', shadow: 'var(--c-xp-shadow)' }
  if (node.state === 'locked') return { fill: 'var(--c-disabled)', shadow: 'var(--c-disabled-shadow)' }
  return DECK_COLORS[color]
}

function Icon({ node }: { node: PathNode }) {
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
      style={{ left: (SIZE - RING) / 2, top: (SIZE - RING) / 2 }}
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
}

/** Узел пути (DESIGN.md → «Узел пути»): круг 72, объёмный, нажатие на 6 px. */
export const PathNodeButton = forwardRef<HTMLButtonElement, Props>(function PathNodeButton({ node, color, label, onSelect }, ref) {
  const { pressed, pressHandlers } = usePress()
  const { fill, shadow } = look(node, color)
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {node.state === 'current' && <ProgressRing value={node.introduced / node.cardIds.length} color={DECK_COLORS[color].fill} />}
      <button
        ref={ref}
        type="button"
        aria-label={`${label}, ${LABEL[node.state]}`}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          feedback('tap')
          onSelect()
        }}
        className="press-3d absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: fill, ['--press-shadow' as string]: shadow, ['--press-depth' as string]: '6px' }}
      >
        <Icon node={node} />
      </button>
    </div>
  )
})
