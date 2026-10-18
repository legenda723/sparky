import { describe, expect, it } from 'vitest'
import { shouldClose, shouldDrag } from './useSheetDrag'

describe('свайп листа', () => {
  it('тянем вниз — лист, если содержимое наверху или палец на шапке', () => {
    expect(shouldDrag(0, 5, true, false)).toBe(true)
    expect(shouldDrag(1, 5, false, true)).toBe(true)
  })
  it('содержимое прокручено, вверх или вбок — это прокрутка', () => {
    expect(shouldDrag(0, 5, false, false)).toBe(false)
    expect(shouldDrag(0, -5, true, true)).toBe(false)
    expect(shouldDrag(8, 3, true, true)).toBe(false)
  })
  it('без движения — ещё не решаем', () => {
    expect(shouldDrag(0, 0, true, true)).toBeNull()
  })
  it('закрыть: далеко или быстро; иначе вернуть', () => {
    expect(shouldClose(250, 800, 0)).toBe(true)
    expect(shouldClose(60, 800, 0.9)).toBe(true)
    expect(shouldClose(120, 800, 0.2)).toBe(false)
  })
})
