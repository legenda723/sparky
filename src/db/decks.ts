// Колоды. Удаление мягкое: колода и её карточки получают одну и ту же отметку deletedAt,
// поэтому «Отменить» возвращает ровно то, что удалилось этим нажатием.
import type { SparkyDb } from './db'
import type { Deck, DeckColor, Id } from './types'

export interface DeckInput {
  title: string
  emoji: string
  color: DeckColor
}

export async function listDecks(db: SparkyDb): Promise<Deck[]> {
  const all = await db.decks.orderBy('order').toArray()
  return all.filter((d) => d.deletedAt === undefined)
}

export async function createDeck(db: SparkyDb, input: DeckInput, now = Date.now()): Promise<Deck> {
  return db.transaction('rw', db.decks, async () => {
    const last = await db.decks.orderBy('order').last()
    const deck: Deck = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      emoji: input.emoji,
      color: input.color,
      order: (last?.order ?? -1) + 1,
      createdAt: now,
      archived: false,
    }
    await db.decks.add(deck)
    return deck
  })
}

export async function updateDeck(db: SparkyDb, id: Id, patch: Partial<DeckInput>): Promise<void> {
  const clean = { ...patch }
  if (clean.title !== undefined) clean.title = clean.title.trim()
  await db.decks.update(id, clean)
}

/** Новый порядок колод — по списку id сверху вниз. */
export async function reorderDecks(db: SparkyDb, ids: Id[]): Promise<void> {
  await db.transaction('rw', db.decks, async () => {
    await Promise.all(ids.map((id, order) => db.decks.update(id, { order })))
  })
}

/** Мягко удаляет колоду вместе с её карточками. Возвращает отметку для «Отменить». */
export async function deleteDeck(db: SparkyDb, id: Id, now = Date.now()): Promise<number> {
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.update(id, { deletedAt: now })
    await db.cards
      .where('deckId')
      .equals(id)
      .filter((c) => c.deletedAt === undefined)
      .modify({ deletedAt: now })
  })
  return now
}

export async function restoreDeck(db: SparkyDb, id: Id, deletedAt: number): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, async () => {
    // Колода возвращается на своё место. Если, пока она была удалена, порядок поменяли
    // и место занято — в конец, чтобы у двух колод не было одного номера.
    const live = await listDecks(db)
    const deck = await db.decks.get(id)
    const taken = live.some((d) => d.order === deck?.order)
    await db.decks.where('id').equals(id).modify((d) => {
      delete d.deletedAt
      if (taken) d.order = (live.at(-1)?.order ?? -1) + 1
    })
    await db.cards
      .where('deckId')
      .equals(id)
      .filter((c) => c.deletedAt === deletedAt)
      .modify((c) => {
        delete c.deletedAt
      })
  })
}
