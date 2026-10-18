// Карточки. Удаление мягкое (deletedAt), журнал оценок и медиа остаются.
import { newFsrsFields } from '../srs/newCard'
import type { SparkyDb } from './db'
import type { Card, Id, Media } from './types'

/** Текстовые поля, которые владелец заполняет сам. */
export interface CardText {
  front: string
  back: string
  transcription?: string
  example?: string
  exampleTranslation?: string
  note?: string
}

/** Новое фото или запись: blob + описание. null — убрать. undefined — не трогать. */
export type MediaInput = Omit<Media, 'id' | 'createdAt'> | null | undefined

const OPTIONAL = ['transcription', 'example', 'exampleTranslation', 'note'] as const

/** Обрезает пробелы; пустые необязательные поля не храним. */
export function cleanText(text: CardText): CardText {
  const out: CardText = { front: text.front.trim(), back: text.back.trim() }
  for (const key of OPTIONAL) {
    const v = text[key]?.trim()
    if (v) out[key] = v
  }
  return out
}

export async function listCards(db: SparkyDb, deckId: Id): Promise<Card[]> {
  const all = await db.cards.where('[deckId+order]').between([deckId, -Infinity], [deckId, Infinity]).toArray()
  return all.filter((c) => c.deletedAt === undefined)
}

async function nextOrder(db: SparkyDb, deckId: Id): Promise<number> {
  const last = await db.cards.where('[deckId+order]').between([deckId, -Infinity], [deckId, Infinity]).last()
  return (last?.order ?? -1) + 1
}

function makeCard(deckId: Id, text: CardText, order: number, now: number): Card {
  return {
    ...newFsrsFields(new Date(now)),
    ...cleanText(text),
    id: crypto.randomUUID(),
    deckId,
    order,
    createdAt: now,
    updatedAt: now,
    suspended: false,
  }
}

async function saveMedia(db: SparkyDb, input: MediaInput, now: number): Promise<Id | undefined> {
  if (!input) return undefined
  const id = crypto.randomUUID()
  await db.media.add({ ...input, id, createdAt: now })
  return id
}

export async function addCard(
  db: SparkyDb,
  deckId: Id,
  text: CardText,
  media: { image?: MediaInput; audio?: MediaInput } = {},
  now = Date.now(),
): Promise<Card> {
  return db.transaction('rw', db.cards, db.media, async () => {
    const card = makeCard(deckId, text, await nextOrder(db, deckId), now)
    const imageId = await saveMedia(db, media.image, now)
    const audioId = await saveMedia(db, media.audio, now)
    if (imageId) card.imageId = imageId
    if (audioId) card.audioId = audioId
    await db.cards.add(card)
    return card
  })
}

/** Много карточек одной транзакцией («Вставить списком»). */
export async function addCards(db: SparkyDb, deckId: Id, texts: CardText[], now = Date.now()): Promise<Card[]> {
  return db.transaction('rw', db.cards, async () => {
    const start = await nextOrder(db, deckId)
    const cards = texts.map((t, i) => makeCard(deckId, t, start + i, now))
    await db.cards.bulkAdd(cards)
    return cards
  })
}

/**
 * Правка карточки. Фото или запись, которые владелец заменил или убрал сам,
 * удаляются из базы — иначе они копились бы в бэкапе мёртвым грузом.
 */
export async function updateCard(
  db: SparkyDb,
  id: Id,
  text: CardText,
  media: { image?: MediaInput; audio?: MediaInput } = {},
  now = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.cards, db.media, async () => {
    const card = await db.cards.get(id)
    if (!card) return
    const next: Card = { ...card, updatedAt: now }
    for (const key of OPTIONAL) delete next[key]
    Object.assign(next, cleanText(text))
    for (const [field, input] of [
      ['imageId', media.image],
      ['audioId', media.audio],
    ] as const) {
      if (input === undefined) continue
      const old = card[field]
      if (old) await db.media.delete(old)
      delete next[field]
      const newId = await saveMedia(db, input, now)
      if (newId) next[field] = newId
    }
    await db.cards.put(next)
  })
}

export async function deleteCard(db: SparkyDb, id: Id, now = Date.now()): Promise<void> {
  await db.cards.update(id, { deletedAt: now })
}

export async function restoreCard(db: SparkyDb, id: Id): Promise<void> {
  await db.cards.where('id').equals(id).modify((c) => {
    delete c.deletedAt
  })
}

export async function setSuspended(db: SparkyDb, id: Id, suspended: boolean, now = Date.now()): Promise<void> {
  await db.cards.update(id, { suspended, updatedAt: now })
}
