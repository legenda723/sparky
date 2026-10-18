import { describe, expect, it } from 'vitest'
import { SPRING_SHEET, springCurve, springRemaining } from './spring'

const points = (easing: string) => easing.replace(/^linear\(|\)$/g, '').split(', ').map(Number)

describe('пружина', () => {
  it('без отскока: путь идёт только вперёд и кончается ровно в цели', () => {
    const c = springCurve(SPRING_SHEET, 800)
    const p = points(c.easing)
    expect(p[0]).toBe(0)
    expect(p[p.length - 1]).toBe(1)
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1])
    expect(Math.max(...p)).toBeLessThanOrEqual(1)
  })

  it('лист открывается быстро: на 90% пути за четверть секунды, целиком — меньше 0,8 с', () => {
    expect(1 - springRemaining(SPRING_SHEET, 0, 0.25)).toBeGreaterThan(0.85)
    const c = springCurve(SPRING_SHEET, 800)
    expect(c.ms).toBeGreaterThan(400)
    expect(c.ms).toBeLessThan(800)
  })

  it('подхватывает скорость: брошенный лист в начале едет быстрее', () => {
    const still = points(springCurve(SPRING_SHEET, 400).easing)
    const thrown = points(springCurve(SPRING_SHEET, 400, 3000).easing)
    expect(thrown[1]).toBeGreaterThan(still[1])
  })

  it('нечего двигать — нулевая длительность', () => {
    expect(springCurve(SPRING_SHEET, 0.2).ms).toBe(0)
  })

  it('с отскоком (затухание меньше 1) перелетает цель', () => {
    const p = points(springCurve({ response: 0.4, damping: 0.5 }, 300).easing)
    expect(Math.max(...p)).toBeGreaterThan(1)
  })
})
