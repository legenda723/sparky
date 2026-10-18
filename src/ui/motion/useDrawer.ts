import { useCallback, useLayoutEffect, useRef } from 'react'
import { catchDrawer, closeDrawer, closedByScroll, openDrawer, placeClosed, syncDim, type Axis, type Drawer } from './drawer'

interface UseDrawerOptions {
  open: boolean
  axis: Axis
  /** Шторку закрыли изнутри (свайп, «Отмена», касание мимо) — она уже уехала */
  onClose: () => void
  /** Шторка уехала после open=false — её можно убирать */
  onGone: () => void
}

/**
 * Шторка (листы, экран колоды) в React: выезд при появлении, уход при open=false,
 * закрытие свайпом, «поймать на ходу». Разметку даёт тот, кто зовёт:
 * затемнение (dimRef) и прокрутка (scrollerRef) с «пустым местом» и самой шторкой.
 */
export function useDrawer({ open, axis, onClose, onGone }: UseDrawerOptions) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const cb = useRef({ onClose, onGone, open })
  cb.current = { onClose, onGone, open }
  /** Уход уже начат — второй раз не запускаем (двойное касание, «Отмена» во время свайпа). */
  const leaving = useRef<Promise<boolean> | null>(null)

  const drawer = useCallback(
    (): Drawer | null => (scrollerRef.current ? { scroller: scrollerRef.current, dim: dimRef.current, axis } : null),
    [axis],
  )

  const leave = useCallback(() => {
    const d = drawer()
    if (!d) return Promise.resolve(true)
    leaving.current ??= closeDrawer(d)
    return leaving.current
  }, [drawer])

  /** Увезти шторку и потом позвать onClose (если по пути её не поймали пальцем). */
  const dismiss = useCallback(async () => {
    if (await leave()) cb.current.onClose()
    else leaving.current = null
  }, [leave])

  // До первого кадра: выезд — из-за края; закрытие родителем — уезжаем, потом исчезаем.
  const first = useRef(true)
  useLayoutEffect(() => {
    const d = drawer()
    if (!d) return
    if (open) {
      if (first.current) placeClosed(d)
      leaving.current = null // открыли снова, пока уезжала, — едет обратно
      void openDrawer(d)
    } else {
      void leave().then((done) => done && cb.current.onGone())
    }
    first.current = false
  }, [open, leave, drawer])

  const scrollerProps = {
    onTouchStart: () => {
      // Пока шторка открыта у родителя, её можно поймать на ходу (после «Готово» — нет).
      const d = drawer()
      if (d && cb.current.open) {
        catchDrawer(d)
        leaving.current = null
      }
    },
    onScroll: () => {
      const d = drawer()
      if (!d) return
      syncDim(d)
      // Утянули до конца — шторка уже уехала.
      if (closedByScroll(d) && !leaving.current) {
        leaving.current = Promise.resolve(true)
        cb.current.onClose()
      }
    },
  }

  return { scrollerRef, dimRef, scrollerProps, dismiss }
}
