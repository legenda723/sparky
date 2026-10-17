import { useState, type PointerEvent } from 'react'

/**
 * Состояние «нажато» по касанию. На iOS :active без слушателей не срабатывает,
 * поэтому ведём его сами: data-pressed ставится сразу при касании.
 */
export function usePress(disabled = false) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  return {
    pressed: pressed && !disabled,
    pressHandlers: {
      onPointerDown: (e: PointerEvent) => {
        if (!disabled && e.button === 0) setPressed(true)
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  }
}
