import { createEmptyCard, type Card as FsrsCard } from 'ts-fsrs'

/** Поля FSRS для только что добавленного слова (состояние «новое»). */
export function newFsrsFields(now: Date): FsrsCard {
  return createEmptyCard(now)
}
