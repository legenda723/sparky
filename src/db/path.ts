// Данные экрана «Путь» и открытие сундука (SPEC 7.1).
import { buildPath, type PathModel } from '../game/path'
import { newPerLesson, todayCounts, type TodayCounts } from '../srs/lesson'
import type { SparkyDb } from './db'
import { loadLessonInput } from './review'
import { DEFAULT_PROFILE } from './types'

/** Ключ памяти экрана «Путь» (liveCache). */
export const PATH_KEY = 'path'

export interface PathData {
  path: PathModel
  today: TodayCounts
  /** Сколько новых слов помещается в один урок (по размеру урока). */
  newPerLesson: number
  /** Английское слово и перевод — для списка слов пройденного узла. */
  words: Map<string, { front: string; back: string }>
  gems: number
}

/** Путь, что ждёт сегодня и кристаллы — одним чтением. */
export async function loadPath(db: SparkyDb, at: Date): Promise<PathData> {
  const [decks, input, profile] = await Promise.all([
    db.decks.orderBy('order').toArray(),
    loadLessonInput(db, at),
    db.profile.get('me'),
  ])
  const p = profile ?? DEFAULT_PROFILE
  return {
    path: buildPath(decks, input.cards, p.chestsClaimed),
    today: todayCounts(input.cards, input.deckOrder, at, input.limits),
    newPerLesson: newPerLesson(input.limits.size),
    words: new Map(input.cards.map((c) => [c.id, { front: c.front, back: c.back }])),
    gems: p.gems,
  }
}

/**
 * Открывает сундук: кристаллы и отметка «открыт» — одной транзакцией.
 * Уже открытый сундук второй раз ничего не даёт (двойное касание). Возвращает, сколько стало кристаллов, или null.
 */
export async function openChest(db: SparkyDb, key: string, gems: number): Promise<number | null> {
  return db.transaction('rw', db.profile, async () => {
    const profile = (await db.profile.get('me')) ?? DEFAULT_PROFILE
    if (profile.chestsClaimed.includes(key)) return null
    const total = profile.gems + gems
    await db.profile.put({ ...profile, gems: total, chestsClaimed: [...profile.chestsClaimed, key] })
    return total
  })
}
