import { useEffect, useState } from 'react'

/**
 * Высота экранной клавиатуры (0 — закрыта). На iPhone клавиатура не уменьшает экран веб-приложения,
 * но уменьшает видимую область (visualViewport) — по разнице поднимаем кнопки над клавиатурой.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const h = Math.round(window.innerHeight - vv.height - vv.offsetTop)
      // Мелкие расхождения (полоса Safari, округления) — не клавиатура.
      setInset(h > 80 ? h : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}
