import { describe, expect, it } from 'vitest'
import { BACKUP_STALE_MS, backupAgeText, formatSize, isBackupStale, shouldNudgeAfterLesson } from './reminder'

const NOW = new Date('2026-10-18T12:00:00').getTime()
const DAY = 86_400_000

describe('напоминание о бэкапе', () => {
  it('нет слов — не напоминаем', () => {
    expect(isBackupStale(undefined, false, NOW)).toBe(false)
  })
  it('копии не было или ей 7 дней — напоминаем', () => {
    expect(isBackupStale(undefined, true, NOW)).toBe(true)
    expect(isBackupStale(NOW - BACKUP_STALE_MS, true, NOW)).toBe(true)
    expect(isBackupStale(NOW - 6 * DAY, true, NOW)).toBe(false)
  })
  it('после урока — не чаще раза в неделю', () => {
    expect(shouldNudgeAfterLesson(undefined, undefined, true, NOW)).toBe(true)
    expect(shouldNudgeAfterLesson(undefined, NOW - 3 * DAY, true, NOW)).toBe(false)
    expect(shouldNudgeAfterLesson(undefined, NOW - 7 * DAY, true, NOW)).toBe(true)
    expect(shouldNudgeAfterLesson(NOW - DAY, undefined, true, NOW)).toBe(false)
  })
})

describe('тексты', () => {
  it('давность копии — по дням приложения (с 04:00)', () => {
    expect(backupAgeText(undefined, NOW)).toBe('ещё не было')
    expect(backupAgeText(new Date('2026-10-18T05:00:00').getTime(), NOW)).toBe('сегодня')
    // 02:00 ночи 18-го — это ещё 17-е
    expect(backupAgeText(new Date('2026-10-18T02:00:00').getTime(), NOW)).toBe('вчера')
    expect(backupAgeText(NOW - 3 * DAY, NOW)).toBe('3 дня назад')
    expect(backupAgeText(NOW - 5 * DAY, NOW)).toBe('5 дней назад')
    expect(backupAgeText(new Date('2026-10-02T12:00:00').getTime(), NOW)).toBe('2 октября')
    expect(backupAgeText(new Date('2025-12-31T12:00:00').getTime(), NOW)).toMatch(/2025/)
  })
  it('размер файла', () => {
    expect(formatSize(300)).toBe('≈ 1 КБ')
    expect(formatSize(850 * 1024)).toBe('≈ 850 КБ')
    expect(formatSize(1.25 * 1024 * 1024)).toMatch(/^≈ 1,[23] МБ$/)
  })
})
