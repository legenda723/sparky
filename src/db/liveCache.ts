// Последние результаты запросов к базе — в памяти. Экран открывается сразу с ними,
// а свежие данные из базы приходят следом (на iPhone база отвечает с задержкой).
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

const cache = new Map<string, unknown>()

export function setCached(key: string, value: unknown): void {
  cache.set(key, value)
}

/** Как useLiveQuery, но до первого ответа базы отдаёт прошлый результат по ключу. */
export function useCachedLiveQuery<T>(key: string, querier: () => Promise<T>, deps: unknown[]): T | undefined {
  const cached = cache.get(key) as T | undefined
  const value = useLiveQuery(querier, deps, cached)
  useEffect(() => {
    if (value !== undefined) cache.set(key, value)
  }, [key, value])
  return value
}
