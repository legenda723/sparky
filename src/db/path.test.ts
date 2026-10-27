import 'fake-indexeddb/auto'
import { State } from 'ts-fsrs'
import { afterEach, describe, expect, it } from 'vitest'
import { addCards } from './cards'
import { SparkyDb } from './db'
import { createDeck } from './decks'
import { loadPath } from './path'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`path-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const T = new Date('2026-10-18T15:00')

describe('путь из базы', () => {
  it('одна змейка из всех колод по порядку добавления, текущий, место следующего урока', async () => {
    const db = freshDb()
    const food = await createDeck(db, { title: 'Еда', emoji: '🍎', color: 'green' })
    const verbs = await createDeck(db, { title: 'Глаголы', emoji: '🏃', color: 'blue' })
    const cards = await addCards(db, food.id, Array.from({ length: 5 }, (_, i) => ({ front: `w${i}`, back: `с${i}` })), 1000)
    const run = await addCards(db, verbs.id, [{ front: 'run', back: 'бегать' }], 2000)
    const more = await addCards(db, food.id, [{ front: 'tea', back: 'чай' }], 3000)
    for (const c of cards) {
      await db.cards.update(c.id, { state: State.Review, stability: 3, due: new Date('2026-10-25T10:00'), last_review: new Date('2026-10-17T10:00') })
    }
    const data = await loadPath(db, T)
    expect(data.path.current?.key).toBe('n:1')
    // Второй узел — слова в порядке добавления, из разных колод.
    expect(data.path.current?.cardIds).toEqual([run[0].id, more[0].id])
    expect(data.today).toMatchObject({ due: 0, dueNow: 0, newAvailable: 2 })
    // Места — только уроки и место следующего урока (разделов и сундуков нет).
    expect(data.path.items.map((x) => x.kind)).toEqual(['node', 'node', 'ghost'])
  })
})
