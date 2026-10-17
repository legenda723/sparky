import { describe, expect, it } from 'vitest'
import { FEEDBACK } from './feedback'
import { HAPTICS } from './haptics'
import { SOUNDS, soundLength, type SoundName } from './sounds'

const names = Object.keys(SOUNDS) as SoundName[]

describe('звуки', () => {
  it('у каждого звука есть ноты с разумной громкостью', () => {
    for (const name of names) {
      expect(SOUNDS[name].length).toBeGreaterThan(0)
      for (const tone of SOUNDS[name]) {
        expect(tone.gain).toBeGreaterThan(0)
        expect(tone.gain).toBeLessThanOrEqual(0.35)
        expect(tone.dur).toBeGreaterThan(0)
        expect(tone.freq).toBeGreaterThan(40)
      }
    }
  })

  it('«тик» очень короткий, праздник — не дольше 1,2 с', () => {
    expect(soundLength('tap')).toBeLessThanOrEqual(0.06)
    for (const name of names) expect(soundLength(name)).toBeLessThanOrEqual(1.2)
  })

  it('«верно» идёт вверх, «неверно» — вниз', () => {
    const correct = SOUNDS.correct
    expect(correct[correct.length - 2].freq).toBeGreaterThan(correct[0].freq)
    expect(SOUNDS.wrong[0].freqEnd).toBeLessThan(SOUNDS.wrong[0].freq)
  })
})

describe('отклик', () => {
  it('каждое событие ссылается на существующие звук и вибрацию', () => {
    for (const { sound, haptic } of Object.values(FEEDBACK)) {
      expect(SOUNDS[sound]).toBeDefined()
      expect(HAPTICS[haptic]).toBeDefined()
    }
  })
})
