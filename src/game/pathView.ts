// Что из пути видно на экране (SPEC 7.1, решения этапа 7): путь всегда занимает 1–2 экрана,
// сколько бы ни было уроков. Над текущим узлом — несколько последних пройденных (остальные — «Показать ещё»),
// под ним — немного пути, дальше туман. Путь — одна змейка без разделов (решение владельца 2026-10-27). Чистая функция.
import type { PathItem, PathModel } from './path'

/** Мест над текущим (остальные пройденные — под кнопкой «Показать ещё»). */
export const KEEP_BEFORE = 6
/** Мест под текущим, видных ясно. */
export const AHEAD_CLEAR = 2
/** Ещё мест под облаками тумана — дальше путь не рисуется. */
export const AHEAD_FOGGED = 2

export interface ViewEntry {
  item: PathItem
  /** Место на пути (для волны змейки). */
  index: number
  /** Под облаками тумана. */
  fogged: boolean
}

export interface PathView {
  /** Пройденных уроков над видимой частью (кнопка «Показать ещё N»). */
  hiddenBefore: number
  entries: ViewEntry[]
  /** Внизу туман (путь не пуст). */
  fog: boolean
}

/** showAll — владелец показал все пройденные уроки. */
export function pathView(model: PathModel, showAll: boolean): PathView {
  const items = model.items
  if (items.length === 0) return { hiddenBefore: 0, entries: [], fog: false }
  const cur = model.current
  // Над якорем — не больше KEEP_BEFORE мест.
  const anchor = cur ? items.findIndex((x) => x.key === cur.key) : items.length - 1
  const start = showAll ? 0 : Math.max(0, anchor - KEEP_BEFORE)
  const hiddenBefore = items.slice(0, start).filter((x) => x.kind === 'node').length

  if (!cur) return { hiddenBefore, entries: withFuture(entries(items, start, items.length)), fog: true }

  // Под текущим — AHEAD_CLEAR + AHEAD_FOGGED мест; дальше путь не рисуется.
  const end = Math.min(items.length, anchor + 1 + AHEAD_CLEAR + AHEAD_FOGGED)
  const list = entries(items, start, end)
  // Последние AHEAD_FOGGED мест — под туманом, если за ними путь ещё есть.
  if (end < items.length) {
    for (let e = list.length - 1, left = AHEAD_FOGGED; e >= 0 && left > 0; e--, left--) {
      if (list[e].item === cur) break
      list[e].fogged = true
    }
  }
  return { hiddenBefore, entries: withFuture(list), fog: true }
}

/**
 * Путь всегда уходит в туман (решение владельца): если под туманом нет ни одного места (слова кончились),
 * в конец подряд добавляются будущие уроки: первые FUTURES_CLEAR — на чистом месте, остальные уходят в туман.
 */
/** Будущих уроков в конце пути, когда настоящие места кончились. */
export const FUTURES = 4
/**
 * Сколько из них на чистом месте. Два — туман стоит там же, где стоял, пока в конце раздела был сундук-цель
 * (просьба владельца после того, как сундуки убрали: «опусти дым, как был»).
 */
export const FUTURES_CLEAR = 2

function withFuture(list: ViewEntry[]): ViewEntry[] {
  if (list.length === 0 || list.some((e) => e.fogged)) return list
  const next = list.at(-1)!.index + 1
  // Будущие уроки подряд: первые FUTURES_CLEAR на чистом месте, дальше уходят в дым (туман ставит экран).
  const futures: ViewEntry[] = Array.from({ length: FUTURES }, (_, k) => ({
    item: { kind: 'future', key: `~${k}` },
    index: next + k,
    fogged: true,
  }))
  return [...list, ...futures]
}

function entries(items: PathItem[], from: number, to: number): ViewEntry[] {
  return items.slice(from, to).map((item, k) => ({ item, index: from + k, fogged: false }))
}

/**
 * Касания под туманом (просьба владельца 2026-10-27): первое место под туманом ещё хорошо видно (лёгкая дымка) —
 * нажимается; глубже — не нажимается. Будущие уроки на чистом месте (первые FUTURES_CLEAR) — как обычные места.
 * Возвращает ключи мест, которые не нажимаются.
 */
export function deepInFog(view: PathView): ReadonlySet<string> {
  const fogged = view.entries.filter((e) => e.fogged)
  const skip = fogged[0]?.item.kind === 'future' ? FUTURES_CLEAR : 0
  return new Set(fogged.slice(skip + 1).map((e) => e.item.key))
}
