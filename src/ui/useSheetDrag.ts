// Закрытие листа свайпом вниз (как окна iPhone): тянуть за шапку или за содержимое,
// когда оно прокручено до самого верха. Отпустил далеко или быстро — лист уезжает, иначе
// мягко возвращается. Сдвиг пальцем — CSS-свойство translate: оно складывается с анимацией
// выезда (transform) и не мешает ей.
import { useEffect, useRef, type RefObject } from 'react'

/** Закрыть, если утянули дальше этой доли высоты листа… */
const CLOSE_SHARE = 0.25
/** …или отпустили быстрее этого (px/мс). */
const CLOSE_SPEED = 0.5
const SNAP_MS = 320
const SNAP_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** Решение по первому движению: тянуть лист или отдать жест прокрутке. */
export function shouldDrag(dx: number, dy: number, atTop: boolean, onHandle: boolean): boolean | null {
  if (dx === 0 && dy === 0) return null
  return dy > 0 && dy >= Math.abs(dx) && (atTop || onHandle)
}

/** Отпустили: закрывать или вернуть на место. */
export function shouldClose(offset: number, height: number, speed: number): boolean {
  return offset > height * CLOSE_SHARE || speed > CLOSE_SPEED
}

export function useSheetDrag(
  panelRef: RefObject<HTMLElement | null>,
  dimRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

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
    let closing = false

    const apply = (px: number, animate: boolean) => {
      const t = animate ? `${SNAP_MS}ms ${SNAP_EASE}` : 'none'
      panel.style.transition = animate ? `translate ${t}` : 'none'
      panel.style.translate = px ? `0 ${px}px` : ''
      const dim = dimRef.current
      if (dim) {
        dim.style.transition = animate ? `opacity ${t}` : 'none'
        dim.style.opacity = String(1 - Math.min(1, px / panel.offsetHeight))
      }
    }

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
      if (closing) return true
      if (!decided) {
        const verdict = shouldDrag(x - startX, y - startY, atTop, onHandle)
        if (verdict === null) return false
        decided = true
        dragging = verdict
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
      apply(offset, false)
      return true
    }

    const end = () => {
      if (!dragging) return
      dragging = false
      // Палец давно стоит — скорость не считаем.
      if (performance.now() - lastT > 80) speed = 0
      if (offset > 0 && shouldClose(offset, panel.offsetHeight, speed)) {
        closing = true
        closeRef.current() // лист уезжает дальше с того места, где его отпустили
      } else {
        apply(0, true)
      }
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
  }, [panelRef, dimRef])
}
