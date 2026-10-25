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
  it('узлы колоды, текущий, место следующего урока', async () => {
    const db = freshDb()
    const deck = await createDeck(db, { title: 'Еда', emoji: '🍎', color: 'green' })
    const cards = await addCards(db, deck.id, Array.from({ length: 7 }, (_, i) => ({ front: `w${i}`, back: `с${i}` })))
    for (const c of cards.slice(0, 5)) {
      await db.cards.update(c.id, { state: State.Review, stability: 3, due: new Date('2026-10-25T10:00'), last_review: new Date('2026-10-17T10:00') })
    }
    const data = await loadPath(db, T)
    expect(data.path.sections).toHaveLength(1)
    expect(data.path.current?.key).toBe(`${deck.id}:1`)
    expect(data.today).toMatchObject({ due: 0, dueNow: 0, newAvailable: 2 })
    // Места — только уроки и место следующего урока (сундуков нет).
    expect(data.path.sections[0].items.map((x) => x.kind)).toEqual(['node', 'node', 'ghost'])
  })

})
