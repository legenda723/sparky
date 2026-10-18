import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SHEET_MOTION } from './sheetMotion'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  text?: ReactNode
  /** Кнопки во всю ширину (опасное действие — опасная кнопка) */
  children?: ReactNode
}

/** Окно подтверждения / нижний лист (DESIGN.md): выезжает снизу, под ним затемнение. */
export function Sheet({ open, onClose, title, text, children }: SheetProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            {...SHEET_MOTION}
            className="relative flex flex-col gap-3 rounded-t-panel bg-bg px-4 pt-6 pb-[calc(16px+var(--safe-bottom))]"
          >
            <h2 className="m-0 text-center text-heading font-black text-text">{title}</h2>
            {text && <p className="m-0 text-center text-small font-semibold text-muted">{text}</p>}
            {children && <div className="mt-2 flex flex-col gap-3">{children}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
