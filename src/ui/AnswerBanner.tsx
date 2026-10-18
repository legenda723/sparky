import { Check, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface AnswerBannerProps {
  open: boolean
  kind: 'correct' | 'wrong'
  title: string
  children?: ReactNode
  onNext: () => void
}

/** Плашка ответа (DESIGN.md → «Плашка ответа»): выезжает снизу за 200 мс. */
export function AnswerBanner({ open, kind, title, children, onNext }: AnswerBannerProps) {
  const correct = kind === 'correct'
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          initial={{ transform: 'translateY(100%)' }}
          animate={{ transform: 'translateY(0%)' }}
          exit={{ transform: 'translateY(100%)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-panel px-4 pt-5 pb-[calc(16px+var(--safe-bottom))] ${correct ? 'bg-primary-tint' : 'bg-danger-tint'}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-on-color ${correct ? 'bg-primary' : 'bg-danger'}`}
            >
              {correct ? <Check size={26} strokeWidth={4} /> : <X size={26} strokeWidth={4} />}
            </span>
            <div className="flex min-w-0 flex-col gap-1 pt-0.5">
              <h2 className={`m-0 text-title font-black ${correct ? 'text-primary-ink' : 'text-danger-ink'}`}>{title}</h2>
              {children && <div className="text-body font-bold text-text">{children}</div>}
            </div>
          </div>
          <Button variant={correct ? 'primary' : 'danger'} block onClick={onNext}>
            Далее
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
