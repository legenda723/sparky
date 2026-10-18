import { describe, expect, it } from 'vitest'
import { fitSize } from './image'
import { pickMimeType } from './recorder'

describe('fitSize', () => {
  it('уменьшает по длинной стороне до 800', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 800, height: 600 })
    expect(fitSize(3024, 4032)).toEqual({ width: 600, height: 800 })
  })
  it('маленькие не увеличивает', () => {
    expect(fitSize(300, 200)).toEqual({ width: 300, height: 200 })
  })
})

describe('pickMimeType', () => {
  it('iPhone — mp4, иначе webm', () => {
    expect(pickMimeType((t) => t === 'audio/mp4' || t === 'audio/webm')).toBe('audio/mp4')
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
    expect(pickMimeType(() => false)).toBeUndefined()
  })
})
