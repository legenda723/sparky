// Данные экрана «Путь» (SPEC 7.1).
import { buildPath, type PathModel } from '../game/path'
import { newPerLesson, todayCounts, type TodayCounts } from '../srs/lesson'
import type { SparkyDb } from './db'
import { loadLessonInput } from './review'

/** Ключ памяти экрана «Путь» (liveCache). */
export const PATH_KEY = 'path'

export interface PathData {
  path: PathModel
  today: TodayCounts
  /** Сколько новых слов помещается в один урок (по размеру урока). */
  newPerLesson: number
  /** Английское слово и перевод — для списка слов пройденного узла. */
  words: Map<string, { front: string; back: string }>
}

/** Путь и что ждёт сегодня — одним чтением. */
export async function loadPath(db: SparkyDb, at: Date): Promise<PathData> {
  const [decks, input] = await Promise.all([db.decks.orderBy('order').toArray(), loadLessonInput(db, at)])
  return {
    path: buildPath(decks, input.cards),
    today: todayCounts(input.cards, input.deckOrder, at, input.limits),
    newPerLesson: newPerLesson(input.limits.size),
    words: new Map(input.cards.map((c) => [c.id, { front: c.front, back: c.back }])),
  }
}
