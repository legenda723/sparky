// Hash-маршруты (#/path, #/words …), чтобы на GitHub Pages не было 404.
import { useSyncExternalStore } from 'react'

export const TABS = ['path', 'words', 'stats', 'profile'] as const
export type TabRoute = (typeof TABS)[number]
export type Route = TabRoute | 'dev' | 'lesson'

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  if (name === 'dev' || name === 'lesson') return name
  return (TABS as readonly string[]).includes(name) ? (name as TabRoute) : 'path'
}

export function routeHref(route: Route): string {
  return `#/${route}`
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

/** Хвост адреса после вкладки: «#/words/abc» → «abc». */
export function parseSubPath(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0].split('/').slice(1).filter(Boolean).join('/')
}

export function useSubPath(): string {
  return useSyncExternalStore(
    subscribe,
    () => parseSubPath(window.location.hash),
    () => '',
  )
}

/** Переход внутри вкладки, например navigateSub('words', deckId). */
export function navigateSub(route: TabRoute, sub = ''): void {
  window.location.replace(routeHref(route) + (sub ? `/${sub}` : ''))
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => parseRoute(window.location.hash),
    () => 'path',
  )
}

/** Переход без новой записи в истории: свайп «назад» в Safari не листает вкладки. */
export function navigate(route: Route): void {
  window.location.replace(routeHref(route))
}

/** Какой урок открыть: повторения (кнопка «ПОВТОРИТЬ»), узел пути или тренировка (SPEC 6.5). */
export type LessonTarget = { kind: 'review' } | { kind: 'training' } | { kind: 'node'; index: number }

/** «#/lesson/review», «#/lesson/node/<номер узла на пути>». */
export function lessonHref(target: LessonTarget): string {
  return target.kind === 'node' ? `#/lesson/node/${target.index}` : `#/lesson/${target.kind}`
}

export function parseLessonTarget(hash: string): LessonTarget {
  const [kind, index] = parseSubPath(hash).split('/')
  if (kind === 'training') return { kind: 'training' }
  const n = Number(index)
  if (kind === 'node' && Number.isInteger(n) && n >= 0) return { kind: 'node', index: n }
  return { kind: 'review' }
}

/** Весь адрес после «#» — ключ экрана урока: новый адрес = новый урок. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  )
}

export function openLesson(target: LessonTarget): void {
  const href = lessonHref(target)
  // Тот же урок ещё раз («+5 новых» после урока этого же узла) — адрес с меткой, иначе экран не обновится.
  const same = window.location.hash.split('?')[0] === href
  window.location.replace(same ? `${href}?run=${Date.now()}` : href)
}
