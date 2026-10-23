// База на телефоне (IndexedDB через Dexie).
// Схема меняется ТОЛЬКО новой версией с миграцией и тестом (CLAUDE.md → «Данные — святое»).
import { Dexie, type EntityTable } from 'dexie'
import type { Card, DayRecord, Deck, Media, Profile, QuestDay, ReviewLogRecord, Settings } from './types'

export const DB_NAME = 'sparky'

export class SparkyDb extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<Card, 'id'>
  media!: EntityTable<Media, 'id'>
  reviewLogs!: EntityTable<ReviewLogRecord, 'id'>
  days!: EntityTable<DayRecord, 'dayKey'>
  profile!: EntityTable<Profile, 'id'>
  quests!: EntityTable<QuestDay, 'dayKey'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    // Версия 1 (этап 3). Индексы — только поля, по которым ищем.
    this.version(1).stores({
      decks: 'id, order',
      cards: 'id, deckId, [deckId+order], due, state',
      media: 'id',
      reviewLogs: '++id, cardId, review',
      days: 'dayKey',
      profile: 'id',
      quests: 'dayKey',
      settings: 'id',
    })
  }
}

export const db = new SparkyDb()
