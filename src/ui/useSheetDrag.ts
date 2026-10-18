// Закрытие листа свайпом вниз (как окна iPhone): тянуть за шапку или за содержимое,
// когда оно прокручено до самого верха. Отпустил далеко или быстро — лист уезжает, иначе
// мягко возвращается. Сам лист двигает тот, кто зовёт хук (onMove / onRelease).
import { useEffect, useRef, type RefObject } from 'react'

/** Закрыть, если утянули дальше этой доли высоты листа… */
const CLOSE_SHARE = 0.25
/** …или отпустили быстрее этого (px/мс). */
const CLOSE_SPEED = 0.5

/** Решение по первому движению: тянуть лист или отдать жест прокрутке. */
export function shouldDrag(dx: number, dy: number, atTop: boolean, onHandle: boolean): boolean | null {
  if (dx === 0 && dy === 0) return null
  return dy > 0 && dy >= Math.abs(dx) && (atTop || onHandle)
}

/** Отпустили: закрывать или вернуть на место. */
export function shouldClose(offset: number, height: number, speed: number): boolean {
  return offset > height * CLOSE_SHARE || speed > CLOSE_SPEED
}

export interface SheetDragHandlers {
  /** Палец тянет лист: сдвиг вниз, px */
  onMove: (px: number) => void
  /** Отпустили: close — увезти вниз, иначе вернуть на место */
  onRelease: (px: number, close: boolean) => void
  /** Можно ли сейчас тянуть (не тянем, пока лист выезжает или уже уезжает) */
  canDrag: () => boolean
}

export function useSheetDrag(panelRef: RefObject<HTMLElement | null>, handlers: SheetDragHandlers): void {
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    let startX = 0
    let startY = 0
    let lastY = 0
    let lastT = 0
    let speed = 0
    let offset = 0
    let atTop = true
    let onHandle = false
    let decided = false
    let dragging = false

    const begin = (x: number, y: number, target: EventTarget | null) => {
      const el = target instanceof Element ? target : null
      const scroller = el?.closest<HTMLElement>('[data-sheet-scroll]')
      atTop = !scroller || scroller.scrollTop <= 0
      onHandle = !!el?.closest('[data-sheet-handle]')
      startX = x
      startY = y
      lastY = y
      lastT = performance.now()
      speed = 0
      offset = 0
      decided = false
      dragging = false
    }

    /** true — движение забрал лист (прокрутку надо отменить). */
    const move = (x: number, y: number): boolean => {
      if (!decided) {
        const verdict = shouldDrag(x - startX, y - startY, atTop, onHandle)
        if (verdict === null) return false
        decided = true
        dragging = verdict && h.current.canDrag()
        if (dragging) {
          startY = y // без скачка на первые пиксели
          lastY = y
        }
      }
      if (!dragging) return false
      const now = performance.now()
      speed = (y - lastY) / Math.max(1, now - lastT)
      lastY = y
      lastT = now
      offset = Math.max(0, y - startY)
      h.current.onMove(offset)
      return true
    }

    const end = () => {
      if (!dragging) return
      dragging = false
      // Палец давно стоит — скорость не считаем.
      if (performance.now() - lastT > 80) speed = 0
      if (offset > 0) h.current.onRelease(offset, shouldClose(offset, panel.offsetHeight, speed))
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      begin(t.clientX, t.clientY, e.target)
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t && move(t.clientX, t.clientY) && e.cancelable) e.preventDefault()
    }

    // Мышь (проверка на компьютере): тянуть за шапку.
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      if (!(e.target instanceof Element) || !e.target.closest('[data-sheet-handle]')) return
      begin(e.clientX, e.clientY, e.target)
      const onMove = (ev: PointerEvent) => void move(ev.clientX, ev.clientY)
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        end()
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    panel.addEventListener('touchend', end)
    panel.addEventListener('touchcancel', end)
    panel.addEventListener('pointerdown', onPointerDown)
    return () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', end)
      panel.removeEventListener('touchcancel', end)
      panel.removeEventListener('pointerdown', onPointerDown)
    }
  }, [panelRef])
}
