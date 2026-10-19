import { AnimatePresence, motion } from 'motion/react'
import { Gem } from 'lucide-react'
import { forwardRef } from 'react'
import type { ChestState } from '../game/path'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'

/** Рисунок сундука 64×56 (DESIGN.md → «Сундук пути»): закрыт — серый, готов — золотой, открыт — с поднятой крышкой. */
function ChestArt({ state }: { state: ChestState }) {
  const gold = state !== 'locked'
  const body = gold ? 'var(--c-xp)' : 'var(--c-disabled)'
  const trim = gold ? 'var(--c-xp-shadow)' : 'var(--c-disabled-shadow)'
  const lock = gold ? 'var(--c-streak-shadow)' : 'var(--c-disabled-shadow)'
  const open = state === 'opened'
  return (
    <svg viewBox="0 0 64 56" width={64} height={56} aria-hidden className="overflow-visible">
      {/* внутренность — видна, когда крышка поднята */}
      <rect x={6} y={20} width={52} height={8} rx={2} fill={trim} />
      <rect x={4} y={26} width={56} height={28} rx={6} fill={body} />
      <rect x={4} y={46} width={56} height={8} rx={4} fill={trim} />
      <rect x={14} y={26} width={5} height={28} fill={trim} />
      <rect x={45} y={26} width={5} height={28} fill={trim} />
      <g
        style={{
          transformBox: 'view-box',
          transformOrigin: '4px 28px',
          transform: open ? 'rotate(-32deg) translateY(-4px)' : 'none',
          transition: 'transform 420ms cubic-bezier(0.34, 1.4, 0.64, 1)',
        }}
      >
        <rect x={2} y={8} width={60} height={22} rx={9} fill={body} />
        <rect x={2} y={24} width={60} height={6} rx={3} fill={trim} />
        <rect x={14} y={8} width={5} height={22} fill={trim} />
        <rect x={45} y={8} width={5} height={22} fill={trim} />
        {!open && <rect x={27} y={20} width={10} height={14} rx={3} fill={lock} />}
      </g>
    </svg>
  )
}

interface Props {
  state: ChestState
  /** Только что открыт — над сундуком всплывает «+N 💎». */
  burst?: number
  onSelect: () => void
}

/** Сундук на дорожке: зона касания 72, нажатие — сжатие (press-soft). */
export const ChestButton = forwardRef<HTMLButtonElement, Props>(function ChestButton({ state, burst, onSelect }, ref) {
  const { pressed, pressHandlers } = usePress()
  return (
    <div className="relative flex h-[72px] w-[72px] items-center justify-center">
      <button
        ref={ref}
        type="button"
        aria-label={state === 'ready' ? 'Сундук, можно открыть' : state === 'opened' ? 'Сундук, открыт' : 'Сундук, закрыт'}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          // У готового сундука свой звук — «награда».
          if (state !== 'ready') feedback('tap')
          onSelect()
        }}
        className="press-soft flex h-[72px] w-[72px] items-center justify-center rounded-full"
      >
        <span
          className={`block transition-opacity duration-300 ${state === 'ready' ? 'path-wiggle' : ''}`}
          style={{ opacity: state === 'opened' ? 0.6 : 1 }}
        >
          <ChestArt state={state} />
        </span>
      </button>
      <AnimatePresence>
        {burst !== undefined && (
          <motion.span
            key="burst"
            aria-live="polite"
            initial={{ opacity: 0, transform: 'translateY(0px) scale(0.9)' }}
            animate={{ opacity: [0, 1, 1, 0], transform: 'translateY(-56px) scale(1)' }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.15, 0.7, 1] }}
            className="pointer-events-none absolute top-0 flex items-center gap-1 text-small font-black whitespace-nowrap text-text"
          >
            +{burst}
            <Gem size={18} strokeWidth={2.5} className="fill-current text-gem" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
})
