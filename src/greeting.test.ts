import { describe, expect, it } from 'vitest'
import { greeting } from './greeting'

describe('greeting', () => {
  it('здоровается со Спарки по умолчанию', () => {
    expect(greeting()).toBe('Привет, Спарки!')
  })

  it('подставляет другое имя', () => {
    expect(greeting('мир')).toBe('Привет, мир!')
  })
})
