import { Check, ChevronDown } from 'lucide-react'
import { feedback } from '../feedback/feedback'
import type { PathSection } from '../game/path'
import { plural } from '../srs/status'
import { usePress } from '../ui/usePress'
import { DECK_COLORS } from '../words/deckLook'

/** Пройденная колода выше текущей — одна плитка (DESIGN.md → «Свёрнутый раздел»). Касание разворачивает. */
export function CollapsedSection({ section, onOpen }: { section: PathSection; onOpen: () => void }) {
  const { pressed, pressHandlers } = usePress()
  const { fill, shadow } = DECK_COLORS[section.deck.color]
  const nodes = section.items.filter((x) => x.kind === 'node')
  const crowns = nodes.filter((n) => n.kind === 'node' && n.state === 'mastered').length
  const lessons = `${nodes.length} ${plural(nodes.length, 'урок', 'урока', 'уроков')}`
  return (
    <button
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onOpen()
      }}
      aria-label={`Раздел ${section.number} «${section.deck.title}» пройден, ${lessons}. Развернуть`}
      className="press-3d flex w-full items-center gap-3 rounded-card border-2 border-border bg-bg px-4 py-3 text-left [--press-shadow:var(--c-border)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: fill, boxShadow: `0 3px 0 ${shadow}` }}>
        <Check size={24} strokeWidth={4} className="text-on-color" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-extrabold text-text">
          {section.deck.emoji} {section.deck.title}
        </span>
        <span className="block text-caption font-bold text-muted">
          Раздел {section.number} · {lessons}
          {crowns > 0 ? ` · 👑 ${crowns}` : ''}
        </span>
      </span>
      <ChevronDown size={24} strokeWidth={2.5} className="shrink-0 text-muted" />
    </button>
  )
}
