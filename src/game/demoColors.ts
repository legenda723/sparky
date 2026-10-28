// Пример цветов кнопок «Пути» для витрины (просьба владельца 2026-10-28): посмотреть на iPhone, как выглядят
// «ТРЕНИРОВКА» и «ПОВТОРИТЬ» зелёной и синей. Только показ: база не меняется, пример держится до закрытия приложения.

/** Цвета кнопок: тренировка, повторить. */
export type DemoColors = 'green-blue' | 'blue-green' | 'blue-blue'

const KEY = 'sparky.demoPathColors'

export function getDemoColors(): DemoColors | null {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'green-blue' || v === 'blue-green' || v === 'blue-blue' ? v : null
  } catch {
    return null
  }
}

export function setDemoColors(v: DemoColors | null): void {
  try {
    if (v) sessionStorage.setItem(KEY, v)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Хранилище недоступно — пример просто не включится.
  }
}

/** Цвет кнопки по примеру: тренировка — первая половина, повторить — вторая. Без примера — синие. */
export function demoColor(demo: DemoColors | null, which: 'training' | 'review'): 'primary' | 'info' {
  if (!demo) return 'info'
  const [training, review] = demo.split('-')
  return (which === 'training' ? training : review) === 'green' ? 'primary' : 'info'
}
