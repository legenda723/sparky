import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { SparkyDb } from './db'
import { cleanName, removeAvatar, setAvatar, setProfileName } from './profile'
import { DEFAULT_PROFILE } from './types'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`profile-test-${++n}`)
  opened.push(d)
  return d
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const photo = (s: string) => ({ kind: 'image' as const, blob: new Blob([s], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 10, height: 10 })

describe('имя и фото профиля', () => {
  it('имя: лишние пробелы убираются, не длиннее 30 букв, игра не трогается', async () => {
    const db = freshDb()
    await db.profile.put({ ...DEFAULT_PROFILE, totalXp: 120 })
    await setProfileName(db, '  Сама   Иванова ')
    expect(await db.profile.get('me')).toMatchObject({ name: 'Сама Иванова', totalXp: 120 })
    expect(cleanName('а'.repeat(40))).toHaveLength(30)
    await setProfileName(db, '   ')
    expect((await db.profile.get('me'))?.name).toBe('')
  })

  it('новое фото заменяет старое — старое удаляется из базы; «Убрать» удаляет фото', async () => {
    const db = freshDb()
    await setAvatar(db, photo('a'), 1)
    const first = (await db.profile.get('me'))!.avatarId!
    expect((await db.media.get(first))?.kind).toBe('image')
    await setAvatar(db, photo('b'), 2)
    const second = (await db.profile.get('me'))!.avatarId!
    expect(second).not.toBe(first)
    expect(await db.media.get(first)).toBeUndefined()
    expect(await db.media.count()).toBe(1)
    await removeAvatar(db)
    expect((await db.profile.get('me'))?.avatarId).toBeUndefined()
    expect(await db.media.count()).toBe(0)
  })
})
