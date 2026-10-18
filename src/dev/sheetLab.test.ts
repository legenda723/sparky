import { describe, expect, it } from 'vitest'
import { analyze } from './sheetLab'

const frames = (ys: number[], from = 16, step = 16) => ys.map((y, i) => ({ t: from + i * step, y }))

describe('замер листа', () => {
  it('плавно: трогается в первом кадре мелким шагом', () => {
    const r = analyze(0, 0, 100, frames([0, 10, 30, 55, 80, 95, 100, 100]))
    expect(r).toMatchObject({ delay: 32, firstStep: 10, maxStep: 25, maxFrame: 16 })
  })
  it('пауза и рывок: долго стоит, потом сразу полпути', () => {
    const r = analyze(0, 0, 100, [{ t: 300, y: 60 }, { t: 316, y: 85 }, { t: 332, y: 100 }])
    expect(r).toMatchObject({ delay: 300, firstStep: 60, maxStep: 60, total: 332 })
  })
  it('не сдвинулся — не замер', () => {
    expect(analyze(0, 0, 100, frames([0, 0, 0]))).toBeNull()
  })
})
