import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  width?: number
  /** Зазор до источника (у узла пути больше — вокруг него кольцо и тень). */
  gap?: number
}

const GAP = 12
const EDGE = 16
const TAIL = 16

/** Если под источником меньше места — всплывашка открывается над ним. */
const ROOM_BELOW = 280

interface Position {
  /** Сверху — от верха экрана (под источником) или снизу — от низа экрана (над источником). */
  top?: number
  bottom?: number
  left: number
  width: number
  tailLeft: number
}

/** Всплывашка над чипом или узлом (DESIGN.md → «Всплывашка»): хвостик к источнику, закрытие тапом мимо. */
export function Popover({ open, onClose, anchorRef, children, width = 320, gap = GAP }: PopoverProps) {
  const [pos, setPos] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const w = Math.min(width, vw - EDGE * 2)
    const center = r.left + r.width / 2
    const left = Math.min(Math.max(center - w / 2, EDGE), vw - EDGE - w)
    const tailLeft = Math.min(Math.max(center - left - TAIL / 2, 20), w - 20 - TAIL)
    const below = r.bottom + gap + ROOM_BELOW <= vh
    setPos({ ...(below ? { top: r.bottom + gap } : { bottom: vh - r.top + gap }), left, width: w, tailLeft })
  }, [open, anchorRef, width, gap])

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <div className="fixed inset-0 z-40" onClick={onClose}>
          <motion.div
            role="dialog"
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transform: 'scale(0.9)' }}
            // Целая строка transform — Motion отдаёт пружину видеокарте (DESIGN.md → «Движение»).
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              transformOrigin: `${pos.tailLeft + TAIL / 2}px ${pos.top !== undefined ? '0' : '100%'}`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute rounded-panel border-2 border-border bg-bg p-4 shadow-[0_4px_0_var(--c-border)]"
          >
            <span
              aria-hidden
              style={{ left: pos.tailLeft, width: TAIL, height: TAIL }}
              className={`absolute rotate-45 border-border bg-bg ${
                pos.top !== undefined
                  ? '-top-[9px] rounded-tl-[4px] border-t-2 border-l-2'
                  : '-bottom-[9px] rounded-br-[4px] border-r-2 border-b-2'
              }`}
            />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
