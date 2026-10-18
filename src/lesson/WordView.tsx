import { Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import type { Card } from '../db/types'
import { usePress } from '../ui/usePress'
import { useMediaUrl } from '../words/useMediaUrl'

/** Круглая кнопка озвучки 48 (DESIGN.md → «Слово в задании»). */
export function SpeakButton({ onClick }: { onClick: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-label="Произнести"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={onClick}
      className="press-soft flex size-12 shrink-0 items-center justify-center rounded-full bg-info-tint text-info-ink"
    >
      <Volume2 size={26} strokeWidth={2.5} />
    </button>
  )
}

function Photo({ id }: { id: string }) {
  const url = useMediaUrl(id)
  return (
    <div className="flex h-[180px] w-full items-center justify-center overflow-hidden rounded-card border-2 border-border bg-surface">
      {url && <img src={url} alt="" className="h-full w-full object-contain" />}
    </div>
  )
}

interface WordViewProps {
  card: Card
  label: string
  /** Показать ответ: перевод, пример, заметку (и фото, если оно только на обороте). */
  answer: boolean
  /** Фото над словом (знакомство) — или под ответом (переворот). */
  photoFirst?: boolean
  onSpeak: () => void
}

/** Слово в задании: метка, фото, слово с озвучкой, транскрипция; под чертой — ответ. */
export function WordView({ card, label, answer, photoFirst, onSpeak }: WordViewProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {card.imageId && photoFirst && <Photo id={card.imageId} />}
      <span className="rounded-full bg-info-tint px-3 py-1 text-caption font-black tracking-[0.04em] text-info-ink uppercase">
        {label}
      </span>
      <div className="flex max-w-full items-center gap-3">
        <h2 lang="en" className="m-0 min-w-0 text-[36px] leading-tight font-black break-words text-text">
          {card.front}
        </h2>
        <SpeakButton onClick={onSpeak} />
      </div>
      {card.transcription && <p className="m-0 -mt-2 text-body font-bold text-muted">{card.transcription}</p>}
      {answer && (
        <motion.div
          initial={{ opacity: 0, transform: 'translateY(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col items-center gap-2 border-t-2 border-border pt-4"
        >
          <p className="m-0 text-title font-black text-text">{card.back}</p>
          {card.example && (
            <p lang="en" className="m-0 mt-2 text-body font-bold text-text">
              {card.example}
            </p>
          )}
          {card.exampleTranslation && <p className="m-0 text-small font-semibold text-muted">{card.exampleTranslation}</p>}
          {card.note && <p className="m-0 mt-2 text-small font-semibold text-muted">{card.note}</p>}
          {/* На обороте фото — под ответом, чтобы слово сверху не сдвигалось. */}
          {card.imageId && !photoFirst && (
            <div className="mt-2 w-full">
              <Photo id={card.imageId} />
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
