import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { addCard, addCards, deleteCard, listCards, restoreCard, setSuspended, updateCard } from './cards'
import { SparkyDb } from './db'
import { createDeck, deleteDeck, listDecks, reorderDecks, restoreDeck, updateDeck } from './decks'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`data-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const img = () => ({ kind: 'image' as const, blob: new Blob(['jpg']), mime: 'image/jpeg', width: 800, height: 600 })

describe('колоды', () => {
  it('создание по порядку, переименование, смена цвета', async () => {
    const d = freshDb()
    const a = await createDeck(d, { title: '  Еда ', emoji: '🍎', color: 'green' })
    const b = await createDeck(d, { title: 'Дом', emoji: '🏠', color: 'blue' })
    expect(a.title).toBe('Еда')
    expect([a.order, b.order]).toEqual([0, 1])
    await updateDeck(d, a.id, { title: 'Фрукты', color: 'pink', emoji: '🍓' })
    expect(await d.decks.get(a.id)).toMatchObject({ title: 'Фрукты', color: 'pink', emoji: '🍓' })
  })

  it('порядок меняется', async () => {
    const d = freshDb()
    const a = await createDeck(d, { title: 'A', emoji: '🅰️', color: 'green' })
    const b = await createDeck(d, { title: 'B', emoji: '🅱️', color: 'green' })
    await reorderDecks(d, [b.id, a.id])
    expect((await listDecks(d)).map((x) => x.title)).toEqual(['B', 'A'])
  })

  it('удаление мягкое и возвращается вместе с карточками', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const [c1, c2] = await addCards(d, deck.id, [
      { front: 'apple', back: 'яблоко' },
      { front: 'pear', back: 'груша' },
    ])
    // Карточка, удалённая раньше отдельно, при возврате колоды остаётся удалённой.
    await deleteCard(d, c2.id, 100)
    const stamp = await deleteDeck(d, deck.id, 200)
    expect(await listDecks(d)).toEqual([])
    expect(await d.cards.count()).toBe(2) // ничего не стёрто
    await restoreDeck(d, deck.id, stamp)
    expect((await listDecks(d)).map((x) => x.id)).toEqual([deck.id])
    expect((await listCards(d, deck.id)).map((c) => c.id)).toEqual([c1.id])
  })
})

describe('карточки', () => {
  it('новая карточка: чистые поля и состояние «новое» FSRS', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const card = await addCard(d, deck.id, { front: ' apple ', back: 'яблоко', transcription: ' ', note: 'фрукт' })
    expect(card).toMatchObject({ front: 'apple', back: 'яблоко', note: 'фрукт', state: 0, reps: 0, suspended: false })
    expect(card.transcription).toBeUndefined()
    expect(card.due).toBeInstanceOf(Date)
  })

  it('порядок карточек сохраняется при добавлении списком', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    await addCard(d, deck.id, { front: 'one', back: 'один' })
    await addCards(d, deck.id, [
      { front: 'two', back: 'два' },
      { front: 'three', back: 'три' },
    ])
    expect((await listCards(d, deck.id)).map((c) => c.front)).toEqual(['one', 'two', 'three'])
  })

  it('правка текста: убранное поле исчезает', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const card = await addCard(d, deck.id, { front: 'aple', back: 'яблоко', example: 'An apple.' })
    await updateCard(d, card.id, { front: 'apple', back: 'яблоко' })
    const saved = await d.cards.get(card.id)
    expect(saved?.front).toBe('apple')
    expect(saved?.example).toBeUndefined()
  })

  it('фото: добавить, заменить (старое уходит), не трогать, убрать', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const card = await addCard(d, deck.id, { front: 'apple', back: 'яблоко' }, { image: img() })
    const first = card.imageId!
    expect(await d.media.get(first)).toBeDefined()

    await updateCard(d, card.id, { front: 'apple', back: 'яблоко' }, { image: img() })
    const second = (await d.cards.get(card.id))!.imageId!
    expect(second).not.toBe(first)
    expect(await d.media.get(first)).toBeUndefined()

    await updateCard(d, card.id, { front: 'apple', back: 'яблочко' })
    expect((await d.cards.get(card.id))!.imageId).toBe(second)

    await updateCard(d, card.id, { front: 'apple', back: 'яблоко' }, { image: null })
    expect((await d.cards.get(card.id))!.imageId).toBeUndefined()
    expect(await d.media.count()).toBe(0)
  })

  it('удаление мягкое: медиа остаются, «Отменить» возвращает', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const card = await addCard(d, deck.id, { front: 'apple', back: 'яблоко' }, { audio: { kind: 'audio', blob: new Blob(['a']), mime: 'audio/mp4', durationMs: 900 } })
    await deleteCard(d, card.id)
    expect(await listCards(d, deck.id)).toEqual([])
    expect(await d.media.count()).toBe(1)
    await restoreCard(d, card.id)
    expect((await listCards(d, deck.id)).map((c) => c.id)).toEqual([card.id])
  })

  it('заморозка', async () => {
    const d = freshDb()
    const deck = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' })
    const card = await addCard(d, deck.id, { front: 'apple', back: 'яблоко' })
    await setSuspended(d, card.id, true)
    expect((await d.cards.get(card.id))?.suspended).toBe(true)
  })
})
