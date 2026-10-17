// Проигрывает звуки из sounds.ts через Web Audio. Звать только из обработчика касания (требование iOS).
import { SOUNDS, type SoundName } from './sounds'
import { debugLog } from './debug'

const MASTER_GAIN = 0.7

let ctx: AudioContext | null = null
let master: GainNode | null = null

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof AudioContext === 'undefined') return null
  // iOS 16.4+: «ambient» — уважает беззвучный режим и не глушит музыку.
  const nav = navigator as Navigator & AudioSessionNavigator
  if (nav.audioSession) nav.audioSession.type = 'ambient'
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(ctx.destination)
  return ctx
}

export function playSound(name: SoundName): void {
  try {
    const ac = ensureContext()
    if (!ac || !master) return
    if (ac.state === 'suspended') void ac.resume()
    const t0 = ac.currentTime + 0.005
    for (const tone of SOUNDS[name]) {
      const osc = ac.createOscillator()
      const env = ac.createGain()
      osc.type = tone.wave
      const start = t0 + tone.start
      const end = start + tone.dur
      osc.frequency.setValueAtTime(tone.freq, start)
      if (tone.freqEnd) osc.frequency.exponentialRampToValueAtTime(tone.freqEnd, end)
      env.gain.setValueAtTime(0.0001, start)
      env.gain.linearRampToValueAtTime(tone.gain, start + Math.min(0.008, tone.dur / 4))
      env.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(env)
      env.connect(master)
      osc.start(start)
      osc.stop(end + 0.02)
      osc.onended = () => {
        osc.disconnect()
        env.disconnect()
      }
    }
    debugLog('sound', name)
  } catch {
    // Звук — украшение: если браузер не дал, молча продолжаем.
  }
}
