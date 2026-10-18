import type { DeckColor } from '../db/types'

// Цвета колод (DESIGN.md → «Цвета колод»): основной и цвет «тени».
export const DECK_COLORS: Record<DeckColor, { fill: string; shadow: string; label: string }> = {
  green: { fill: 'var(--c-primary)', shadow: 'var(--c-primary-shadow)', label: 'Зелёный' },
  blue: { fill: 'var(--c-info)', shadow: 'var(--c-info-shadow)', label: 'Синий' },
  orange: { fill: 'var(--c-streak)', shadow: 'var(--c-streak-shadow)', label: 'Оранжевый' },
  purple: { fill: 'var(--c-gem)', shadow: 'var(--c-gem-shadow)', label: 'Фиолетовый' },
  pink: { fill: 'var(--c-deck-pink)', shadow: 'var(--c-deck-pink-shadow)', label: 'Розовый' },
  teal: { fill: 'var(--c-deck-teal)', shadow: 'var(--c-deck-teal-shadow)', label: 'Бирюзовый' },
}

export const DECK_COLOR_ORDER = Object.keys(DECK_COLORS) as DeckColor[]

export const DECK_EMOJIS = [
  '📚', '✏️', '💬', '🍎', '🍕', '☕', '🏠', '🛋️', '👕', '🚗', '✈️', '🗺️',
  '🏙️', '🌳', '🐶', '🐱', '💼', '💻', '📱', '🎵', '🎬', '⚽', '🏋️', '❤️',
  '😊', '🧠', '⏰', '💰', '🛒', '🏥', '🎓', '🌍', '☀️', '⭐', '🔥', '🎉',
]
