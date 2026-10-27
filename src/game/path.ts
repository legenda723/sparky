// Путь (SPEC 7.1): одна змейка без разделов — все слова из всех колод по порядку добавления, по 5 в узле
// (решение владельца 2026-10-27: колоды — только папки во вкладке «Слова»).
// Чистые функции: состояния считаются по словам, отдельно не хранятся.
import { State } from 'ts-fsrs'
import { byAdded } from '../srs/order'
import { MASTERED_DAYS } from '../srs/status'
import type { Deck } from '../db/types'

/** Слов в узле: один узел — один урок. */
export const NODE_SIZE = 5

export type NodeState = 'locked' | 'current' | 'passed' | 'mastered'

export interface PathCard {
  id: string
  deckId: string
  order: number
  createdAt?: number
  state: State
  stability: number
  suspended: boolean
  deletedAt?: number
}

export type PathDeck = Pick<Deck, 'id' | 'order' | 'archived' | 'deletedAt'>

export interface PathNode {
  kind: 'node'
  /** «n:номер» — номер узла на пути с нуля. */
  key: string
  index: number
  cardIds: string[]
  /** Сколько слов узла уже прошли знакомство. */
  introduced: number
  state: NodeState
}

/** Место следующего урока в конце пути: появится, когда владелец добавит слова (закрытый узел с замком). */
export interface PathGhost {
  kind: 'ghost'
  key: string
}

/**
 * Будущий урок — только для вида: продолжает путь в туман, когда слов больше нет
 * (выглядит как закрытый узел; касание — как у места следующего урока: «добавь слова»). Строит pathView, не buildPath.
 */
export interface PathFuture {
  kind: 'future'
  key: string
}

export type PathItem = PathNode | PathGhost | PathFuture

export interface PathModel {
  /** Узлы по порядку, а в конце — место следующего урока, чтобы путь был виден вперёд. Слов нет — пусто. */
  items: PathItem[]
  /** Текущий узел — первый непройденный по порядку. Нет — всё пройдено (или слов нет). */
  current?: PathNode
}

/** Слово прошло знакомство: у него уже есть первая оценка FSRS. */
function isIntroduced(c: PathCard): boolean {
  return c.state !== State.New
}

function isMastered(c: PathCard): boolean {
  return c.state === State.Review && c.stability >= MASTERED_DAYS
}

/** Живые слова пути по порядку добавления — из них нарезаются узлы (тот же порядок, что у новых слов в уроке). */
function pathWords<T extends PathCard>(cards: T[]): T[] {
  return cards.filter((c) => !c.suspended && c.deletedAt === undefined).sort(byAdded)
}

/** Слова живых колод (не удалены, не в архиве). */
function inLiveDecks<T extends PathCard>(decks: PathDeck[], cards: T[]): T[] {
  const live = new Set(decks.filter((d) => d.deletedAt === undefined && !d.archived).map((d) => d.id))
  return cards.filter((c) => live.has(c.deckId))
}

/** Слова узла номер index (для урока узла). cards — слова живых колод (loadLessonInput). */
export function nodeCardIds(cards: PathCard[], index: number): string[] {
  return pathWords(cards)
    .slice(index * NODE_SIZE, (index + 1) * NODE_SIZE)
    .map((c) => c.id)
}

/** Строит путь: одна змейка из узлов по 5 слов. */
export function buildPath(decks: PathDeck[], cards: PathCard[]): PathModel {
  const words = pathWords(inLiveDecks(decks, cards))
  if (words.length === 0) return { items: [] }
  let current: PathNode | undefined
  const items: PathItem[] = []
  for (let i = 0; i * NODE_SIZE < words.length; i++) {
    const chunk = words.slice(i * NODE_SIZE, (i + 1) * NODE_SIZE)
    const introduced = chunk.filter(isIntroduced).length
    let state: NodeState
    if (introduced < chunk.length) {
      state = current ? 'locked' : 'current'
    } else {
      state = chunk.every(isMastered) ? 'mastered' : 'passed'
    }
    const node: PathNode = { kind: 'node', key: `n:${i}`, index: i, cardIds: chunk.map((c) => c.id), introduced, state }
    if (state === 'current') current = node
    items.push(node)
  }
  // Путь виден вперёд: место следующего урока.
  items.push({ kind: 'ghost', key: '+' })
  return { items, current }
}
