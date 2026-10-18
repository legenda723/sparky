// «Вставить списком» (SPEC 7.3): каждая строка — одна карточка.
// Короткий формат: «word - перевод». Полный: «word | перевод | транскрипция | пример | перевод примера».
import type { CardText } from '../db/cards'

export interface ParsedLine {
  line: number
  text: CardText
  /** Такое слово уже есть в колоде или выше в этом же списке. */
  duplicate: boolean
}

export interface ParseError {
  line: number
  raw: string
  reason: string
}

export interface ParseResult {
  cards: ParsedLine[]
  errors: ParseError[]
}

/** Для сравнения слов: регистр и лишние пробелы не важны. */
export function normalizeWord(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Тире с пробелами вокруг (дефис, короткое, длинное) или табуляция — чтобы «well-known» не делилось.
const SHORT_SEPARATOR = /\s+[-–—]\s+|\t/

function parseLine(raw: string): CardText | string {
  if (raw.includes('|')) {
    const [front = '', back = '', transcription, example, exampleTranslation] = raw.split('|').map((p) => p.trim())
    if (!front) return 'Нет английского слова'
    if (!back) return 'Нет перевода'
    return { front, back, transcription, example, exampleTranslation }
  }
  const match = SHORT_SEPARATOR.exec(raw)
  if (!match) return 'Нет перевода: нужно «слово - перевод»'
  const front = raw.slice(0, match.index).trim()
  const back = raw.slice(match.index + match[0].length).trim()
  if (!front) return 'Нет английского слова'
  if (!back) return 'Нет перевода'
  return { front, back }
}

export function parseList(input: string, existingFronts: string[] = []): ParseResult {
  const seen = new Set(existingFronts.map(normalizeWord))
  const cards: ParsedLine[] = []
  const errors: ParseError[] = []
  input.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return
    const parsed = parseLine(raw)
    if (typeof parsed === 'string') {
      errors.push({ line: i + 1, raw: raw.trim(), reason: parsed })
      return
    }
    const key = normalizeWord(parsed.front)
    cards.push({ line: i + 1, text: parsed, duplicate: seen.has(key) })
    seen.add(key)
  })
  return { cards, errors }
}
