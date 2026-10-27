// Порядок новых слов (решение владельца 2026-10-27): по порядку добавления карточек из всех колод.
// Один порядок и для пути (узлы по 5 слов), и для сборщика урока — урок узла = ровно слова этого узла.

export interface AddedOrder {
  id: string
  deckId: string
  order: number
  /** Когда слово добавлено (мс). Слова, вставленные списком, добавлены в одно время — дальше по порядку в колоде. */
  createdAt?: number
}

/** Раньше добавленное — раньше; одновременно добавленные — по колоде и порядку в ней. */
export function byAdded(a: AddedOrder, b: AddedOrder): number {
  return (
    (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
    (a.deckId < b.deckId ? -1 : a.deckId > b.deckId ? 1 : 0) ||
    a.order - b.order ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
