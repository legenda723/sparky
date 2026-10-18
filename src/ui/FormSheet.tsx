import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TextButton } from './TextButton'

interface FormSheetProps {
  open: boolean
  title: string
  onCancel: () => void
  onDone: () => void
  doneLabel?: string
  doneDisabled?: boolean
  children: ReactNode
}

/** Полноэкранный лист (DESIGN.md): форма колоды, слова, «Вставить списком». */
export function FormSheet({ open, title, onCancel, onDone, doneLabel = 'Готово', doneDisabled, children }: FormSheetProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className="relative flex h-[calc(100%-8px-var(--safe-top))] flex-col rounded-t-panel bg-bg"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-border px-1">
              <TextButton onClick={onCancel}>Отмена</TextButton>
              <h2 className="m-0 min-w-0 flex-1 truncate text-center text-body font-black text-text">{title}</h2>
              <TextButton onClick={onDone} disabled={doneDisabled}>
                {doneLabel}
              </TextButton>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(24px+var(--safe-bottom))]">
              <div className="flex flex-col gap-4">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
