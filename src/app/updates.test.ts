import { describe, expect, it } from 'vitest'
import { AUTO_APPLY_MS, decideUpdate } from './updates'

describe('decideUpdate', () => {
  it('сразу после открытия включает новую версию сама', () => {
    expect(decideUpdate(0, false)).toBe('apply')
    expect(decideUpdate(AUTO_APPLY_MS - 1, false)).toBe('apply')
  })

  it('во время работы — только по кнопке', () => {
    expect(decideUpdate(AUTO_APPLY_MS, false)).toBe('prompt')
    expect(decideUpdate(5 * 60_000, false)).toBe('prompt')
  })

  it('посреди урока — никогда, даже сразу после открытия', () => {
    expect(decideUpdate(0, true)).toBe('wait')
    expect(decideUpdate(5 * 60_000, true)).toBe('wait')
  })
})
