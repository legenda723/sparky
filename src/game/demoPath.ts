// Пример пути для витрины (просьба владельца 2026-10-27): на «Пути» вместо своих колод — два раздела,
// второй начинается под туманом, — чтобы посмотреть на iPhone, как плашка раздела уходит в дым.
// Только показ: база не меняется, пример держится до закрытия приложения (sessionStorage).
import type { PathItem, PathModel, PathNode, PathSection } from './path'

const KEY = 'sparky.demoFogSection'

export function isDemoPath(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoPath(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    // Хранилище недоступно — пример просто не включится.
  }
}

/** Идентификаторы колод примера начинаются с «demo-»: урок по ним пустой, база не трогается. */
export const DEMO_PREFIX = 'demo-'

function node(deckId: string, index: number, state: PathNode['state']): PathNode {
  return { kind: 'node', key: `${deckId}:${index}`, deckId, index, cardIds: [], introduced: state === 'locked' ? 0 : 5, state }
}

/** Раздел 1: пройден, текущий, два закрытых и место следующего урока; раздел 2 — под туманом. */
export function demoPath(): PathModel {
  const a = `${DEMO_PREFIX}a`
  const b = `${DEMO_PREFIX}b`
  const current = node(a, 1, 'current')
  const first: PathSection = {
    deck: { id: a, title: 'Пример', emoji: '🍎', color: 'green', order: 0, archived: false },
    number: 1,
    // Под текущим два места на чистом месте, третье (место следующего урока) — уже под туманом, за ним раздел 2.
    items: [node(a, 0, 'passed'), current, node(a, 2, 'locked'), node(a, 3, 'locked'), { kind: 'ghost', key: `${a}:+`, deckId: a }],
  }
  const items: PathItem[] = Array.from({ length: 5 }, (_, i) => node(b, i, 'locked'))
  const second: PathSection = {
    deck: { id: b, title: 'Следующий раздел', emoji: '🏠', color: 'blue', order: 1, archived: false },
    number: 2,
    items: [...items, { kind: 'ghost', key: `${b}:+`, deckId: b }],
  }
  return { sections: [first, second], current }
}
