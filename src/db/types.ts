// Записи базы (SPEC → раздел 5). Даты карточки FSRS — Date (как в ts-fsrs), остальные отметки времени — мс.
import type { Card as FsrsCard } from 'ts-fsrs'

export type Id = string

/** Цвет колоды — из набора DESIGN.md → «Цвета колод». */
export type DeckColor = 'green' | 'blue' | 'orange' | 'purple' | 'pink' | 'teal'

export interface Deck {
  id: Id
  title: string
  emoji: string
  color: DeckColor
  order: number
  createdAt: number
  archived: boolean
  deletedAt?: number
}

/** Поля карточки FSRS хранятся прямо в карточке. */
export interface Card extends FsrsCard {
  id: Id
  deckId: Id
  order: number
  front: string
  back: string
  transcription?: string
  example?: string
  exampleTranslation?: string
  note?: string
  imageId?: Id
  audioId?: Id
  createdAt: number
  updatedAt: number
  suspended: boolean
  deletedAt?: number
  introducedAt?: number
}

export interface Media {
  id: Id
  kind: 'image' | 'audio'
  blob: Blob
  mime: string
  width?: number
  height?: number
  durationMs?: number
  createdAt: number
}

export interface ReviewLogRecord {
  id?: number
  cardId: Id
  rating: number
  state: number
  due: Date
  stability: number
  difficulty: number
  elapsed_days: number
  review: Date
  exerciseType: string
  durationMs: number
}

export interface DayRecord {
  dayKey: string
  xp: number
  lessons: number
  reviews: number
  newLearned: number
  correct: number
  wrong: number
  msSpent: number
  goalMet: boolean
  freezeUsed: boolean
}

export interface Profile {
  id: 'me'
  totalXp: number
  level: number
  gems: number
  streak: number
  bestStreak: number
  lastStreakDay?: string
  freezes: number
  mascotItems: string[]
  unlockedThemes: string[]
  achievements: string[]
  chestsClaimed: string[]
  lastBackupAt?: number
  /** Когда последний раз после урока напоминали о бэкапе (не чаще раза в неделю). */
  backupNudgeAt?: number
}

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  totalXp: 0,
  level: 1,
  gems: 0,
  streak: 0,
  bestStreak: 0,
  freezes: 0,
  mascotItems: [],
  unlockedThemes: [],
  achievements: [],
  chestsClaimed: [],
}

export interface QuestDay {
  dayKey: string
  quests: { kind: string; target: number; progress: number; done: boolean }[]
  chestClaimed: boolean
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  id: 'me'
  theme: ThemePref
  sound: boolean
  haptics: boolean
  dailyGoalXp: number
  newPerDay: number
  lessonSize: number
  /** 0 — без лимита. */
  reviewLimit: number
  retention: number
  voiceURI?: string
  speechRate: number
  autoSpeak: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'me',
  theme: 'system',
  sound: true,
  haptics: true,
  dailyGoalXp: 50,
  newPerDay: 10,
  lessonSize: 15,
  reviewLimit: 0,
  retention: 0.9,
  speechRate: 1,
  autoSpeak: true,
}
