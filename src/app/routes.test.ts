import { describe, expect, it } from 'vitest'
import { parseRoute, parseSubPath, routeHref } from './routes'

describe('parseRoute', () => {
  it('пустой адрес → Путь', () => {
    expect(parseRoute('')).toBe('path')
    expect(parseRoute('#/')).toBe('path')
  })

  it('вкладки и витрина', () => {
    expect(parseRoute('#/words')).toBe('words')
    expect(parseRoute('#/stats')).toBe('stats')
    expect(parseRoute('#/profile')).toBe('profile')
    expect(parseRoute('#/dev')).toBe('dev')
    expect(parseRoute('#/lesson')).toBe('lesson')
  })

  it('хвосты адреса не мешают', () => {
    expect(parseRoute('#/words/deck-1')).toBe('words')
    expect(parseRoute('#/profile?x=1')).toBe('profile')
  })

  it('неизвестное → Путь', () => {
    expect(parseRoute('#/nope')).toBe('path')
  })

  it('ссылка и разбор согласованы', () => {
    expect(parseRoute(routeHref('stats'))).toBe('stats')
  })
})

describe('parseSubPath', () => {
  it('хвост после вкладки', () => {
    expect(parseSubPath('#/words')).toBe('')
    expect(parseSubPath('#/words/deck-1')).toBe('deck-1')
    expect(parseSubPath('#/words/deck-1?x=1')).toBe('deck-1')
  })
})
