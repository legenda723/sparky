// Веб-приложение на экране Домой или обычная вкладка Safari (SPEC 7.6, 8.3).
import { useEffect, useState } from 'react'

/** Открыто как веб-приложение с экрана Домой (на весь экран, без панелей Safari). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

const CONTINUE_KEY = 'sparky.browserContinue'

/**
 * Показать экран «Добавь Спарки на экран Домой»? Только в опубликованной версии,
 * только в обычной вкладке и пока владелец не нажал «Всё равно продолжить» в этой вкладке.
 */
export function shouldShowInstall(isProd: boolean, standalone: boolean, continued: boolean): boolean {
  return isProd && !standalone && !continued
}

export function readContinued(): boolean {
  try {
    return sessionStorage.getItem(CONTINUE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveContinued(): void {
  try {
    sessionStorage.setItem(CONTINUE_KEY, '1')
  } catch {
    // нет хранилища — экран просто покажется снова при следующем открытии
  }
}

export type StorageStatus = 'protected' | 'unprotected' | 'unknown'

/** Просит iPhone не стирать данные при нехватке места. Повторный запрос безвреден. */
export async function requestPersistentStorage(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persist) return 'unknown'
    if (await navigator.storage.persisted()) return 'protected'
    return (await navigator.storage.persist()) ? 'protected' : 'unprotected'
  } catch {
    return 'unknown'
  }
}

export async function readStorageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persisted) return 'unknown'
    return (await navigator.storage.persisted()) ? 'protected' : 'unprotected'
  } catch {
    return 'unknown'
  }
}

export function useStorageStatus(): [StorageStatus, () => void] {
  const [status, setStatus] = useState<StorageStatus>('unknown')
  useEffect(() => {
    let alive = true
    void readStorageStatus().then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [])
  const request = () => void requestPersistentStorage().then(setStatus)
  return [status, request]
}
