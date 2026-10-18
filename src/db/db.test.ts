import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { SparkyDb } from './db'
import { ensureSettings, updateSettings } from './settings'
import { DEFAULT_SETTINGS } from './types'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`test-${++n}`)
  opened.push(d)
  return d
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

describe('схема версии 1', () => {
  it('открывается со всеми таблицами SPEC', async () => {
    const d = freshDb()
    await d.open()
    expect(d.verno).toBe(1)
    expect(d.tables.map((t) => t.name).sort()).toEqual(
      ['cards', 'days', 'decks', 'media', 'profile', 'quests', 'reviewLogs', 'settings'].sort(),
    )
  })

  it('данные переживают закрытие и повторное открытие', async () => {
    const d = freshDb()
    await d.decks.add({ id: 'd1', title: 'Еда', emoji: '🍎', color: 'green', order: 0, createdAt: 1, archived: false })
    await d.media.add({ id: 'm1', kind: 'image', blob: new Blob(['x'], { type: 'image/jpeg' }), mime: 'image/jpeg', createdAt: 1 })
    d.close()
    const again = new SparkyDb(d.name)
    opened.push(again)
    expect((await again.decks.get('d1'))?.title).toBe('Еда')
    expect((await again.media.get('m1'))?.mime).toBe('image/jpeg')
  })
})

describe('настройки', () => {
  it('первый запуск переносит выбор владельца из localStorage', async () => {
    const d = freshDb()
    const s = await ensureSettings(d, { theme: 'dark', sound: false })
    expect(s.theme).toBe('dark')
    expect(s.sound).toBe(false)
    expect(s.newPerDay).toBe(DEFAULT_SETTINGS.newPerDay)
    expect((await d.settings.get('me'))?.theme).toBe('dark')
  })

  it('дальше база главнее старых значений', async () => {
    const d = freshDb()
    await ensureSettings(d, { theme: 'dark' })
    await updateSettings(d, { theme: 'light' })
    const s = await ensureSettings(d, { theme: 'dark' })
    expect(s.theme).toBe('light')
  })
})
