import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parsePref } from './prefs'
import { resolveTheme } from './theme'

describe('parsePref', () => {
  it('нет значения → по умолчанию', () => {
    expect(parsePref('theme', null)).toBe('system')
    expect(parsePref('sound', null)).toBe(DEFAULT_PREFS.sound)
  })

  it('читает сохранённые значения', () => {
    expect(parsePref('theme', '"dark"')).toBe('dark')
    expect(parsePref('haptics', 'false')).toBe(false)
  })

  it('мусор и чужие типы → по умолчанию', () => {
    expect(parsePref('theme', '"purple"')).toBe('system')
    expect(parsePref('theme', '{oops')).toBe('system')
    expect(parsePref('sound', '"yes"')).toBe(true)
  })
})

describe('resolveTheme', () => {
  it('«как в системе» следует системе', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ручной выбор важнее системы', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
