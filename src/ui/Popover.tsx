import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  width?: number
}

const GAP = 12
const EDGE = 16
const TAIL = 16

interface Position {
  top: number
  left: number
  width: number
  tailLeft: number
}

/** Всплывашка над чипом или узлом (DESIGN.md → «Всплывашка»): хвостик к источнику, закрытие тапом мимо. */
export function Popover({ open, onClose, anchorRef, children, width = 320 }: PopoverProps) {
  const [pos, setPos] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const w = Math.min(width, vw - EDGE * 2)
    const center = r.left + r.width / 2
    const left = Math.min(Math.max(center - w / 2, EDGE), vw - EDGE - w)
    const tailLeft = Math.min(Math.max(center - left - TAIL / 2, 20), w - 20 - TAIL)
    setPos({ top: r.bottom + GAP, left, width: w, tailLeft })
  }, [open, anchorRef, width])

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <div className="fixed inset-0 z-40" onClick={onClose}>
          <motion.div
            role="dialog"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transformOrigin: `${pos.tailLeft + TAIL / 2}px 0`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute rounded-panel border-2 border-border bg-bg p-4 shadow-[0_4px_0_var(--c-border)]"
          >
            <span
              aria-hidden
              style={{ left: pos.tailLeft, width: TAIL, height: TAIL }}
              className="absolute -top-[9px] rotate-45 rounded-tl-[4px] border-t-2 border-l-2 border-border bg-bg"
            />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
