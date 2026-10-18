import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { catchDrawer, closeDrawer, closedByScroll, openDrawer, placeClosed, syncDim, type Drawer } from './motion/drawer'

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
  const scroller = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const cb = useRef({ onClose, onGone, open })
  cb.current = { onClose, onGone, open }
  /** Уход уже начат — второй раз не запускаем (двойное касание, «Отмена» во время свайпа). */
  const leaving = useRef<Promise<boolean> | null>(null)
  // Пока уезжает, показываем то, что было в момент закрытия (родитель мог уже сменить данные).
  const shown = useRef(children)
  if (open) shown.current = children

  const drawer = (): Drawer | null => (scroller.current ? { scroller: scroller.current, dim: dim.current, axis: 'y' } : null)

  const leave = useCallback(() => {
    const d = drawer()
    if (!d) return Promise.resolve(true)
    leaving.current ??= closeDrawer(d)
    return leaving.current
  }, [])

  const dismiss = useCallback(async () => {
    if (await leave()) cb.current.onClose()
    else leaving.current = null // поймали пальцем — лист остаётся
  }, [leave])
  useImperativeHandle(ref, () => ({ dismiss }), [dismiss])

  // До первого кадра: выезд — из-за нижнего края; закрытие родителем — уезжаем, потом исчезаем.
  const first = useRef(true)
  useLayoutEffect(() => {
    const d = drawer()
    if (!d) return
    if (open) {
      if (first.current) placeClosed(d)
      leaving.current = null // открыли снова, пока уезжал, — едет обратно
      void openDrawer(d)
    } else {
      void leave().then((done) => done && cb.current.onGone())
    }
    first.current = false
  }, [open, leave])

  return (
    <div className={`fixed inset-0 ${layer} overflow-hidden`}>
      <div ref={dim} className="pointer-events-none absolute inset-0 bg-overlay" />
      <div
        ref={scroller}
        className="absolute inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-y-none no-scrollbar"
        onTouchStart={() => {
          // Пока лист открыт у родителя, его можно поймать на ходу (после «Готово» — нет).
          const d = drawer()
          if (d && cb.current.open) {
            catchDrawer(d)
            leaving.current = null
          }
        }}
        onScroll={() => {
          const d = drawer()
          if (!d) return
          syncDim(d)
          // Утянули вниз до конца — лист уже уехал.
          if (closedByScroll(d) && !leaving.current) {
            leaving.current = Promise.resolve(true)
            cb.current.onClose()
          }
        }}
      >
        <div className="h-full snap-start" onClick={closeOnOverlay ? () => void dismiss() : undefined} />
        <div role="dialog" aria-modal="true" aria-label={label} className={`relative snap-end rounded-t-panel bg-bg ${className}`}>
          {shown.current}
        </div>
      </div>
    </div>
  )
}
