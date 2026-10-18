// Настройки внешнего вида и отклика. Хранятся в базе (таблица settings);
// localStorage — быстрая копия, чтобы при открытии сразу была нужная тема, без мигания.
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { ensureSettings, updateSettings } from '../db/settings'
import type { ThemePref } from '../db/types'

export type { ThemePref }

export interface Prefs {
  theme: ThemePref
  sound: boolean
  haptics: boolean
  simIphone: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  sound: true,
  haptics: true,
  simIphone: false,
}

const KEY_PREFIX = 'sparky.'

/** Разбирает сохранённое значение; всё непонятное → значение по умолчанию. */
export function parsePref<K extends keyof Prefs>(key: K, raw: string | null): Prefs[K] {
  const fallback = DEFAULT_PREFS[key]
  if (raw === null) return fallback
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (key === 'theme') {
    return (value === 'system' || value === 'light' || value === 'dark' ? value : fallback) as Prefs[K]
  }
  return (typeof value === 'boolean' ? value : fallback) as Prefs[K]
}

// Режим «Как на iPhone 16» живёт только до перезапуска: забытый, он испортил бы отступы на настоящем телефоне.
const SESSION_ONLY: (keyof Prefs)[] = ['simIphone']
const STORED = ['theme', 'sound', 'haptics'] as const

function read<K extends keyof Prefs>(key: K): Prefs[K] {
  if (SESSION_ONLY.includes(key)) return DEFAULT_PREFS[key]
  try {
    return parsePref(key, localStorage.getItem(KEY_PREFIX + key))
  } catch {
    return DEFAULT_PREFS[key]
  }
}

let current: Prefs | null = null
const listeners = new Set<() => void>()

export function getPrefs(): Prefs {
  if (!current) {
    current = {
      theme: read('theme'),
      sound: read('sound'),
      haptics: read('haptics'),
      simIphone: read('simIphone'),
    }
  }
  return current
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  current = { ...getPrefs(), [key]: value }
  if (SESSION_ONLY.includes(key)) {
    listeners.forEach((l) => l())
    return
  }
  cache(key, value)
  void updateSettings(db, { [key]: value }).catch(() => {
    // База недоступна — настройка живёт до закрытия.
  })
  listeners.forEach((l) => l())
}

function cache<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value))
  } catch {
    // Хранилище недоступно (приватный режим) — не страшно, главная копия в базе.
  }
}

/** При открытии: берём настройки из базы (в первый раз — переносим туда из localStorage). */
export async function loadPrefs(): Promise<void> {
  const before = getPrefs()
  const saved = await ensureSettings(db, { theme: before.theme, sound: before.sound, haptics: before.haptics })
  current = { ...getPrefs(), theme: saved.theme, sound: saved.sound, haptics: saved.haptics }
  STORED.forEach((key) => cache(key, current![key]))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs)
}
