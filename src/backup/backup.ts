// Бэкап (SPEC → 8.3): все таблицы, фото и записи — в один JSON-файл; восстановление — только «Заменить всё».
import type { SparkyDb } from '../db/db'
import { DEFAULT_PROFILE, type Card, type Deck, type Media, type Profile, type Settings } from '../db/types'
import { BACKUP_APP, BACKUP_FORMAT, backupSchema, type BackupFile } from './schema'

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Имя файла: sparky-backup-ГГГГ-ММ-ДД.json (по местной дате). */
export function backupFileName(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `sparky-backup-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}.json`
}

/** Что внутри: для окна перед сохранением и предпросмотра восстановления. Удалённое не считаем. */
export interface BackupSummary {
  decks: number
  cards: number
  images: number
  audios: number
  reviews: number
}

function summarize(decks: Deck[], cards: Card[], media: { kind: Media['kind'] }[], reviews: number): BackupSummary {
  const liveDecks = new Set(decks.filter((d) => d.deletedAt === undefined).map((d) => d.id))
  return {
    decks: liveDecks.size,
    cards: cards.filter((c) => c.deletedAt === undefined && liveDecks.has(c.deckId)).length,
    images: media.filter((m) => m.kind === 'image').length,
    audios: media.filter((m) => m.kind === 'audio').length,
    reviews,
  }
}

export interface PreparedBackup {
  fileName: string
  text: string
  /** Размер файла в байтах. */
  size: number
  summary: BackupSummary
  exportedAt: Date
}

/** Собирает файл бэкапа. База читается одним снимком, чтобы части файла были согласованы. */
export async function exportBackup(db: SparkyDb, now = new Date()): Promise<PreparedBackup> {
  const t = await db.transaction(
    'r',
    [db.decks, db.cards, db.media, db.reviewLogs, db.days, db.profile, db.quests, db.settings],
    async () => ({
      decks: await db.decks.toArray(),
      cards: await db.cards.toArray(),
      media: await db.media.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      days: await db.days.toArray(),
      profile: (await db.profile.get('me')) ?? null,
      quests: await db.quests.toArray(),
      settings: (await db.settings.get('me')) ?? null,
    }),
  )
  const media = await Promise.all(
    t.media.map(async ({ blob, ...rest }) => ({ ...rest, data: bytesToBase64(await blobBytes(blob)) })),
  )
  const file = { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), tables: { ...t, media } }
  const text = JSON.stringify(file)
  return {
    fileName: backupFileName(now),
    text,
    size: new Blob([text]).size,
    summary: summarize(t.decks, t.cards, t.media, t.reviewLogs.length),
    exportedAt: now,
  }
}

/** Почему файл не подошёл — текст для владельца. */
export class BackupError extends Error {}

/**
 * Шаги перевода старых форматов: MIGRATIONS[n] переводит файл формата n в n + 1.
 * Пока формат один. Когда появится второй — добавить сюда шаг 1 → 2 и образец файла в fixtures/.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

export interface ParsedBackup {
  file: BackupFile
  summary: BackupSummary
}

/** Читает и проверяет файл. Ничего не пишет в базу. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Это не файл бэкапа Спарки')
  }
  if (!raw || typeof raw !== 'object' || (raw as { app?: unknown }).app !== BACKUP_APP) {
    throw new BackupError('Это не файл бэкапа Спарки')
  }
  let obj = raw as Record<string, unknown>
  let format = obj.format
  if (typeof format !== 'number' || !Number.isInteger(format) || format < 1) {
    throw new BackupError('Файл повреждён: непонятная версия')
  }
  if (format > BACKUP_FORMAT) {
    throw new BackupError('Файл из более новой версии Спарки — сначала обнови приложение')
  }
  while (format < BACKUP_FORMAT) {
    const step = MIGRATIONS[format]
    if (!step) throw new BackupError('Файл слишком старый')
    obj = step(obj)
    format += 1
    obj.format = format
  }
  const result = backupSchema.safeParse(obj)
  if (!result.success) throw new BackupError('Файл повреждён — восстановить из него нельзя')
  const file = result.data
  const { tables } = file
  return {
    file,
    summary: summarize(tables.decks as Deck[], tables.cards as Card[], tables.media, tables.reviewLogs.length),
  }
}

/**
 * «Заменить всё»: стирает всё на телефоне и кладёт данные из файла — одной транзакцией
 * (при любой ошибке остаются старые данные). Отметка последнего бэкапа — время создания файла.
 */
export async function replaceAll(db: SparkyDb, file: BackupFile): Promise<void> {
  const { tables } = file
  const media: Media[] = tables.media.map(({ data, ...rest }) => ({
    ...rest,
    blob: new Blob([base64ToBytes(data)], { type: rest.mime }),
  }))
  const profile = { ...DEFAULT_PROFILE, ...tables.profile, lastBackupAt: file.exportedAt.getTime() } as Profile
  await db.transaction(
    'rw',
    [db.decks, db.cards, db.media, db.reviewLogs, db.days, db.profile, db.quests, db.settings],
    async () => {
      await Promise.all([
        db.decks.clear(),
        db.cards.clear(),
        db.media.clear(),
        db.reviewLogs.clear(),
        db.days.clear(),
        db.profile.clear(),
        db.quests.clear(),
        db.settings.clear(),
      ])
      await db.decks.bulkAdd(tables.decks as Deck[])
      await db.cards.bulkAdd(tables.cards as Card[])
      await db.media.bulkAdd(media)
      await db.reviewLogs.bulkAdd(tables.reviewLogs)
      await db.days.bulkAdd(tables.days)
      await db.quests.bulkAdd(tables.quests)
      await db.profile.add(profile)
      if (tables.settings) await db.settings.add(tables.settings as Settings)
    },
  )
}

/** Отметить, что копия сохранена (меню «Поделиться» не отменили). */
export async function markBackedUp(db: SparkyDb, at = Date.now()): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const p = await db.profile.get('me')
    await db.profile.put({ ...DEFAULT_PROFILE, ...p, lastBackupAt: at })
  })
}

/** Отметить, что после урока напомнили о копии (следующее напоминание — через неделю). */
export async function markNudged(db: SparkyDb, at = Date.now()): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const p = await db.profile.get('me')
    await db.profile.put({ ...DEFAULT_PROFILE, ...p, backupNudgeAt: at })
  })
}
