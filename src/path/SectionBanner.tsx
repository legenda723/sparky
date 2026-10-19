import { BookOpen } from 'lucide-react'
import { navigateSub } from '../app/routes'
import { feedback } from '../feedback/feedback'
import type { PathDeck } from '../game/path'
import { usePress } from '../ui/usePress'
import { DECK_COLORS } from '../words/deckLook'

/** Плашка раздела (DESIGN.md → «Раздел пути»): цвет колоды, «РАЗДЕЛ 1», название, кнопка «слова колоды». */
export function SectionBanner({ deck, number }: { deck: PathDeck; number: number }) {
  const { fill, shadow } = DECK_COLORS[deck.color]
  const { pressed, pressHandlers } = usePress()
  return (
    <div
      className="flex items-center gap-3 rounded-card p-4 text-on-color"
      style={{ background: fill, boxShadow: `0 4px 0 ${shadow}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-caption font-black tracking-[0.04em] uppercase opacity-85">Раздел {number}</div>
        <h2 className="m-0 truncate text-heading font-black">
          {deck.emoji} {deck.title}
        </h2>
      </div>
      <button
        type="button"
        aria-label={`Слова колоды «${deck.title}»`}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          feedback('tap')
          navigateSub('words', deck.id)
        }}
        className="press-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: shadow }}
      >
        <BookOpen size={24} strokeWidth={2.5} />
      </button>
    </div>
  )
}
