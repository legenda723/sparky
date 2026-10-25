// Путь (SPEC 7.1): колоды — разделы, узел — 5 слов колоды по порядку.
// Чистые функции: состояния считаются по словам, отдельно не хранятся.
import { State } from 'ts-fsrs'
import { MASTERED_DAYS } from '../srs/status'
import type { Deck } from '../db/types'

/** Слов в узле: один узел — один урок. */
export const NODE_SIZE = 5

export type NodeState = 'locked' | 'current' | 'passed' | 'mastered'

export interface PathCard {
  id: string
  deckId: string
  order: number
  state: State
  stability: number
  suspended: boolean
  deletedAt?: number
}

export type PathDeck = Pick<Deck, 'id' | 'title' | 'emoji' | 'color' | 'order' | 'archived' | 'deletedAt'>

export interface PathNode {
  kind: 'node'
  /** «deckId:номер» — номер узла в колоде с нуля. */
  key: string
  deckId: string
  index: number
  cardIds: string[]
  /** Сколько слов узла уже прошли знакомство. */
  introduced: number
  state: NodeState
}

/** Место следующего урока: появится, когда владелец добавит слова (выглядит как закрытый узел с замком). */
export interface PathGhost {
  kind: 'ghost'
  key: string
  deckId: string
}

/**
 * Будущий урок — только для вида: продолжает путь в туман, когда слов в колоде больше нет
 * (выглядит как закрытый узел; касание — как у «+»: «добавь слова»). Строит pathView, не buildPath.
 */
export interface PathFuture {
  kind: 'future'
  key: string
  deckId: string
}

export type PathItem = PathNode | PathGhost | PathFuture

export interface PathSection {
  deck: PathDeck
  /** Номер раздела с 1. */
  number: number
  /** Узлы, а в конце — место следующего урока, чтобы путь был виден вперёд. */
  items: PathItem[]
}

export interface PathModel {
  sections: PathSection[]
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

/** Живые слова колоды по порядку — из них нарезаются узлы. */
function deckWords<T extends PathCard>(cards: T[], deckId: string): T[] {
  return cards
    .filter((c) => c.deckId === deckId && !c.suspended && c.deletedAt === undefined)
    .sort((a, b) => a.order - b.order)
}

/** Слова узла номер index колоды deckId (для урока узла). */
export function nodeCardIds(cards: PathCard[], deckId: string, index: number): string[] {
  return deckWords(cards, deckId)
    .slice(index * NODE_SIZE, (index + 1) * NODE_SIZE)
    .map((c) => c.id)
}

/** Строит путь: разделы по порядку колод, в каждом — узлы. */
export function buildPath(decks: PathDeck[], cards: PathCard[]): PathModel {
  const live = decks.filter((d) => d.deletedAt === undefined && !d.archived).sort((a, b) => a.order - b.order)
  let current: PathNode | undefined

  const sections = live.map((deck, si): PathSection => {
    const words = deckWords(cards, deck.id)
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
      const node: PathNode = {
        kind: 'node',
        key: `${deck.id}:${i}`,
        deckId: deck.id,
        index: i,
        cardIds: chunk.map((c) => c.id),
        introduced,
        state,
      }
      if (state === 'current') current = node
      items.push(node)
    }
    // Путь виден вперёд: место следующего урока.
    items.push({ kind: 'ghost', key: `${deck.id}:+`, deckId: deck.id })
    return { deck, number: si + 1, items }
  })
  return { sections, current }
}
