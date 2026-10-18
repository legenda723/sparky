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
