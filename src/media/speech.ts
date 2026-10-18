// Озвучка слова: своя запись владельца, иначе голос iOS (speechSynthesis — бесплатно и офлайн).
// iOS разрешает звук только после касания: unlockSpeech() зовём из обработчика касания «УЧИТЬ»,
// после этого озвучка при показе слова работает до конца урока.

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

export interface SpeakOptions {
  voiceURI?: string
  /** Скорость голоса из настроек, 1 — обычная. */
  rate: number
  /** Медленно (кнопка с черепахой в аудировании). */
  slow?: boolean
}

/**
 * Голос iPhone почти не замедляется при скорости 0.6 (проверено владельцем), поэтому «медленно» — 0.21 (по просьбе владельца: 0.3 → ещё на 30% медленнее).
 * Своя запись владельца — проигрывается в 0.45 скорости с сохранением высоты голоса.
 */
export const SLOW_SPEECH_RATE = 0.21
const SLOW_PLAYBACK_RATE = 0.45

// Тишина 0,1 с — чтобы «разбудить» общий проигрыватель в момент касания.
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

let player: HTMLAudioElement | null = null
let playerUrl: string | null = null

function ambient() {
  const nav = navigator as Navigator & AudioSessionNavigator
  if (nav.audioSession) nav.audioSession.type = 'ambient'
}

function getPlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  player ??= new Audio()
  return player
}

function synth(): SpeechSynthesis | null {
  return typeof speechSynthesis === 'undefined' ? null : speechSynthesis
}

/** Звать синхронно в обработчике касания. */
export function unlockSpeech(): void {
  try {
    ambient()
    const p = getPlayer()
    if (p) {
      p.src = SILENCE
      void p.play().catch(() => {})
    }
    const s = synth()
    if (s) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      s.speak(u)
    }
  } catch {
    // озвучка — не главное, молча продолжаем
  }
}

/** Лучший английский голос: выбранный в настройках, иначе американский встроенный. */
export function pickVoice(voices: SpeechSynthesisVoice[], voiceURI?: string): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === voiceURI)
    if (chosen) return chosen
  }
  const en = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'))
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.replace('_', '-').toLowerCase() === 'en-us' ? 2 : 0) + (v.localService ? 1 : 0) + (v.default ? 0.5 : 0)
  return en.sort((a, b) => score(b) - score(a))[0]
}

export function stopSpeech(): void {
  synth()?.cancel()
  player?.pause()
}

function speakText(text: string, opts: SpeakOptions): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  const voice = pickVoice(s.getVoices(), opts.voiceURI)
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  }
  u.rate = opts.slow ? opts.rate * SLOW_SPEECH_RATE : opts.rate
  s.speak(u)
}

/** Произнести слово: если есть своя запись — она, иначе голос iOS. */
export function speak(text: string, opts: SpeakOptions, recording?: Blob): void {
  try {
    ambient()
    stopSpeech()
    const p = recording ? getPlayer() : null
    if (recording && p) {
      if (playerUrl) URL.revokeObjectURL(playerUrl)
      playerUrl = URL.createObjectURL(recording)
      p.src = playerUrl
      // Новая запись сбрасывает скорость к defaultPlaybackRate — задаём обе.
      p.defaultPlaybackRate = opts.slow ? SLOW_PLAYBACK_RATE : 1
      p.playbackRate = p.defaultPlaybackRate
      p.preservesPitch = true
      void p.play().catch(() => speakText(text, opts))
      return
    }
    speakText(text, opts)
  } catch {
    // нет озвучки — урок идёт дальше
  }
}
