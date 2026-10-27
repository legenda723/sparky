import { describe, expect, it } from 'vitest'
import { parseRoute, parseSubPath, routeHref, lessonHref, parseLessonTarget } from './routes'

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

describe('адрес урока', () => {
  it('повторения и узел пути — туда и обратно', () => {
    expect(parseLessonTarget(lessonHref({ kind: 'review' }))).toEqual({ kind: 'review' })
    expect(parseLessonTarget(lessonHref({ kind: 'node', index: 3 }))).toEqual({ kind: 'node', index: 3 })
    expect(lessonHref({ kind: 'node', index: 3 })).toBe('#/lesson/node/3')
    expect(parseRoute(lessonHref({ kind: 'node', index: 0 }))).toBe('lesson')
  })
  it('непонятный хвост — урок повторений', () => {
    expect(parseLessonTarget('#/lesson')).toEqual({ kind: 'review' })
    expect(parseLessonTarget('#/lesson/node/x')).toEqual({ kind: 'review' })
    // Старый адрес «колода/номер» (до 2026-10-27) — просто повторения, без ошибки.
    expect(parseLessonTarget('#/lesson/abc/2')).toEqual({ kind: 'review' })
  })
})
