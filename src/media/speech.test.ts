import { describe, expect, it } from 'vitest'
import { pickVoice } from './speech'

const v = (voiceURI: string, lang: string, localService = true, isDefault = false) =>
  ({ voiceURI, name: voiceURI, lang, localService, default: isDefault }) as SpeechSynthesisVoice

describe('выбор голоса', () => {
  const voices = [v('ru', 'ru-RU', true, true), v('uk', 'en-GB'), v('us-net', 'en-US', false), v('us', 'en-US')]

  it('по умолчанию — американский встроенный', () => {
    expect(pickVoice(voices)?.voiceURI).toBe('us')
  })
  it('выбранный в настройках', () => {
    expect(pickVoice(voices, 'uk')?.voiceURI).toBe('uk')
  })
  it('выбранного больше нет — снова американский', () => {
    expect(pickVoice(voices, 'gone')?.voiceURI).toBe('us')
  })
  it('нет английских — undefined (iOS выберет сам по языку)', () => {
    expect(pickVoice([voices[0]])).toBeUndefined()
  })
})
