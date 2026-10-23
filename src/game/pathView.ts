// Что из пути видно на экране (SPEC 7.1, решения этапа 7): путь всегда занимает 1–2 экрана,
// сколько бы ни было уроков. Пройденные колоды выше текущей свёрнуты, над текущим узлом — несколько
// последних пройденных, под ним — немного пути, дальше туман. Чистая функция.
import type { PathItem, PathModel, PathSection } from './path'

/** Мест над текущим (остальные пройденные — под кнопкой «Показать ещё»). */
export const KEEP_BEFORE = 6
/** Мест под текущим, видных ясно. */
export const AHEAD_CLEAR = 2
/** Ещё мест под облаками тумана — дальше путь не рисуется. */
export const AHEAD_FOGGED = 2

export interface ViewEntry {
  item: PathItem
  /** Место в разделе (для волны дорожки). */
  index: number
  /** Под облаками тумана. */
  fogged: boolean
}

export interface ViewSection {
  section: PathSection
  /** Колода пройдена целиком и выше текущей — одна плитка, касание разворачивает. */
  collapsed: boolean
  /** Пройденных уроков над видимой частью (кнопка «Показать ещё N»). */
  hiddenBefore: number
  entries: ViewEntry[]
}

export interface PathView {
  sections: ViewSection[]
  /** Внизу туман (есть хоть один раздел). */
  fog: boolean
}

function isDone(section: PathSection): boolean {
  const nodes = section.items.filter((x) => x.kind === 'node')
  return nodes.length > 0 && nodes.every((n) => n.kind === 'node' && (n.state === 'passed' || n.state === 'mastered'))
}

/**
 * expanded — колоды, которые владелец развернул; showAll — где показал все пройденные уроки.
 * Граница пути — раздел с текущим узлом (или последний, если всё пройдено).
 */
export function pathView(model: PathModel, expanded: ReadonlySet<string>, showAll: ReadonlySet<string>): PathView {
  const secs = model.sections
  if (secs.length === 0) return { sections: [], fog: false }
  const cur = model.current
  const frontier = cur ? secs.findIndex((s) => s.deck.id === cur.deckId) : secs.length - 1
  const out: ViewSection[] = []

  for (let i = 0; i < frontier; i++) {
    const section = secs[i]
    const collapsed = isDone(section) && !expanded.has(section.deck.id)
    out.push({
      section,
      collapsed,
      hiddenBefore: 0,
      entries: collapsed ? [] : section.items.map((item, index) => ({ item, index, fogged: false })),
    })
  }

  // Раздел-граница: над якорем — не больше KEEP_BEFORE мест.
  const front = secs[frontier]
  const anchor = cur ? front.items.findIndex((x) => x.kind === 'node' && x.key === cur.key) : front.items.length - 1
  const start = showAll.has(front.deck.id) ? 0 : Math.max(0, anchor - KEEP_BEFORE)
  const hiddenBefore = front.items.slice(0, start).filter((x) => x.kind === 'node').length

  if (!cur) {
    out.push({ section: front, collapsed: false, hiddenBefore, entries: entries(front, start, front.items.length) })
    return { sections: withFuture(out), fog: true }
  }

  // Под текущим — AHEAD_CLEAR + AHEAD_FOGGED мест, можно и из следующих разделов; дальше путь не рисуется.
  let budget = AHEAD_CLEAR + AHEAD_FOGGED
  const tail: ViewSection[] = []
  const frontEnd = Math.min(front.items.length, anchor + 1 + budget)
  budget -= frontEnd - (anchor + 1)
  tail.push({ section: front, collapsed: false, hiddenBefore, entries: entries(front, start, frontEnd) })
  let cutAt = { s: frontier, end: frontEnd }
  for (let i = frontier + 1; i < secs.length && budget > 0; i++) {
    const end = Math.min(secs[i].items.length, budget)
    budget -= end
    tail.push({ section: secs[i], collapsed: false, hiddenBefore: 0, entries: entries(secs[i], 0, end) })
    cutAt = { s: i, end }
  }
  // Последние AHEAD_FOGGED мест — под туманом, если за ними путь ещё есть.
  const more = cutAt.end < secs[cutAt.s].items.length || cutAt.s < secs.length - 1
  if (more) {
    let left = AHEAD_FOGGED
    for (let t = tail.length - 1; t >= 0 && left > 0; t--) {
      const list = tail[t].entries
      for (let e = list.length - 1; e >= 0 && left > 0; e--) {
        if (list[e].item === cur) break
        list[e].fogged = true
        left--
      }
    }
  }
  return { sections: withFuture([...out, ...tail]), fog: true }
}

/**
 * Путь всегда уходит в туман (решение владельца): если под туманом нет ни одного места (слова кончились),
 * в конец добавляются два будущих урока подряд — последний уходит в туман, длина пути почти не меняется.
 */
/** Будущих уроков в конце пути, когда настоящие места кончились. */
export const FUTURES = 2

function withFuture(sections: ViewSection[]): ViewSection[] {
  const last = sections.at(-1)
  if (!last || last.collapsed) return sections
  if (sections.some((s) => s.entries.some((e) => e.fogged))) return sections
  const deckId = last.section.deck.id
  const next = (last.entries.at(-1)?.index ?? -1) + 1
  // Два будущих урока подряд: туман стоит там же, где без них, — первый на чистом месте, второй в дыму.
  const futures: ViewEntry[] = Array.from({ length: FUTURES }, (_, k) => ({
    item: { kind: 'future', key: `${deckId}:~${k}`, deckId },
    index: next + k,
    fogged: true,
  }))
  return [...sections.slice(0, -1), { ...last, entries: [...last.entries, ...futures] }]
}

function entries(section: PathSection, from: number, to: number): ViewEntry[] {
  return section.items.slice(from, to).map((item, k) => ({ item, index: from + k, fogged: false }))
}
