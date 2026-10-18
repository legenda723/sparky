import { describe, expect, it } from 'vitest'
import { baseInterval, summarize } from './frameProbe'

describe('замер кадров', () => {
  it('частота в покое — медиана промежутков', () => {
    expect(baseInterval([16.7, 16.6, 50, 16.8, 16.7])).toBeCloseTo(16.7)
    expect(baseInterval([])).toBeCloseTo(16.67, 1)
  })

  it('считает пропущенные кадры и худший кадр', () => {
    const s = summarize([16.7, 16.7, 50, 16.7, 33.4], 16.7)
    expect(s.frames).toBe(5)
    expect(s.dropped).toBe(3) // 50 мс = 2 пропуска, 33 мс = 1
    expect(s.worst).toBe(50)
    expect(Math.round(s.fps)).toBe(37)
  })
})
