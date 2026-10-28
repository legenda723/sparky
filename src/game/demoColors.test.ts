import { describe, expect, it } from 'vitest'
import { demoColor } from './demoColors'

describe('пример цветов кнопок пути', () => {
  it('без примера обе кнопки синие', () => {
    expect([demoColor(null, 'training'), demoColor(null, 'review')]).toEqual(['info', 'info'])
  })

  it('первая половина — тренировка, вторая — повторить', () => {
    expect([demoColor('green-blue', 'training'), demoColor('green-blue', 'review')]).toEqual(['primary', 'info'])
    expect([demoColor('blue-green', 'training'), demoColor('blue-green', 'review')]).toEqual(['info', 'primary'])
    expect([demoColor('blue-blue', 'training'), demoColor('blue-blue', 'review')]).toEqual(['info', 'info'])
  })
})
