import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, type PathCard, type PathDeck, type PathItem, type PathNode } from './path'

const deck = (id: string, order: number, extra: Partial<PathDeck> = {}): PathDeck => ({
  id,
  title: id,
  emoji: '📚',
  color: 'green',
  order,
  archived: false,
  ...extra,
})

type Kind = 'new' | 'learning' | 'known' | 'mastered'

/** Слова колоды по строке состояний: «n» новое, «l» учится, «k» знаю, «m» освоено. */
function words(deckId: string, pattern: string, extra: (i: number) => Partial<PathCard> = () => ({})): PathCard[] {
  const kinds: Record<string, Kind> = { n: 'new', l: 'learning', k: 'known', m: 'mastered' }
  return [...pattern].map((ch, i) => {
    const kind = kinds[ch]
    return {
      id: `${deckId}-${i}`,
      deckId,
      order: i,
      state: kind === 'new' ? State.New : kind === 'learning' ? State.Learning : State.Review,
      stability: kind === 'mastered' ? 30 : kind === 'known' ? 5 : 0,
      suspended: false,
      ...extra(i),
    }
  })
}

const nodes = (items: PathItem[]) => items.filter((x): x is PathNode => x.kind === 'node')

describe('путь: узлы и их состояния', () => {
  it('узел — 5 слов по порядку, последний может быть неполным', () => {
    const p = buildPath([deck('a', 0)], words('a', 'nnnnnnnnnnnn'))
    const ns = nodes(p.sections[0].items)
    expect(ns.map((n) => n.cardIds.length)).toEqual([5, 5, 2])
    expect(ns[0].cardIds).toEqual(['a-0', 'a-1', 'a-2', 'a-3', 'a-4'])
  })

  it('пройден, освоен, текущий и закрытые', () => {
    const p = buildPath([deck('a', 0)], words('a', 'mmmmm' + 'kkmml' + 'kknnn' + 'nnnnn'))
    expect(nodes(p.sections[0].items).map((n) => n.state)).toEqual(['mastered', 'passed', 'current', 'locked'])
    expect(p.current?.key).toBe('a:2')
    expect(p.current?.introduced).toBe(2)
  })

  it('освоен — только когда у всех слов стабильность от 21 дня', () => {
    const p = buildPath([deck('a', 0)], words('a', 'mmmmk'))
    expect(nodes(p.sections[0].items)[0].state).toBe('passed')
  })

  it('текущий — первый непройденный во всём пути, разделы по порядку колод', () => {
    const p = buildPath([deck('b', 1), deck('a', 0)], [...words('a', 'kkkkk'), ...words('b', 'nnnnn')])
    expect(p.sections.map((s) => [s.deck.id, s.number])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(p.current?.key).toBe('b:0')
  })

  it('пройденный узел после текущего остаётся пройденным (слова добавили в раннюю колоду)', () => {
    const p = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkkkn'), ...words('b', 'kkkkk')])
    expect(nodes(p.sections[0].items).map((n) => n.state)).toEqual(['passed', 'current'])
    expect(nodes(p.sections[1].items)[0].state).toBe('passed')
  })

  it('дополненный неполный узел снова становится текущим', () => {
    const before = buildPath([deck('a', 0)], words('a', 'kkkkkkk'))
    expect(before.current).toBeUndefined()
    const after = buildPath([deck('a', 0)], words('a', 'kkkkkkknn'))
    expect(after.current?.key).toBe('a:1')
    expect(after.current?.cardIds.length).toBe(4)
  })

  it('замороженные и удалённые слова в узлы не входят', () => {
    const cards = words('a', 'kknnkkk', (i) => (i === 2 ? { suspended: true } : i === 3 ? { deletedAt: 1 } : {}))
    const p = buildPath([deck('a', 0)], cards)
    const ns = nodes(p.sections[0].items)
    expect(ns).toHaveLength(1)
    expect(ns[0].cardIds).toEqual(['a-0', 'a-1', 'a-4', 'a-5', 'a-6'])
    expect(ns[0].state).toBe('passed')
  })

  it('удалённые и архивные колоды не показываются, пустая колода — раздел без узлов', () => {
    const p = buildPath(
      [deck('a', 0, { deletedAt: 1 }), deck('b', 1, { archived: true }), deck('c', 2)],
      [...words('a', 'nn'), ...words('b', 'nn')],
    )
    expect(p.sections.map((s) => s.deck.id)).toEqual(['c'])
    expect(p.sections[0].items.map((x) => x.kind)).toEqual(['ghost'])
    expect(p.current).toBeUndefined()
  })

  it('слово, которое учится, считается прошедшим знакомство', () => {
    const p = buildPath([deck('a', 0)], words('a', 'lllll'))
    expect(nodes(p.sections[0].items)[0].state).toBe('passed')
  })
})

describe('путь: места', () => {
  it('места — только уроки по порядку и в конце одно место следующего урока', () => {
    const p = buildPath([deck('a', 0)], words('a', 'n'.repeat(35)))
    expect(p.sections[0].items.map((x) => x.kind)).toEqual(['node', 'node', 'node', 'node', 'node', 'node', 'node', 'ghost'])
  })

  it('путь виден вперёд при любом числе уроков: за последним уроком — место следующего', () => {
    for (const [pattern, count] of [['kkkkk', 1], ['kkkkkkk', 2], ['k'.repeat(15), 3]] as const) {
      const kinds = buildPath([deck('a', 0)], words('a', pattern)).sections[0].items.map((x) => x.kind)
      expect(kinds).toEqual([...Array(count).fill('node'), 'ghost'])
    }
  })

  it('место следующего урока — в каждом разделе, со своим ключом', () => {
    const p = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkk'), ...words('b', 'nnnnn')])
    expect(p.sections.map((s) => s.items.at(-1))).toEqual([
      { kind: 'ghost', key: 'a:+', deckId: 'a' },
      { kind: 'ghost', key: 'b:+', deckId: 'b' },
    ])
  })
})
