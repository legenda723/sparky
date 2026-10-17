// Единая точка отклика: событие → звук + вибрация (с учётом настроек).
import { getPrefs } from '../app/prefs'
import { vibrate, type HapticName } from './haptics'
import { playSound } from './player'
import type { SoundName } from './sounds'

export type FeedbackEvent = 'tap' | 'correct' | 'wrong' | 'streak' | 'finish' | 'reward'

export const FEEDBACK: Record<FeedbackEvent, { sound: SoundName; haptic: HapticName }> = {
  tap: { sound: 'tap', haptic: 'tap' },
  correct: { sound: 'correct', haptic: 'correct' },
  wrong: { sound: 'wrong', haptic: 'wrong' },
  streak: { sound: 'streak', haptic: 'celebrate' },
  finish: { sound: 'finish', haptic: 'celebrate' },
  reward: { sound: 'reward', haptic: 'celebrate' },
}

// Вибрация выключена: на iPhone владельца её почти не слышно, а обходной путь web-haptics
// делает лишние скрытые нажатия (SPEC → «Решения», 2026-10-18). Вернуть — true.
const HAPTICS_ENABLED = false

/** Звать только в ответ на действие владельца (касание). */
export function feedback(event: FeedbackEvent): void {
  const prefs = getPrefs()
  const { sound, haptic } = FEEDBACK[event]
  if (prefs.sound) playSound(sound)
  if (HAPTICS_ENABLED && prefs.haptics) vibrate(haptic)
}
