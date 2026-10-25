// Напоминание о бэкапе (SPEC → 8.3): копия старше 7 дней — плашка в «Настройках» (и точка на шестерёнке «Профиля») и раз в неделю после урока.
import { dayKey } from '../srs/day'
import { plural } from '../srs/status'

export const BACKUP_STALE_MS = 7 * 24 * 60 * 60 * 1000

/** Пора ли напомнить: есть что терять, а копии нет или она старше 7 дней. */
export function isBackupStale(lastBackupAt: number | undefined, hasCards: boolean, now: number): boolean {
  if (!hasCards) return false
  return lastBackupAt === undefined || now - lastBackupAt >= BACKUP_STALE_MS
}

/** После урока напоминаем не чаще раза в неделю. */
export function shouldNudgeAfterLesson(
  lastBackupAt: number | undefined,
  nudgeAt: number | undefined,
  hasCards: boolean,
  now: number,
): boolean {
  if (!isBackupStale(lastBackupAt, hasCards, now)) return false
  return nudgeAt === undefined || now - nudgeAt >= BACKUP_STALE_MS
}

/** «сегодня», «вчера», «3 дня назад», «12 октября». Дни — как везде в приложении, с 04:00. */
export function backupAgeText(lastBackupAt: number | undefined, now: number): string {
  if (lastBackupAt === undefined) return 'ещё не было'
  const days = Math.round((Date.parse(dayKey(new Date(now))) - Date.parse(dayKey(new Date(lastBackupAt)))) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`
  const d = new Date(lastBackupAt)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** Размер файла: «≈ 850 КБ», «≈ 1,2 МБ». */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `≈ ${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `≈ ${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`
}
