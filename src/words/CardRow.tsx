import { Snowflake } from 'lucide-react'
import type { Card } from '../db/types'
import { feedback } from '../feedback/feedback'
import { cardStatus, type CardStatus } from '../srs/status'
import { usePress } from '../ui/usePress'
import { useMediaUrl } from './useMediaUrl'

export const STATUS_LOOK: Record<CardStatus, { dot: string; label: string }> = {
  new: { dot: 'bg-info', label: 'Новое' },
  learning: { dot: 'bg-streak', label: 'Учится' },
  known: { dot: 'bg-primary', label: 'Знаю' },
  mastered: { dot: 'bg-xp', label: 'Освоено' },
}

/** Строка слова (DESIGN.md → «Строка слова»). */
export function CardRow({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const { pressed, pressHandlers } = usePress()
  const image = useMediaUrl(card.imageId)
  const status = STATUS_LOOK[cardStatus(card)]
  return (
    <button
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onOpen()
      }}
      className="flex min-h-14 w-full items-center gap-3 border-b-2 border-border px-4 py-2 transition-colors duration-200 ease-out data-pressed:bg-surface data-pressed:duration-75"
    >
      <span className={`flex min-w-0 flex-1 flex-col text-left ${card.suspended ? 'opacity-60' : ''}`}>
        <span className="truncate text-body font-extrabold text-text" lang="en">
          {card.front}
        </span>
        <span className="truncate text-small font-semibold text-muted">{card.back}</span>
      </span>
      {image && <img src={image} alt="" className="size-10 shrink-0 rounded-xl object-cover" />}
      {card.suspended ? (
        <Snowflake size={18} className="shrink-0 text-info-ink" aria-label="Заморожено" />
      ) : (
        <span aria-label={status.label} className={`size-2.5 shrink-0 rounded-full ${status.dot}`} />
      )}
    </button>
  )
}
