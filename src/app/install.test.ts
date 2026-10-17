import { describe, expect, it } from 'vitest'
import { shouldShowInstall } from './install'

describe('shouldShowInstall', () => {
  it('показывается в обычной вкладке опубликованной версии', () => {
    expect(shouldShowInstall(true, false, false)).toBe(true)
  })

  it('не показывается в веб-приложении с экрана Домой', () => {
    expect(shouldShowInstall(true, true, false)).toBe(false)
  })

  it('не показывается после «Всё равно продолжить»', () => {
    expect(shouldShowInstall(true, false, true)).toBe(false)
  })

  it('не показывается в режиме разработки', () => {
    expect(shouldShowInstall(false, false, false)).toBe(false)
  })
})
