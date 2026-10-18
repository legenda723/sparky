import 'fake-indexeddb/auto'
import { Rating } from 'ts-fsrs'
import { afterEach, describe, expect, it } from 'vitest'
import { addCard, addCards, deleteCard } from '../db/cards'
import { SparkyDb } from '../db/db'
import { createDeck, deleteDeck } from '../db/decks'
import { finishLesson, markIntroduced, saveAnswer } from '../db/review'
import { updateSettings } from '../db/settings'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../db/types'
import { outcomes } from '../srs/scheduler'
import { BackupError, backupFileName, base64ToBytes, bytesToBase64, exportBackup, markBackedUp, parseBackup, replaceAll } from './backup'
import { BACKUP_FORMAT } from './schema'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`backup-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const T0 = new Date('2026-10-10T09:00:00')

/** Заполняет базу всем, что бывает: колоды, слова с фото и записью, оценки, итоги дня, настройки, профиль. */
async function seed(d: SparkyDb) {
  const food = await createDeck(d, { title: 'Еда', emoji: '🍎', color: 'green' }, T0.getTime())
  const home = await createDeck(d, { title: 'Дом', emoji: '🏠', color: 'blue' }, T0.getTime())
  const apple = await addCard(
    d,
    food.id,
    { front: 'apple', back: 'яблоко', transcription: 'ˈæp.əl', example: 'An apple a day', exampleTranslation: 'Яблоко в день', note: 'фрукт' },
    {
      image: { kind: 'image', blob: new Blob([new Uint8Array([0xff, 0xd8, 0, 1, 2, 250])], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 800, height: 600 },
      audio: { kind: 'audio', blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mp4' }), mime: 'audio/mp4', durationMs: 1200 },
    },
    T0.getTime(),
  )
  await addCards(d, food.id, [{ front: 'bread', back: 'хлеб' }, { front: 'milk', back: 'молоко' }], T0.getTime())
  const [chair] = await addCards(d, home.id, [{ front: 'chair', back: 'стул' }], T0.getTime())
  await deleteCard(d, chair.id, T0.getTime() + 1)
  await markIntroduced(d, apple.id, T0, 4000)
  const fresh = (await d.cards.get(apple.id))!
  const at = new Date(T0.getTime() + 60_000)
  await saveAnswer(d, { before: fresh, grade: Rating.Good, outcome: outcomes(fresh, at, 0.9)[Rating.Good], exerciseType: 'flip', durationMs: 3500 })
  await finishLesson(d, at)
  await updateSettings(d, { theme: 'dark', newPerDay: 7, voiceURI: 'com.apple.voice.Samantha' })
  await d.profile.put({ ...DEFAULT_PROFILE, totalXp: 42, gems: 15, streak: 3, achievements: ['first-word'] })
  await d.quests.put({ dayKey: '2026-10-10', quests: [{ kind: 'xp', target: 50, progress: 12, done: false }], chestClaimed: false })
  return { food, home, apple }
}

/** Всё содержимое базы; Blob → байты, чтобы сравнивать. */
async function snapshot(d: SparkyDb) {
  const media = await Promise.all(
    (await d.media.toArray()).map(async ({ blob, ...m }) => ({ ...m, type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] })),
  )
  return {
    decks: await d.decks.toArray(),
    cards: await d.cards.toArray(),
    media,
    reviewLogs: await d.reviewLogs.toArray(),
    days: await d.days.toArray(),
    profile: await d.profile.toArray(),
    quests: await d.quests.toArray(),
    settings: await d.settings.toArray(),
  }
}

describe('бэкап: экспорт → импорт', () => {
  it('восстанавливает те же данные (включая фото, записи, даты и удалённое)', async () => {
    const d = freshDb()
    const { food } = await seed(d)
    const before = await snapshot(d)
    const exportedAt = new Date('2026-10-12T20:00:00')
    const prepared = await exportBackup(d, exportedAt)

    await deleteDeck(d, food.id, Date.now())
    await d.cards.clear()

    const parsed = parseBackup(prepared.text)
    await replaceAll(d, parsed.file)
    const after = await snapshot(d)

    // Единственное отличие — отметка «последняя копия» = время файла.
    expect(after.profile[0].lastBackupAt).toBe(exportedAt.getTime())
    after.profile[0].lastBackupAt = before.profile[0].lastBackupAt
    expect(after).toEqual(before)
    expect(after.cards[0].due).toBeInstanceOf(Date)
  })

  it('в другую (пустую) базу — тоже всё', async () => {
    const a = freshDb()
    await seed(a)
    const text = (await exportBackup(a)).text
    const b = freshDb()
    await replaceAll(b, parseBackup(text).file)
    const [sa, sb] = [await snapshot(a), await snapshot(b)]
    sb.profile[0].lastBackupAt = sa.profile[0].lastBackupAt
    for (const k of Object.keys(sa) as (keyof typeof sa)[]) expect(sb[k], k).toEqual(sa[k])
    expect(sb).toEqual(sa)
  })

  it('сводка, имя и размер файла', async () => {
    const d = freshDb()
    await seed(d)
    const p = await exportBackup(d, new Date('2026-03-05T10:00:00'))
    expect(p.fileName).toBe('sparky-backup-2026-03-05.json')
    expect(p.summary).toEqual({ decks: 2, cards: 3, images: 1, audios: 1, reviews: 1 })
    expect(parseBackup(p.text).summary).toEqual(p.summary)
    expect(p.size).toBe(new TextEncoder().encode(p.text).length)
  })

  it('пустая база тоже сохраняется и восстанавливается', async () => {
    const d = freshDb()
    const p = await exportBackup(d)
    const b = freshDb()
    await replaceAll(b, parseBackup(p.text).file)
    expect(await b.cards.count()).toBe(0)
    expect((await b.profile.get('me'))?.lastBackupAt).toBeDefined()
  })

  it('отметка «последняя копия»', async () => {
    const d = freshDb()
    await markBackedUp(d, 1234)
    expect(await d.profile.get('me')).toEqual({ ...DEFAULT_PROFILE, lastBackupAt: 1234 })
    await d.profile.update('me', { gems: 5 })
    await markBackedUp(d, 5678)
    expect(await d.profile.get('me')).toMatchObject({ gems: 5, lastBackupAt: 5678 })
  })
})

describe('бэкап: проверка файла', () => {
  const bad = (text: string) => () => parseBackup(text)

  it('не JSON и чужой JSON — отказ', () => {
    expect(bad('привет')).toThrow(BackupError)
    expect(bad('{"hello":1}')).toThrow('не файл бэкапа')
    expect(bad('[1,2]')).toThrow(BackupError)
    // Без колод и слов — не бэкап (иначе «Заменить всё» стёрло бы телефон).
    expect(bad(JSON.stringify({ app: 'sparky', format: 1, exportedAt: '2026-10-10', tables: {} }))).toThrow('повреждён')
  })

  it('файл из более новой версии — просим обновиться', () => {
    expect(bad(JSON.stringify({ app: 'sparky', format: BACKUP_FORMAT + 1, exportedAt: '2026-10-10', tables: {} }))).toThrow('обнови')
  })

  it('повреждённые данные — отказ, база не тронута', async () => {
    const d = freshDb()
    await seed(d)
    const before = await snapshot(d)
    const file = JSON.parse((await exportBackup(d)).text)
    file.tables.cards[0].front = 123
    expect(bad(JSON.stringify(file))).toThrow('повреждён')
    const file2 = JSON.parse((await exportBackup(d)).text)
    file2.tables.media[0].data = '%%%не base64%%%'
    expect(bad(JSON.stringify(file2))).toThrow('повреждён')
    expect(await snapshot(d)).toEqual(before)
  })

  it('ошибка посреди замены — остаются старые данные', async () => {
    const d = freshDb()
    await seed(d)
    const before = await snapshot(d)
    const { file } = parseBackup((await exportBackup(d)).text)
    // Два слова с одним id: вторая запись упадёт внутри транзакции.
    file.tables.cards.push({ ...file.tables.cards[0] })
    await expect(replaceAll(d, file)).rejects.toThrow()
    expect(await snapshot(d)).toEqual(before)
  })

  it('base64 туда и обратно', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) % 256)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    expect(backupFileName(new Date('2026-01-02T03:00:00'))).toBe('sparky-backup-2026-01-02.json')
  })
})

describe('бэкап: старые файлы открываются и в новых версиях', () => {
  // Все образцы из fixtures/ — текстом; новый образец подхватывается сам.
  const files = import.meta.glob<string>('./fixtures/*.json', { query: '?raw', import: 'default', eager: true })
  const read = (name: string) => files[`./fixtures/${name}`]
  const fixtures = Object.keys(files).map((p) => p.replace('./fixtures/', ''))

  it('образцы старых файлов на месте', () => {
    expect(fixtures).toContain('backup-v1.json')
    expect(fixtures).toContain('backup-v1-minimal.json')
  })

  for (const name of fixtures) {
    it(`восстанавливается ${name}`, async () => {
      const text = read(name)
      const { file, summary } = parseBackup(text)
      const d = freshDb()
      await replaceAll(d, file)
      expect(await d.decks.count()).toBe(file.tables.decks.length)
      expect(await d.cards.count()).toBe(file.tables.cards.length)
      expect(summary.cards).toBeGreaterThan(0)
      // Всё, что приложение ждёт от слова и настроек, заполнено.
      for (const c of await d.cards.toArray()) {
        expect(c.due).toBeInstanceOf(Date)
        expect(typeof c.state).toBe('number')
        expect(typeof c.suspended).toBe('boolean')
      }
      const s = await d.settings.get('me')
      if (s) for (const key of Object.keys(DEFAULT_SETTINGS)) if (key !== 'voiceURI') expect(s).toHaveProperty(key)
      expect(await d.profile.get('me')).toMatchObject({ id: 'me', level: expect.any(Number) })
    })
  }

  it('недостающие поля заполняются значениями по умолчанию', () => {
    const { file } = parseBackup(read('backup-v1-minimal.json'))
    const card = file.tables.cards[0]
    expect(card).toMatchObject({ suspended: false, state: 0, reps: 0, stability: 0, order: 0 })
    expect(card.due.getTime()).toBe(card.createdAt)
    expect(file.tables.decks[0]).toMatchObject({ emoji: '📚', color: 'green', archived: false })
    expect(file.tables.settings).toMatchObject({ ...DEFAULT_SETTINGS, theme: 'dark' })
    expect(file.tables.days[0]).toMatchObject({ lessons: 1, xp: 0, goalMet: false })
    expect(file.tables.reviewLogs[0]).toMatchObject({ exerciseType: 'flip', durationMs: 0 })
  })

  it('поле, которого схема не знает, не теряется', () => {
    const raw = JSON.parse(read('backup-v1-minimal.json'))
    raw.tables.cards[0].futureField = 'из будущего'
    const { file } = parseBackup(JSON.stringify(raw))
    expect(file.tables.cards[0]).toHaveProperty('futureField', 'из будущего')
  })
})
