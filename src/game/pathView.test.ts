import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, type PathCard, type PathDeck } from './path'
import { KEEP_BEFORE, pathView } from './pathView'

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
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'k'.repeat(10)), ...words('b', 'nnnnn')], [])
    const v = pathView(m, none, none)
    expect(v.sections.map((s) => s.collapsed)).toEqual([true, false])
    expect(v.sections[0].entries).toEqual([])
    expect(pathView(m, new Set(['a']), none).sections[0].collapsed).toBe(false)
  })

  it('под текущим — 2 места ясно и 2 под туманом, дальше путь не рисуется', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'n'.repeat(30)), ...words('b', 'nnnnn')], [])
    const v = pathView(m, none, none)
    expect(v.fog).toBe(true)
    expect(v.sections).toHaveLength(1)
    // текущий, закрытый, закрытый, сундук~, закрытый~
    expect(kinds(v, 0)).toEqual(['current', 'locked', 'locked', 'chest~', 'locked~'])
  })

  it('окно продолжается в следующий раздел', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkknnnnn'), ...words('b', 'n'.repeat(15))], [])
    const v = pathView(m, none, none)
    // в «a»: пройден, текущий, «+», сундук-цель; дальше «b» — первые 2 места под туманом
    expect(kinds(v, 0)).toEqual(['passed', 'current', 'ghost', 'chest'])
    expect(kinds(v, 1)).toEqual(['locked~', 'locked~'])
  })

  it('впереди слов нет — путь продолжают два будущих урока подряд', () => {
    const m = buildPath([deck('a', 0)], words('a', 'kkkkknn'), [])
    const v = pathView(m, none, none)
    expect(kinds(v, 0)).toEqual(['passed', 'current', 'ghost', 'chest', 'future~', 'future~'])
    expect(v.sections[0].entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5])
    expect(v.fog).toBe(true)
  })

  it('над текущим — не больше 6 мест, остальные пройденные — «Показать ещё»', () => {
    const m = buildPath([deck('a', 0)], words('a', 'k'.repeat(50) + 'nnnnn'), [])
    const v = pathView(m, none, none)
    const s = v.sections[0]
    const cur = s.entries.findIndex((e) => e.item.kind === 'node' && e.item.state === 'current')
    expect(cur).toBe(KEEP_BEFORE)
    expect(s.hiddenBefore).toBeGreaterThan(0)
    expect(s.hiddenBefore + s.entries.filter((e) => e.item.kind === 'node').length).toBe(11)
    expect(pathView(m, none, new Set(['a'])).sections[0].hiddenBefore).toBe(0)
  })

  it('всё пройдено — последний раздел открыт до «+» и сундука-цели', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkk'), ...words('b', 'kkkkk')], [])
    const v = pathView(m, none, none)
    expect(v.sections.map((s) => s.collapsed)).toEqual([true, false])
    expect(kinds(v, 1)).toEqual(['passed', 'ghost', 'chest', 'future~', 'future~'])
  })

  it('5000 слов — на экране не больше ~11 мест', () => {
    const m = buildPath([deck('a', 0)], words('a', 'k'.repeat(4990) + 'n'.repeat(10)), [])
    const v = pathView(m, none, none)
    expect(v.sections[0].entries.length).toBeLessThanOrEqual(KEEP_BEFORE + 1 + 4 + 2)
  })
})
