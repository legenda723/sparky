import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../ui/Toast'
import {
  decideUpdate,
  isUpdateBlocked,
  REOPEN_AFTER_HIDDEN_MS,
  setPendingUpdate,
  subscribeUpdateBlocked,
} from './updates'

const CHECK_EVERY_MS = 60 * 60_000

/**
 * Новая версия скачивается в фоне (service worker). Включается при открытии
 * или по кнопке «Обновить» в тосте; посреди урока — никогда.
 */
export function Updater() {
  const toast = useToast()
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  // Момент открытия; возврат после долгого сворачивания — тоже «открытие».
  const [openedAt, setOpenedAt] = useState(() => performance.now())
  const busy = useSyncExternalStore(subscribeUpdateBlocked, isUpdateBlocked)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registration.current = r
      if (r) setInterval(() => void r.update().catch(() => {}), CHECK_EVERY_MS)
    },
  })

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = performance.now()
        return
      }
      if (hiddenAt && performance.now() - hiddenAt >= REOPEN_AFTER_HIDDEN_MS) setOpenedAt(performance.now())
      void registration.current?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    setPendingUpdate(needRefresh ? () => void updateServiceWorker(true) : null)
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    if (!needRefresh) return
    const decision = decideUpdate(performance.now() - openedAt, busy)
    if (decision === 'apply') void updateServiceWorker(true)
    else if (decision === 'prompt') {
      toast({
        message: 'Есть новая версия Спарки',
        action: { label: 'Обновить', onClick: () => void updateServiceWorker(true) },
        durationMs: 8000,
      })
    }
  }, [needRefresh, openedAt, busy, toast, updateServiceWorker])

  return null
}
