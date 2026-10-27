import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, type PathCard, type PathDeck } from './path'
import { fogPlan, KEEP_BEFORE, pathView, type ViewSection } from './pathView'

const deck = (id: string, order: number): PathDeck => ({ id, title: id, emoji: '📚', color: 'green', order, archived: false })

/** «k» — знакомое слово, «n» — новое. */
function words(deckId: string, pattern: string): PathCard[] {
  return [...pattern].map((ch, i) => ({
    id: `${deckId}-${i}`,
    deckId,
    order: i,
    state: ch === 'n' ? State.New : State.Review,
    stability: 5,
    suspended: false,
  }))
}

const none = new Set<string>()
const kinds = (v: ReturnType<typeof pathView>, s: number) =>
  v.sections[s].entries.map((e) => `${e.item.kind === 'node' ? e.item.state : e.item.kind}${e.fogged ? '~' : ''}`)

describe('что видно на пути', () => {
  it('пройденные колоды выше текущей — свёрнуты; развернуть можно', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'k'.repeat(10)), ...words('b', 'nnnnn')])
    const v = pathView(m, none, none)
    expect(v.sections.map((s) => s.collapsed)).toEqual([true, false])
    expect(v.sections[0].entries).toEqual([])
    expect(pathView(m, new Set(['a']), none).sections[0].collapsed).toBe(false)
  })

  it('под текущим — 2 места ясно и 2 под туманом, дальше путь не рисуется', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'n'.repeat(30)), ...words('b', 'nnnnn')])
    const v = pathView(m, none, none)
    expect(v.fog).toBe(true)
    expect(v.sections).toHaveLength(1)
    // текущий, 2 закрытых ясно, 2 закрытых под туманом
    expect(kinds(v, 0)).toEqual(['current', 'locked', 'locked', 'locked~', 'locked~'])
  })

  it('окно продолжается в следующий раздел', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkknnnnn'), ...words('b', 'n'.repeat(15))])
    const v = pathView(m, none, none)
    // в «a»: пройден, текущий, место следующего урока; дальше «b»: ещё одно место ясно и 2 под туманом
    expect(kinds(v, 0)).toEqual(['passed', 'current', 'ghost'])
    expect(kinds(v, 1)).toEqual(['locked', 'locked~', 'locked~'])
  })

  it('впереди слов нет — путь продолжают четыре будущих урока подряд', () => {
    const m = buildPath([deck('a', 0)], words('a', 'kkkkknn'))
    const v = pathView(m, none, none)
    expect(kinds(v, 0)).toEqual(['passed', 'current', 'ghost', 'future~', 'future~', 'future~', 'future~'])
    // Будущие уроки — на той же волне, подряд за последним местом.
    expect(v.sections[0].entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(v.fog).toBe(true)
  })

  it('над текущим — не больше 6 мест, остальные пройденные — «Показать ещё»', () => {
    const m = buildPath([deck('a', 0)], words('a', 'k'.repeat(50) + 'nnnnn'))
    const v = pathView(m, none, none)
    const s = v.sections[0]
    const cur = s.entries.findIndex((e) => e.item.kind === 'node' && e.item.state === 'current')
    expect(cur).toBe(KEEP_BEFORE)
    expect(s.hiddenBefore).toBeGreaterThan(0)
    expect(s.hiddenBefore + s.entries.filter((e) => e.item.kind === 'node').length).toBe(11)
    expect(pathView(m, none, new Set(['a'])).sections[0].hiddenBefore).toBe(0)
  })

  it('всё пройдено — последний раздел открыт до места следующего урока', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkk'), ...words('b', 'kkkkk')])
    const v = pathView(m, none, none)
    expect(v.sections.map((s) => s.collapsed)).toEqual([true, false])
    expect(kinds(v, 1)).toEqual(['passed', 'ghost', 'future~', 'future~', 'future~', 'future~'])
  })

  it('5000 слов — на экране не больше ~11 мест', () => {
    const m = buildPath([deck('a', 0)], words('a', 'k'.repeat(4990) + 'n'.repeat(10)))
    const v = pathView(m, none, none)
    expect(v.sections[0].entries.length).toBeLessThanOrEqual(KEEP_BEFORE + 1 + 4 + 3)
  })
})

describe('глубина тумана (fogPlan)', () => {
  const sec = (id: string, kinds: [string, boolean][], number = 1): ViewSection => ({
    section: { deck: deck(id, number), number, items: [] },
    collapsed: false,
    hiddenBefore: 0,
    entries: kinds.map(([k, fogged], index) =>
      k === 'f'
        ? { item: { kind: 'future', key: `${id}:~${index}`, deckId: id }, index, fogged }
        : { item: { kind: 'node', key: `${id}:${index}`, deckId: id, index, cardIds: [], introduced: 0, state: 'locked' }, index, fogged },
    ),
  })

  it('путь кончается будущими уроками: два на чистом месте, третий в дымке (нажимается), четвёртый глубоко', () => {
    const p = fogPlan({ fog: true, sections: [sec('a', [['n', false], ['n', false], ['f', true], ['f', true], ['f', true], ['f', true]])] })
    expect(p.light).toBe('a:~4')
    expect([...p.deep]).toEqual(['a:~5'])
    expect(p.banners.size).toBe(0)
  })

  it('следующий раздел начинается глубоко в тумане — плашка на уровне его первого места', () => {
    const p = fogPlan({ fog: true, sections: [sec('a', [['n', false], ['n', false], ['n', true]]), sec('b', [['n', true]], 2)] })
    expect(p.light).toBe('a:2')
    expect([...p.deep]).toEqual(['b:0'])
    expect(p.banners.get('b')).toBe(0)
  })

  it('следующий раздел начинается в лёгкой дымке — плашка всё равно глубже, на уровне второго места', () => {
    const p = fogPlan({ fog: true, sections: [sec('a', [['n', false], ['n', false]]), sec('b', [['n', true], ['n', true]], 2)] })
    expect(p.light).toBe('b:0')
    expect([...p.deep]).toEqual(['b:1'])
    expect(p.banners.get('b')).toBe(1)
  })

  it('раздел над туманом — плашка как обычно', () => {
    const p = fogPlan({ fog: true, sections: [sec('a', [['n', false]]), sec('b', [['n', false], ['n', true], ['n', true]], 2)] })
    expect(p.banners.size).toBe(0)
  })
})
