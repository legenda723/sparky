import { GripVertical } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import type { Deck } from '../db/types'
import { feedback } from '../feedback/feedback'
import { plural } from '../srs/status'
import { usePress } from '../ui/usePress'
import type { DeckStats } from './deckStats'
import { DECK_COLORS } from './deckLook'

const EMPTY: DeckStats = { total: 0, mastered: 0, due: 0 }

function DeckBadge({ deck }: { deck: Deck }) {
  const c = DECK_COLORS[deck.color]
  return (
    <span
      aria-hidden
      className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] text-[28px] leading-none"
      style={{ background: c.fill, boxShadow: `0 4px 0 ${c.shadow}` }}
    >
      {deck.emoji}
    </span>
  )
}

function DeckInfo({ deck, stats = EMPTY }: { deck: Deck; stats?: DeckStats }) {
  const c = DECK_COLORS[deck.color]
  const words = `${stats.total} ${plural(stats.total, 'слово', 'слова', 'слов')}`
  const share = stats.total ? stats.mastered / stats.total : 0
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <span className="truncate text-body font-extrabold text-text">{deck.title}</span>
      <span className="truncate text-caption font-bold text-muted">
        {words}
        {stats.due > 0 && ` · ${stats.due} к повторению`}
      </span>
      <span
        role="progressbar"
        aria-label="Выучено"
        aria-valuemin={0}
        aria-valuemax={stats.total}
        aria-valuenow={stats.mastered}
        className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: c.fill }} />
      </span>
    </span>
  )
}

const TILE = 'flex w-full items-center gap-4 rounded-card border-2 border-border bg-bg px-4 py-3'

/** Плитка колоды (DESIGN.md → «Плитка колоды»). */
export function DeckTile({ deck, stats, onOpen }: { deck: Deck; stats?: DeckStats; onOpen: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onOpen()
      }}
      className={`press-3d [--press-shadow:var(--c-border)] ${TILE}`}
    >
      <DeckBadge deck={deck} />
      <DeckInfo deck={deck} stats={stats} />
    </button>
  )
}

/** Плитка в режиме «Порядок»: тянуть за ручку справа. */
export function DeckTileDraggable({ deck, stats }: { deck: Deck; stats?: DeckStats }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={deck.id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03 }}
      className={`relative list-none shadow-[0_4px_0_var(--c-border)] ${TILE}`}
    >
      <DeckBadge deck={deck} />
      <DeckInfo deck={deck} stats={stats} />
      <span
        aria-label={`Перетащить «${deck.title}»`}
        onPointerDown={(e) => {
          e.preventDefault()
          controls.start(e)
        }}
        className="-mr-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted"
      >
        <GripVertical size={24} />
      </span>
    </Reorder.Item>
  )
}
