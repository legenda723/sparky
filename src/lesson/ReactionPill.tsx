import { Check, RotateCcw, Undo2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Reaction } from './useLesson'

const PRAISE = ['Отлично!', 'Точно!', 'Огонь!', 'Так держать!']

const LOOK = {
  correct: { bg: 'bg-primary-tint text-primary-ink', Icon: Check },
  hard: { bg: 'bg-primary-tint text-primary-ink', Icon: Check },
  again: { bg: 'bg-danger-tint text-danger-ink', Icon: RotateCcw },
  later: { bg: 'bg-danger-tint text-danger-ink', Icon: RotateCcw },
  undo: { bg: 'bg-info-tint text-info-ink', Icon: Undo2 },
} as const

function text(r: Reaction): string {
  switch (r.kind) {
    case 'correct':
      return PRAISE[r.id % PRAISE.length]
    case 'hard':
      return 'Засчитано!'
    case 'again':
      return 'Вернётся в конце урока'
    case 'later':
      return 'Повторим в следующем уроке'
    case 'undo':
      return 'Оценка отменена'
  }
}

/** Реакция на оценку (DESIGN.md): пилюля над кнопками, ~0,9 с. Урок не ждёт её. */
export function ReactionPill({ reaction }: { reaction: Reaction | null }) {
  const [shown, setShown] = useState<Reaction | null>(null)
  useEffect(() => {
    if (!reaction) return
    setShown(reaction)
    const t = setTimeout(() => setShown(null), 900)
    return () => clearTimeout(t)
  }, [reaction])
  const look = shown ? LOOK[shown.kind] : null

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-20 flex justify-center">
      <AnimatePresence>
        {shown && look && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)', transition: { duration: 0.3, ease: [0.34, 1.4, 0.64, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className={`flex h-10 items-center gap-2 rounded-full px-4 text-body font-black ${look.bg}`}
          >
            <look.Icon size={20} strokeWidth={3} />
            {text(shown)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
