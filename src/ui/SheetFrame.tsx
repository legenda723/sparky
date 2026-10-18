import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { hide, place, SHEET_SNAP, slide } from './sheetAnim'
import { useSheetDrag } from './useSheetDrag'

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
 * Основа листа снизу: затемнение, выезд и закрытие свайпом вниз (DESIGN.md → «Движение»).
 * Закрытие изнутри (dismiss) сначала увозит лист и только потом зовёт onClose: тяжёлая
 * перерисовка экрана под листом начинается, когда лист уже уехал, — без паузы и рывка.
 * Если родитель сам поставил open=false (например, после сохранения), лист тоже уезжает.
 */
export function SheetFrame(props: SheetFrameProps) {
  const [mounted, setMounted] = useState(props.open)
  if (props.open && !mounted) setMounted(true)
  if (!mounted) return null
  return createPortal(<Panel {...props} onGone={() => setMounted(false)} />, document.body)
}

function Panel({ open, label, onClose, closeOnOverlay, layer, className, children, ref, onGone }: SheetFrameProps & { onGone: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const cb = useRef({ onClose, onGone })
  cb.current = { onClose, onGone }
  // Пока лист выезжает или уезжает, свайпом его не берём.
  const moving = useRef(true)
  /** Уход уже начат — второй раз не запускаем (двойное касание, «Отмена» во время свайпа). */
  const leaving = useRef<Promise<boolean> | null>(null)
  // Пока уезжает, показываем то, что было в момент закрытия (родитель мог уже сменить данные).
  const shown = useRef(children)
  if (open) shown.current = children

  const leave = useCallback(() => {
    const p = panel.current
    if (!p) return Promise.resolve(true)
    moving.current = true
    leaving.current ??= slide(p, dim.current, 'closed')
    return leaving.current
  }, [])

  const dismiss = useCallback(async () => {
    if (await leave()) cb.current.onClose()
  }, [leave])
  useImperativeHandle(ref, () => ({ dismiss }), [dismiss])

  // До первого кадра: выезд — с нижнего края; закрытие родителем — уезжаем, потом исчезаем.
  const first = useRef(true)
  useLayoutEffect(() => {
    const p = panel.current
    if (!p) return
    if (open) {
      if (first.current) hide(p, dim.current)
      leaving.current = null // открыли снова, пока уезжал, — едет обратно
      moving.current = true
      void slide(p, dim.current, 'open').then((done) => {
        if (done) moving.current = false
      })
    } else {
      void leave().then((done) => done && cb.current.onGone())
    }
    first.current = false
  }, [open, leave])

  useSheetDrag(panel, {
    canDrag: () => !moving.current,
    onMove: (px) => panel.current && place(panel.current, dim.current, px),
    onRelease: (_, close) => {
      const p = panel.current
      if (!p) return
      if (close) return void dismiss() // уезжает дальше с того места, где отпустили
      moving.current = true
      void slide(p, dim.current, 'open', SHEET_SNAP).then((done) => {
        if (done) moving.current = false
      })
    },
  })

  return (
    <div className={`fixed inset-0 ${layer} flex flex-col justify-end`}>
      <div ref={dim} className="absolute inset-0 bg-overlay" onClick={closeOnOverlay ? () => void dismiss() : undefined} />
      <div
        ref={panel}
        data-sheet-panel
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative rounded-t-panel bg-bg ${className}`}
      >
        {shown.current}
      </div>
    </div>
  )
}
