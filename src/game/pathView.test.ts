import { State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, type PathCard, type PathDeck } from './path'
import { deepInFog, KEEP_BEFORE, pathView } from './pathView'

const deck = (id: string, order: number): PathDeck => ({ id, order, archived: false })

/** «k» — знакомое слово, «n» — новое. added — когда добавлены. */
function words(deckId: string, pattern: string, added = 0): PathCard[] {
  return [...pattern].map((ch, i) => ({
    id: `${deckId}-${i}`,
    deckId,
    order: i,
    createdAt: added,
    state: ch === 'n' ? State.New : State.Review,
    stability: 5,
    suspended: false,
  }))
}

const kinds = (v: ReturnType<typeof pathView>) => v.entries.map((e) => `${e.item.kind === 'node' ? e.item.state : e.item.kind}${e.fogged ? '~' : ''}`)

describe('что видно на пути', () => {
  it('под текущим — 2 места ясно и 2 под туманом, дальше путь не рисуется', () => {
    const v = pathView(buildPath([deck('a', 0)], words('a', 'n'.repeat(30))), false)
    expect(v.fog).toBe(true)
    // текущий, 2 закрытых ясно, 2 закрытых под туманом
    expect(kinds(v)).toEqual(['current', 'locked', 'locked', 'locked~', 'locked~'])
  })

  it('разделов нет: окно идёт по общей змейке через слова разных колод', () => {
    const m = buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkknnnnn', 1), ...words('b', 'n'.repeat(25), 2)])
    expect(kinds(pathView(m, false))).toEqual(['passed', 'current', 'locked', 'locked', 'locked~', 'locked~'])
  })

  it('впереди слов нет — путь продолжают четыре будущих урока подряд', () => {
    const v = pathView(buildPath([deck('a', 0)], words('a', 'kkkkknn')), false)
    expect(kinds(v)).toEqual(['passed', 'current', 'ghost', 'future~', 'future~', 'future~', 'future~'])
    // Будущие уроки — на той же волне, подряд за последним местом.
    expect(v.entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('над текущим — не больше 6 мест, остальные пройденные — «Показать ещё»', () => {
    const m = buildPath([deck('a', 0)], words('a', 'k'.repeat(50) + 'nnnnn'))
    const v = pathView(m, false)
    const cur = v.entries.findIndex((e) => e.item.kind === 'node' && e.item.state === 'current')
    expect(cur).toBe(KEEP_BEFORE)
    expect(v.hiddenBefore).toBeGreaterThan(0)
    expect(v.hiddenBefore + v.entries.filter((e) => e.item.kind === 'node').length).toBe(11)
    expect(pathView(m, true).hiddenBefore).toBe(0)
  })

  it('всё пройдено — путь до места следующего урока и будущие уроки', () => {
    const v = pathView(buildPath([deck('a', 0), deck('b', 1)], [...words('a', 'kkkkk'), ...words('b', 'kkkkk', 1)]), false)
    expect(kinds(v)).toEqual(['passed', 'passed', 'ghost', 'future~', 'future~', 'future~', 'future~'])
  })

  it('слов нет — пусто, без тумана', () => {
    expect(pathView(buildPath([deck('a', 0)], []), false)).toEqual({ hiddenBefore: 0, entries: [], fog: false })
  })

  it('5000 слов — на экране не больше ~11 мест', () => {
    const v = pathView(buildPath([deck('a', 0)], words('a', 'k'.repeat(4990) + 'n'.repeat(10))), false)
    expect(v.entries.length).toBeLessThanOrEqual(KEEP_BEFORE + 1 + 4 + 3)
  })
})

describe('касания под туманом', () => {
  it('первое место под туманом (лёгкая дымка) нажимается, глубже — нет', () => {
    const v = pathView(buildPath([deck('a', 0)], words('a', 'n'.repeat(30))), false)
    expect([...deepInFog(v)]).toEqual(['n:4'])
  })

  it('путь кончается будущими уроками: два на чистом месте, третий в дымке — нажимаются, четвёртый — нет', () => {
    const v = pathView(buildPath([deck('a', 0)], words('a', 'kkkkknn')), false)
    expect([...deepInFog(v)]).toEqual(['~3'])
  })
})
