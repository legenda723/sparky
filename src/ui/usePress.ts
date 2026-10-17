import { useEffect, useRef, useState, type PointerEvent } from 'react'

/** Даже при самом быстром тапе кнопка успевает целиком «провалиться». */
const MIN_PRESS_MS = 60

/**
 * Состояние «нажато» по касанию. На iOS :active без слушателей не срабатывает,
 * поэтому ведём его сами: data-pressed ставится сразу при касании.
 */
export function usePress(disabled = false) {
  const [pressed, setPressed] = useState(false)
  const downAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const release = () => {
    window.clearTimeout(timer.current)
    const left = MIN_PRESS_MS - (performance.now() - downAt.current)
    if (left > 0) timer.current = window.setTimeout(() => setPressed(false), left)
    else setPressed(false)
  }
  return {
    pressed: pressed && !disabled,
    pressHandlers: {
      onPointerDown: (e: PointerEvent) => {
        if (disabled || e.button !== 0) return
        window.clearTimeout(timer.current)
        downAt.current = performance.now()
        setPressed(true)
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  }
}
