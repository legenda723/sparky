// Вибрация через web-haptics (DESIGN.md → «Вибрация»). В iOS Safari нет navigator.vibrate,
// библиотека использует обходной путь; если он сломается — тихо отключаемся.
import { WebHaptics, type HapticInput } from 'web-haptics'
import { debugLog } from './debug'

export type HapticName = 'tap' | 'correct' | 'wrong' | 'celebrate'

export const HAPTICS: Record<HapticName, HapticInput> = {
  // лёгкая
  tap: [{ duration: 12, intensity: 0.4 }],
  // лёгкая двойная
  correct: [
    { duration: 15, intensity: 0.5 },
    { delay: 70, duration: 15, intensity: 0.5 },
  ],
  // средняя
  wrong: [{ duration: 30, intensity: 0.7 }],
  // серия
  celebrate: [
    { duration: 20, intensity: 0.6 },
    { delay: 60, duration: 20, intensity: 0.7 },
    { delay: 60, duration: 30, intensity: 0.85 },
    { delay: 80, duration: 40, intensity: 1 },
  ],
}

let haptics: WebHaptics | null = null
let broken = false

export function vibrate(name: HapticName): void {
  if (broken) return
  try {
    haptics ??= new WebHaptics()
    haptics.trigger(HAPTICS[name]).catch(() => {
      broken = true
    })
    debugLog('haptic', name)
  } catch {
    broken = true
  }
}
