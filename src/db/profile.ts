// Имя и фото владельца в «Профиле» (база версии 2). Фото — запись в media, в профиле — её id.
import type { CompressedImage } from '../media/image'
import type { SparkyDb } from './db'
import { DEFAULT_PROFILE, type Profile } from './types'

/** Имя — до 30 букв (DESIGN.md → «Профиль: шапка»). */
export const NAME_MAX = 30

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
}

async function getProfile(db: SparkyDb): Promise<Profile> {
  return { ...DEFAULT_PROFILE, ...(await db.profile.get('me')) }
}

export async function setProfileName(db: SparkyDb, name: string): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    await db.profile.put({ ...(await getProfile(db)), name: cleanName(name) })
  })
}

/** Новое фото; старое удаляется из базы (как у фото слов, SPEC → «Решения» 2026-10-18). */
export async function setAvatar(db: SparkyDb, image: CompressedImage, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.profile, db.media, async () => {
    const p = await getProfile(db)
    if (p.avatarId) await db.media.delete(p.avatarId)
    const id = crypto.randomUUID()
    await db.media.add({ ...image, id, createdAt: now })
    await db.profile.put({ ...p, avatarId: id })
  })
}

export async function removeAvatar(db: SparkyDb): Promise<void> {
  await db.transaction('rw', db.profile, db.media, async () => {
    const { avatarId, ...p } = await getProfile(db)
    if (!avatarId) return
    await db.media.delete(avatarId)
    await db.profile.put(p)
  })
}
