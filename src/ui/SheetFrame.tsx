import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useDrawer } from './motion/useDrawer'

export interface SheetHandle {
  /** Увезти лист вниз прямо сейчас, а когда уедет — позвать onClose. */
  dismiss: () => Promise<void>
}

export interface SheetFrameProps {
  open: boolean
  label: string
  /** Лист уже уехал (Отмена, касание мимо, свайп) — родитель ставит open=false */
  onClose: () => void
  /** Закрывать касанием затемнения */
  closeOnOverlay?: boolean
  /** Слой: окно подтверждения выше полноэкранного листа */
  layer: 'z-30' | 'z-40'
  className: string
  children: ReactNode
  ref?: Ref<SheetHandle>
}

/**
 * Основа листа снизу (DESIGN.md → «Движение»): шторка на прокрутке (`motion/drawer`).
 * Палец тянет лист силами самого iPhone; выезд и уход по кнопке — пружина на видеокарте,
 * её можно поймать касанием. Закрытие изнутри (dismiss) сначала увозит лист и только потом
 * зовёт onClose: перерисовка экрана под листом начинается, когда лист уже уехал.
 * Если родитель сам поставил open=false (например, после сохранения), лист тоже уезжает.
 */
export function SheetFrame(props: SheetFrameProps) {
  const [mounted, setMounted] = useState(props.open)
  if (props.open && !mounted) setMounted(true)
  if (!mounted) return null
  return createPortal(<Panel {...props} onGone={() => setMounted(false)} />, document.body)
}

function Panel({ open, label, onClose, closeOnOverlay, layer, className, children, ref, onGone }: SheetFrameProps & { onGone: () => void }) {
  const { scrollerRef, dimRef, scrollerProps, dismiss } = useDrawer({ open, axis: 'y', onClose, onGone })
  useImperativeHandle(ref, () => ({ dismiss }), [dismiss])
  // Пока уезжает, показываем то, что было в момент закрытия (родитель мог уже сменить данные).
  const shown = useRef(children)
  if (open) shown.current = children

  return (
    <div className={`drawer fixed inset-0 ${layer} overflow-hidden`}>
      <div ref={dimRef} className="drawer-dim pointer-events-none absolute inset-0 bg-overlay" />
      <div ref={scrollerRef} {...scrollerProps} className="drawer-scroll-y absolute inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-y-none no-scrollbar">
        <div className="h-full snap-start" onClick={closeOnOverlay ? () => void dismiss() : undefined} />
        <div role="dialog" aria-modal="true" aria-label={label} className={`relative snap-end rounded-t-panel bg-bg ${className}`}>
          {shown.current}
        </div>
      </div>
    </div>
  )
}
