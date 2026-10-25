import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { SparkyDb } from './db'
import { cleanName, removeAvatar, setAvatar, setProfileName } from './profile'
import { loadJourney } from './journey'
import { DEFAULT_PROFILE, type DayRecord } from './types'

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

const day = (dayKey: string, p: Partial<DayRecord> = {}): DayRecord => ({
  dayKey, xp: 0, lessons: 0, reviews: 0, newLearned: 0, correct: 0, wrong: 0, msSpent: 0, goalMet: false, freezeUsed: false, ...p,
})

describe('«Твой путь»: дни из итогов дня', () => {
  it('урок или день в стрике — занятие, заморозка — отдельно, пустые дни пропускаются', async () => {
    const db = freshDb()
    await db.days.bulkPut([
      day('2026-10-20', { xp: 45, lessons: 2 }),
      day('2026-10-21', { freezeUsed: true }),
      day('2026-10-22', { xp: 8, streakDay: true }), // тренировка, засчитанная в стрик
      day('2026-10-23', { xp: 5 }), // тренировка без стрика — видна в календаре, но не «день занятий»
      day('2026-10-24'),
    ])
    const j = await loadJourney(db)
    expect(j.firstDay).toBe('2026-10-20')
    expect(j.activeDays).toBe(2)
    expect(j.marks.get('2026-10-21')).toEqual({ xp: 0, lessons: 0, done: false, frozen: true })
    expect(j.marks.get('2026-10-23')).toMatchObject({ done: false, frozen: false, xp: 5 })
    expect(j.marks.has('2026-10-24')).toBe(false)
    expect(j.goalXp).toBe(50)
  })
})

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
