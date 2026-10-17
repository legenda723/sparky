// Звуки интерфейса — синтез из коротких нот (DESIGN.md → «Звуки»). Без файлов.

export type SoundName = 'tap' | 'correct' | 'wrong' | 'streak' | 'finish' | 'reward'

export interface Tone {
  /** Частота, Гц */
  freq: number
  /** Частота в конце ноты (плавный «съезд»), Гц */
  freqEnd?: number
  /** Начало от старта звука, с */
  start: number
  /** Длительность, с */
  dur: number
  wave: OscillatorType
  /** Громкость ноты 0–1 */
  gain: number
}

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98
const C7 = 2093
const E7 = 2637.02

export const SOUNDS: Record<SoundName, Tone[]> = {
  // короткий мягкий «тик»
  tap: [{ freq: 1300, freqEnd: 800, start: 0, dur: 0.045, wave: 'triangle', gain: 0.12 }],

  // яркий двухнотный «динь» вверх
  correct: [
    { freq: C6, start: 0, dur: 0.14, wave: 'sine', gain: 0.28 },
    { freq: C6 * 2, start: 0, dur: 0.08, wave: 'sine', gain: 0.05 },
    { freq: G6, start: 0.1, dur: 0.3, wave: 'sine', gain: 0.28 },
    { freq: G6 * 2, start: 0.1, dur: 0.12, wave: 'sine', gain: 0.05 },
  ],

  // мягкий низкий «бум»
  wrong: [
    { freq: 220, freqEnd: 120, start: 0, dur: 0.28, wave: 'sine', gain: 0.32 },
    { freq: 165, freqEnd: 100, start: 0.02, dur: 0.25, wave: 'triangle', gain: 0.1 },
  ],

  // нарастающий аккорд (серия 5/10)
  streak: [
    { freq: C5, start: 0, dur: 0.45, wave: 'triangle', gain: 0.16 },
    { freq: E5, start: 0.07, dur: 0.4, wave: 'triangle', gain: 0.16 },
    { freq: G5, start: 0.14, dur: 0.36, wave: 'triangle', gain: 0.16 },
    { freq: C6, start: 0.21, dur: 0.4, wave: 'sine', gain: 0.2 },
  ],

  // короткая фанфара (конец урока)
  finish: [
    { freq: G5, start: 0, dur: 0.12, wave: 'triangle', gain: 0.2 },
    { freq: C6, start: 0.12, dur: 0.12, wave: 'triangle', gain: 0.2 },
    { freq: E6, start: 0.24, dur: 0.12, wave: 'triangle', gain: 0.2 },
    { freq: G6, start: 0.36, dur: 0.55, wave: 'triangle', gain: 0.22 },
    { freq: C6, start: 0.36, dur: 0.55, wave: 'sine', gain: 0.14 },
    { freq: E6, start: 0.36, dur: 0.55, wave: 'sine', gain: 0.12 },
  ],

  // искрящийся перелив (награда, сундук)
  reward: [
    { freq: G6, start: 0, dur: 0.16, wave: 'sine', gain: 0.12 },
    { freq: C7, start: 0.05, dur: 0.16, wave: 'sine', gain: 0.12 },
    { freq: E7, start: 0.1, dur: 0.16, wave: 'sine', gain: 0.11 },
    { freq: G6 * 2, start: 0.15, dur: 0.18, wave: 'sine', gain: 0.1 },
    { freq: E7, start: 0.2, dur: 0.2, wave: 'sine', gain: 0.09 },
    { freq: C7 * 2, start: 0.25, dur: 0.3, wave: 'sine', gain: 0.08 },
  ],
}

/** Полная длина звука в секундах. */
export function soundLength(name: SoundName): number {
  return Math.max(...SOUNDS[name].map((t) => t.start + t.dur))
}
