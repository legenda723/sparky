import { Flame } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { XP } from '../game/xp'

/** Серия «N ПОДРЯД!» под прогрессом (DESIGN.md → «Серия»). Место зарезервировано — задание не прыгает. */
export function StreakPill({ streak }: { streak: number }) {
  const on = streak >= XP.streakFrom
  return (
    <div aria-live="polite" className="flex h-7 justify-center">
      <AnimatePresence>
        {on && (
          <motion.div
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)', transition: { duration: 0.3, ease: [0.34, 1.4, 0.64, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="flex h-7 items-center gap-1 rounded-full bg-surface px-3"
          >
            <Flame size={16} strokeWidth={2.5} className="fill-streak text-streak" />
            {/* Новое число — лёгкий «пульс»: появляется чуть крупнее и мягко садится на место. */}
            <motion.span
              key={streak}
              initial={{ transform: 'scale(1.12)' }}
              animate={{ transform: 'scale(1)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-caption font-black tracking-[0.04em] text-streak-ink uppercase"
            >
              {streak} подряд!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
