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
export type LessonTarget = { kind: 'review' } | { kind: 'training' } | { kind: 'node'; deckId: string; index: number }

/** «#/lesson/review», «#/lesson/<колода>/<номер узла>». */
export function lessonHref(target: LessonTarget): string {
  return target.kind === 'node' ? `#/lesson/${target.deckId}/${target.index}` : `#/lesson/${target.kind}`
}

export function parseLessonTarget(hash: string): LessonTarget {
  const [deckId, index] = parseSubPath(hash).split('/')
  if (deckId === 'training') return { kind: 'training' }
  const n = Number(index)
  if (deckId && deckId !== 'review' && Number.isInteger(n) && n >= 0) return { kind: 'node', deckId, index: n }
  return { kind: 'review' }
}

export function openLesson(target: LessonTarget): void {
  window.location.replace(lessonHref(target))
}
