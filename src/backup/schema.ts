// Схема файла бэкапа (SPEC → 8.3). Проверяет файл перед восстановлением.
//
// Старые файлы должны открываться во всех будущих версиях (CLAUDE.md → «Данные — святое»):
// - новое поле в базе → здесь значение по умолчанию (.default), чтобы файл без него проходил проверку;
// - поменялось устройство файла → BACKUP_FORMAT + 1 и шаг перевода в MIGRATIONS (backup.ts);
// - образцы старых файлов в fixtures/ не правим, тест их восстановления всегда зелёный.
// Объекты «свободные» (looseObject): поле, которое забыли сюда вписать, всё равно не потеряется.
import { z } from 'zod'
import { emptyDay } from '../db/review'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../db/types'

/** Номер формата файла. Меняется только вместе с шагом перевода со старого номера. */
export const BACKUP_FORMAT = 1
export const BACKUP_APP = 'sparky'

const date = z.coerce.date()
const ms = z.number()
const day0 = emptyDay('')
const S = DEFAULT_SETTINGS
const P = DEFAULT_PROFILE

const deck = z.looseObject({
  id: z.string(),
  title: z.string(),
  emoji: z.string().default('📚'),
  color: z.enum(['green', 'blue', 'orange', 'purple', 'pink', 'teal']).catch('green'),
  order: z.number().default(0),
  createdAt: ms.default(0),
  archived: z.boolean().default(false),
  deletedAt: ms.optional(),
})

const card = z
  .looseObject({
    id: z.string(),
    deckId: z.string(),
    order: z.number().default(0),
    front: z.string(),
    back: z.string(),
    transcription: z.string().optional(),
    example: z.string().optional(),
    exampleTranslation: z.string().optional(),
    note: z.string().optional(),
    imageId: z.string().optional(),
    audioId: z.string().optional(),
    createdAt: ms.default(0),
    updatedAt: ms.default(0),
    suspended: z.boolean().default(false),
    deletedAt: ms.optional(),
    introducedAt: ms.optional(),
    // Поля FSRS: нет — значит слово ещё новое.
    due: date.optional(),
    stability: z.number().default(0),
    difficulty: z.number().default(0),
    elapsed_days: z.number().default(0),
    scheduled_days: z.number().default(0),
    learning_steps: z.number().default(0),
    reps: z.number().default(0),
    lapses: z.number().default(0),
    state: z.number().int().min(0).max(3).default(0),
    last_review: date.optional(),
  })
  .transform((c) => ({ ...c, due: c.due ?? new Date(c.createdAt) }))

const media = z.looseObject({
  id: z.string(),
  kind: z.enum(['image', 'audio']),
  mime: z.string(),
  /** Содержимое фото или записи в base64. */
  data: z.base64(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationMs: z.number().optional(),
  createdAt: ms.default(0),
})

const reviewLog = z.looseObject({
  id: z.number().int().optional(),
  cardId: z.string(),
  rating: z.number(),
  state: z.number(),
  due: date,
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number().default(0),
  review: date,
  exerciseType: z.string().default('flip'),
  durationMs: z.number().default(0),
})

const dayRecord = z.looseObject({
  dayKey: z.string(),
  xp: z.number().default(day0.xp),
  lessons: z.number().default(day0.lessons),
  reviews: z.number().default(day0.reviews),
  newLearned: z.number().default(day0.newLearned),
  correct: z.number().default(day0.correct),
  wrong: z.number().default(day0.wrong),
  msSpent: z.number().default(day0.msSpent),
  goalMet: z.boolean().default(day0.goalMet),
  freezeUsed: z.boolean().default(day0.freezeUsed),
})

const profile = z.looseObject({
  id: z.literal('me').default('me'),
  totalXp: z.number().default(P.totalXp),
  level: z.number().default(P.level),
  gems: z.number().default(P.gems),
  streak: z.number().default(P.streak),
  bestStreak: z.number().default(P.bestStreak),
  lastStreakDay: z.string().optional(),
  freezes: z.number().default(P.freezes),
  mascotItems: z.array(z.string()).default([]),
  unlockedThemes: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  chestsClaimed: z.array(z.string()).default([]),
  lastBackupAt: ms.optional(),
  backupNudgeAt: ms.optional(),
})

const questDay = z.looseObject({
  dayKey: z.string(),
  quests: z
    .array(z.looseObject({ kind: z.string(), target: z.number(), progress: z.number().default(0), done: z.boolean().default(false) }))
    .default([]),
  chestClaimed: z.boolean().default(false),
})

const settings = z.looseObject({
  id: z.literal('me').default('me'),
  theme: z.enum(['system', 'light', 'dark']).catch(S.theme),
  sound: z.boolean().default(S.sound),
  haptics: z.boolean().default(S.haptics),
  dailyGoalXp: z.number().default(S.dailyGoalXp),
  newPerDay: z.number().default(S.newPerDay),
  lessonSize: z.number().default(S.lessonSize),
  reviewLimit: z.number().default(S.reviewLimit),
  retention: z.number().min(0.7).max(0.99).catch(S.retention),
  voiceURI: z.string().optional(),
  speechRate: z.number().default(S.speechRate),
  autoSpeak: z.boolean().default(S.autoSpeak),
})

export const backupSchema = z.looseObject({
  app: z.literal(BACKUP_APP),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: date,
  tables: z.looseObject({
    // Колоды и слова есть в любом настоящем файле (пусть и пустыми списками): без них это не бэкап,
    // и «Заменить всё» стёрло бы телефон. Таблицы, которые появятся позже, — с .default([]).
    decks: z.array(deck),
    cards: z.array(card),
    media: z.array(media).default([]),
    reviewLogs: z.array(reviewLog).default([]),
    days: z.array(dayRecord).default([]),
    profile: profile.nullable().default(null),
    quests: z.array(questDay).default([]),
    settings: settings.nullable().default(null),
  }),
})

export type BackupFile = z.output<typeof backupSchema>
