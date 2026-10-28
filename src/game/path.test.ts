import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, nodeCardIds, reviewKey, type PathCard, type PathDeck, type PathItem, type PathNode } from './path'

const deck = (id: string, order: number, extra: Partial<PathDeck> = {}): PathDeck => ({ id, order, archived: false, ...extra })

type Kind = 'new' | 'learning' | 'known' | 'mastered'

/**
 * Слова колоды по строке состояний: «n» новое, «l» учится, «k» знаю, «m» освоено.
 * added — когда добавлены (по умолчанию все вместе, как «Вставить списком»).
 */
function words(deckId: string, pattern: string, added = 0, extra: (i: number) => Partial<PathCard> = () => ({})): PathCard[] {
  const kinds: Record<string, Kind> = { n: 'new', l: 'learning', k: 'known', m: 'mastered' }
  return [...pattern].map((ch, i) => {
    const kind = kinds[ch]
    return {
      id: `${deckId}-${i}`,
      deckId,
      order: i,
      createdAt: added,
      state: kind === 'new' ? State.New : kind === 'learning' ? State.Learning : State.Review,
      stability: kind === 'mastered' ? 30 : kind === 'known' ? 5 : 0,
      suspended: false,
      ...extra(i),
    }
  })
}

const nodes = (items: PathItem[]) => items.filter((x): x is PathNode => x.kind === 'node')

describe('путь: одна змейка из всех колод', () => {
  it('узел — 5 слов по порядку, последний может быть неполным', () => {
    const p = buildPath([deck('a', 0)], words('a', 'nnnnnnnnnnnn'))
    const ns = nodes(p.items)
    expect(ns.map((n) => n.cardIds.length)).toEqual([5, 5, 2])
    expect(ns[0].cardIds).toEqual(['a-0', 'a-1', 'a-2', 'a-3', 'a-4'])
  })

  it('слова из всех колод — по порядку добавления, а не по порядку колод', () => {
    // Колода «b» стоит выше в «Словах», но её слова добавлены позже.
    const cards = [...words('a', 'nnn', 100), ...words('b', 'nnn', 200), ...words('a', 'nnnn', 300).map((c, i) => ({ ...c, id: `a-late-${i}`, order: 3 + i }))]
    const p = buildPath([deck('b', 0), deck('a', 1)], cards)
    expect(nodes(p.items).map((n) => n.cardIds)).toEqual([
      ['a-0', 'a-1', 'a-2', 'b-0', 'b-1'],
      ['b-2', 'a-late-0', 'a-late-1', 'a-late-2', 'a-late-3'],
    ])
    // Урок узла берёт ровно его слова.
    expect(nodeCardIds(cards, 1)).toEqual(nodes(p.items)[1].cardIds)
  })

  it('пройден, освоен, текущий и закрытые', () => {
    const p = buildPath([deck('a', 0)], words('a', 'mmmmm' + 'kkmml' + 'kknnn' + 'nnnnn'))
    expect(nodes(p.items).map((n) => n.state)).toEqual(['mastered', 'passed', 'current', 'locked'])
    expect(p.current?.key).toBe('n:2')
    expect(p.current?.introduced).toBe(2)
  })

  it('освоен — только когда у всех слов стабильность от 21 дня', () => {
    const p = buildPath([deck('a', 0)], words('a', 'mmmmk'))
    expect(nodes(p.items)[0].state).toBe('passed')
  })

  it('пройденный узел после текущего остаётся пройденным', () => {
    const p = buildPath([deck('a', 0)], words('a', 'kkkkkkn' + 'kkk' + 'kkkkk'))
    expect(nodes(p.items).map((n) => n.state)).toEqual(['passed', 'current', 'passed'])
  })

  it('дополненный неполный узел снова становится текущим', () => {
    const before = buildPath([deck('a', 0)], words('a', 'kkkkkkk'))
    expect(before.current).toBeUndefined()
    const after = buildPath([deck('a', 0)], words('a', 'kkkkkkknn'))
    expect(after.current?.key).toBe('n:1')
    expect(after.current?.cardIds.length).toBe(4)
  })

  it('замороженные и удалённые слова в узлы не входят', () => {
    const cards = words('a', 'kknnkkk', 0, (i) => (i === 2 ? { suspended: true } : i === 3 ? { deletedAt: 1 } : {}))
    const ns = nodes(buildPath([deck('a', 0)], cards).items)
    expect(ns).toHaveLength(1)
    expect(ns[0].cardIds).toEqual(['a-0', 'a-1', 'a-4', 'a-5', 'a-6'])
    expect(ns[0].state).toBe('passed')
  })

  it('слова удалённых и архивных колод не входят; слов нет — путь пуст', () => {
    const p = buildPath([deck('a', 0, { deletedAt: 1 }), deck('b', 1, { archived: true }), deck('c', 2)], [...words('a', 'nn'), ...words('b', 'nn')])
    expect(p.items).toEqual([])
    expect(p.current).toBeUndefined()
  })

  it('слово, которое учится, считается прошедшим знакомство', () => {
    expect(nodes(buildPath([deck('a', 0)], words('a', 'lllll')).items)[0].state).toBe('passed')
  })
})

describe('путь: места', () => {
  it('места — уроки по порядку и в конце одно место следующего урока', () => {
    const p = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'n'.repeat(20)), ...words('b', 'n'.repeat(15), 1)])
    expect(p.items.map((x) => x.kind)).toEqual(['node', 'node', 'node', 'node', 'node', 'node', 'node', 'ghost'])
    expect(p.items.at(-1)).toEqual({ kind: 'ghost', key: '+' })
  })
})

describe('путь: урок повторения', () => {
  it('есть повторения — их берёт текущий урок', () => {
    const m = buildPath([deck('a', 0)], words('a', 'kkkkknnnnn'))
    expect(reviewKey(m, 3)).toBe('n:1')
  })

  it('новые слова кончились — урок повторения на месте следующего урока в конце пути', () => {
    const m = buildPath([deck('a', 0)], words('a', 'kkkkk'))
    expect(m.current).toBeUndefined()
    expect(reviewKey(m, 3)).toBe('+')
  })

  it('повторений нет — урока повторения нет; слов нет — тоже', () => {
    expect(reviewKey(buildPath([deck('a', 0)], words('a', 'kkkkknnnnn')), 0)).toBeUndefined()
    expect(reviewKey(buildPath([deck('a', 0)], []), 5)).toBeUndefined()
  })
})