import { motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { OVERLAY_MOTION, SHEET_MOTION } from './sheetMotion'
import { useSheetDrag } from './useSheetDrag'

interface SheetFrameProps {
  label: string
  onClose: () => void
  /** Закрывать касанием затемнения */
  closeOnOverlay?: boolean
  /** Слой: окно подтверждения выше полноэкранного листа */
  layer: 'z-30' | 'z-40'
  className: string
  children: ReactNode
}

/**
 * Основа листа снизу: затемнение, выезд и закрытие свайпом вниз с «ручкой» сверху.
 * Рендерится внутри AnimatePresence — появляется при открытии, уезжает при закрытии.
 */
export function SheetFrame({ label, onClose, closeOnOverlay, layer, className, children }: SheetFrameProps) {
  const panel = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  useSheetDrag(panel, dim, onClose)
  return (
    <div className={`fixed inset-0 ${layer} flex flex-col justify-end`}>
      <motion.div className="absolute inset-0" {...OVERLAY_MOTION} onClick={closeOnOverlay ? onClose : undefined}>
        <div ref={dim} className="absolute inset-0 bg-overlay" />
      </motion.div>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...SHEET_MOTION}
        className={`relative rounded-t-panel bg-bg ${className}`}
      >
        {/* «Ручка»: подсказка, что лист можно потянуть вниз */}
        <div data-sheet-handle aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-4 justify-center pt-1.5">
          <span className="h-[5px] w-9 rounded-full bg-border" />
        </div>
        {children}
      </motion.div>
    </div>
  )
}
