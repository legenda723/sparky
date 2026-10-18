import { createEmptyCard, State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { Card } from '../db/types'
import { cardStatus, inHuman, isDue } from '../srs/status'
import { filterCards } from './filter'
import { parseList } from './parseList'

describe('parseList', () => {
  it('короткий формат с разными тире', () => {
    const r = parseList('apple - яблоко\nwell-known — известный\nhouse – дом\ncat\tкошка')
    expect(r.errors).toEqual([])
    expect(r.cards.map((c) => [c.text.front, c.text.back])).toEqual([
      ['apple', 'яблоко'],
      ['well-known', 'известный'],
      ['house', 'дом'],
      ['cat', 'кошка'],
    ])
  })

  it('полный формат, лишние поля можно не писать', () => {
    const r = parseList('apple | яблоко | [ˈæp.əl] | I eat an apple. | Я ем яблоко.\nrun | бежать')
    expect(r.cards[0].text).toEqual({
      front: 'apple',
      back: 'яблоко',
      transcription: '[ˈæp.əl]',
      example: 'I eat an apple.',
      exampleTranslation: 'Я ем яблоко.',
    })
    expect(r.cards[1].text).toMatchObject({ front: 'run', back: 'бежать' })
  })

  it('пустые строки пропускаются, ошибки — с номером строки', () => {
    const r = parseList('apple - яблоко\n\nbanana\n | нет слова')
    expect(r.cards).toHaveLength(1)
    expect(r.errors.map((e) => e.line)).toEqual([3, 4])
  })

  it('дубли: в колоде и внутри списка, без учёта регистра и пробелов', () => {
    const r = parseList('Apple - яблоко\ndog - собака\ndog  - пёс', ['  apple'])
    expect(r.cards.map((c) => c.duplicate)).toEqual([true, false, true])
  })
})

function card(front: string, back: string, patch: Partial<Card> = {}): Card {
  return {
    ...createEmptyCard(new Date(0)),
    id: front,
    deckId: 'd',
    order: 0,
    front,
    back,
    createdAt: 0,
    updatedAt: 0,
    suspended: false,
    ...patch,
  }
}

describe('состояние слова', () => {
  it('новые / учатся / знаю / освоены', () => {
    expect(cardStatus(card('a', 'а'))).toBe('new')
    expect(cardStatus(card('a', 'а', { state: State.Relearning }))).toBe('learning')
    expect(cardStatus(card('a', 'а', { state: State.Review, stability: 20.9 }))).toBe('known')
    expect(cardStatus(card('a', 'а', { state: State.Review, stability: 21 }))).toBe('mastered')
  })

  it('к повторению: не новое, не заморожено, срок подошёл', () => {
    const now = new Date(1000)
    expect(isDue(card('a', 'а', { state: State.Review, due: new Date(500) }), now)).toBe(true)
    expect(isDue(card('a', 'а', { state: State.Review, due: new Date(500), suspended: true }), now)).toBe(false)
    expect(isDue(card('a', 'а', { due: new Date(500) }), now)).toBe(false)
  })

  it('подписи срока по-русски', () => {
    const now = new Date(0)
    const at = (min: number) => new Date(min * 60000)
    expect(inHuman(at(10), now)).toBe('через 10 минут')
    expect(inHuman(at(60 * 24 * 12), now)).toBe('через 12 дней')
    expect(inHuman(at(60 * 24 * 21), now)).toBe('через 21 день')
    expect(inHuman(at(60 * 3), now)).toBe('через 3 часа')
  })
})

describe('поиск и фильтр', () => {
  const cards = [card('apple', 'яблоко'), card('house', 'дом', { state: State.Review, stability: 30 })]
  it('ищет по слову и переводу без учёта регистра', () => {
    expect(filterCards(cards, 'all', 'APP').map((c) => c.front)).toEqual(['apple'])
    expect(filterCards(cards, 'all', 'дом').map((c) => c.front)).toEqual(['house'])
  })
  it('фильтр по состоянию', () => {
    expect(filterCards(cards, 'mastered', '').map((c) => c.front)).toEqual(['house'])
    expect(filterCards(cards, 'new', '').map((c) => c.front)).toEqual(['apple'])
  })
})
