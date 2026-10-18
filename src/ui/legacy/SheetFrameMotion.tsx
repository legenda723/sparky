// ВРЕМЕННО: прежние листы на Motion — для сравнения «до/после» замером на iPhone (витрина #/dev).
// Удалить вместе с переключателем «Старые листы», когда новые подтвердятся.
import { AnimatePresence, motion } from 'motion/react'
import { useImperativeHandle, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SheetFrameProps } from '../SheetFrame'
import { useSheetDrag } from '../useSheetDrag'
import { OVERLAY_MOTION, SHEET_MOTION } from './sheetMotion'

const SNAP = '480ms cubic-bezier(0.25, 1, 0.5, 1)'

export function SheetFrameMotion({ open, ref, ...rest }: SheetFrameProps) {
  useImperativeHandle(ref, () => ({ dismiss: async () => rest.onClose() }), [rest])
  return createPortal(<AnimatePresence>{open && <Panel {...rest} />}</AnimatePresence>, document.body)
}

function Panel({ label, onClose, closeOnOverlay, layer, className, children }: Omit<SheetFrameProps, 'open' | 'ref'>) {
  const panel = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const apply = (px: number, animate: boolean) => {
    const p = panel.current
    if (!p) return
    p.style.transition = animate ? `translate ${SNAP}` : 'none'
    p.style.translate = px ? `0 ${px}px` : ''
    if (dim.current) {
      dim.current.style.transition = animate ? `opacity ${SNAP}` : 'none'
      dim.current.style.opacity = String(1 - Math.min(1, px / p.offsetHeight))
    }
  }
  useSheetDrag(panel, {
    canDrag: () => !closing.current,
    onMove: (px) => apply(px, false),
    onRelease: (_, close) => {
      if (!close) return apply(0, true)
      closing.current = true
      onClose()
    },
  })
  return (
    <div className={`fixed inset-0 ${layer} flex flex-col justify-end`}>
      <motion.div className="absolute inset-0" {...OVERLAY_MOTION} onClick={closeOnOverlay ? onClose : undefined}>
        <div ref={dim} className="absolute inset-0 bg-overlay" />
      </motion.div>
      <motion.div
        ref={panel}
        data-sheet-panel
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...SHEET_MOTION}
        className={`relative rounded-t-panel bg-bg ${className}`}
      >
        {children}
      </motion.div>
    </div>
  )
}
