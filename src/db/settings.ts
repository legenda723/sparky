import type { SparkyDb } from './db'
import { DEFAULT_SETTINGS, type Settings } from './types'

/**
 * Читает настройки из базы. При первом запуске с базой создаёт запись,
 * перенося то, что владелец уже выбрал до этапа 3 (тема, звук, вибрация из localStorage).
 */
export async function ensureSettings(db: SparkyDb, carried: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('me')
    if (existing) return { ...DEFAULT_SETTINGS, ...existing }
    const created: Settings = { ...DEFAULT_SETTINGS, ...carried, id: 'me' }
    await db.settings.put(created)
    return created
  })
}

export async function updateSettings(db: SparkyDb, patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('me')) ?? DEFAULT_SETTINGS
    await db.settings.put({ ...DEFAULT_SETTINGS, ...current, ...patch, id: 'me' })
  })
}
