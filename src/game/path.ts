// Путь (SPEC 7.1): колоды — разделы, узел — 5 слов колоды по порядку, каждые 3 узла — сундук.
// Чистые функции: состояния считаются по словам, отдельно не хранятся.
import { State } from 'ts-fsrs'
import { MASTERED_DAYS } from '../srs/status'
import type { Deck } from '../db/types'

/** Слов в узле: один узел — один урок. */
export const NODE_SIZE = 5
/** Сундук — после каждого третьего узла. */
export const CHEST_EVERY = 3
/** Кристаллов в сундуке — случайно в этих пределах. */
export const CHEST_GEMS = { min: 10, max: 20 } as const

export type NodeState = 'locked' | 'current' | 'passed' | 'mastered'
export type ChestState = 'locked' | 'ready' | 'opened'

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

export interface PathChest {
  kind: 'chest'
  /** «deckId:номер сундука» — так он записан в профиле (chestsClaimed). */
  key: string
  deckId: string
  state: ChestState
}

/** Место будущего урока: появится, когда владелец добавит слова (пунктирный «+»). */
export interface PathGhost {
  kind: 'ghost'
  key: string
  deckId: string
}

export type PathItem = PathNode | PathChest | PathGhost

export interface PathSection {
  deck: PathDeck
  /** Номер раздела с 1. */
  number: number
  /** Узлы и сундуки, а в конце — места будущих уроков и сундук-цель, чтобы путь был виден вперёд. */
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

export function chestKey(deckId: string, n: number): string {
  return `${deckId}:${n}`
}

/** Строит путь: разделы по порядку колод, в каждом — узлы и сундуки. */
export function buildPath(decks: PathDeck[], cards: PathCard[], chestsClaimed: string[]): PathModel {
  const live = decks.filter((d) => d.deletedAt === undefined && !d.archived).sort((a, b) => a.order - b.order)
  const claimed = new Set(chestsClaimed)
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
      if ((i + 1) % CHEST_EVERY === 0) {
        const key = chestKey(deck.id, (i + 1) / CHEST_EVERY)
        const done = state === 'passed' || state === 'mastered'
        items.push({ kind: 'chest', key, deckId: deck.id, state: claimed.has(key) ? 'opened' : done ? 'ready' : 'locked' })
      }
    }
    // Путь виден вперёд: места будущих уроков до ближайшего сундука, и сам сундук — как цель.
    const n = items.filter((x) => x.kind === 'node').length
    const ghosts = n > 0 && n % CHEST_EVERY === 0 ? 1 : CHEST_EVERY - (n % CHEST_EVERY)
    for (let g = 0; g < ghosts; g++) items.push({ kind: 'ghost', key: `${deck.id}:+${g}`, deckId: deck.id })
    if (n === 0 || n % CHEST_EVERY !== 0) {
      const key = chestKey(deck.id, Math.floor(n / CHEST_EVERY) + 1)
      items.push({ kind: 'chest', key, deckId: deck.id, state: claimed.has(key) ? 'opened' : 'locked' })
    }
    return { deck, number: si + 1, items }
  })
  return { sections, current }
}

/** Кристаллы в сундуке: rng — число от 0 до 1. */
export function chestGems(rng: () => number = Math.random): number {
  return CHEST_GEMS.min + Math.floor(rng() * (CHEST_GEMS.max - CHEST_GEMS.min + 1))
}
