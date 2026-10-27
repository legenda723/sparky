// Ежедневные задания (SPEC 8.1): до 3 в день из выполнимых сегодня, выполнил — праздник. Чистые функции.
// Прогресс считается по итогам дня (таблица days), поэтому «Отменить оценку» откатывает и его.
import { plural } from '../srs/status'

/** 'xp' («Набери N XP») с 2026-10-27 не выбирается (дневной цели нет), но остаётся в старых записях дней. */
export type QuestKind = 'xp' | 'combo' | 'reviews' | 'perfect' | 'newWords' | 'lessons' | 'minutes'

export interface Quest {
  kind: QuestKind
  target: number
  progress: number
  done: boolean
}

/** Что за день уже сделано — из итогов дня. */
export interface QuestDayStats {
  xp: number
  /** Оценок FSRS за день. */
  reviews: number
  newLearned: number
  lessons: number
  perfectLessons: number
  /** Самая длинная серия за день — только задания, которые проверяет приложение. */
  bestCombo: number
  msSpent: number
}

/** Что можно сделать сегодня — чтобы не выпало невыполнимое задание. */
export interface QuestContext {
  /** Сколько новых слов ещё можно сегодня (с лимитом). */
  newAvailable: number
  /** Сколько повторений на сегодня. */
  due: number
  /** Заданий в уроке (настройка) — сколько уроков наберётся из повторений. */
  lessonSize: number
}

export const QUESTS_PER_DAY = 3

export function questTitle(q: Pick<Quest, 'kind' | 'target'>): string {
  switch (q.kind) {
    case 'xp':
      return `Набери ${q.target} XP`
    case 'combo':
      return `${q.target} верных подряд`
    case 'reviews':
      return `Повтори ${q.target} слов`
    case 'perfect':
      return 'Урок без ошибок'
    case 'newWords':
      return `Выучи ${q.target} ${plural(q.target, 'новое слово', 'новых слова', 'новых слов')}`
    case 'lessons':
      return `Пройди ${q.target} урока`
    case 'minutes':
      return `Позанимайся ${q.target} минут`
  }
}

/** Значение задания по итогам дня. */
export function questValue(kind: QuestKind, d: QuestDayStats): number {
  switch (kind) {
    case 'xp':
      return d.xp
    case 'combo':
      return d.bestCombo
    case 'reviews':
      return d.reviews
    case 'perfect':
      return d.perfectLessons
    case 'newWords':
      return d.newLearned
    case 'lessons':
      return d.lessons
    case 'minutes':
      return Math.floor(d.msSpent / 60_000)
  }
}

/** Возможные задания на сегодня. Цели — выполнимые. */
function candidates(ctx: QuestContext): Pick<Quest, 'kind' | 'target'>[] {
  // Минуты набираются и тренировкой — это задание есть всегда.
  const out: Pick<Quest, 'kind' | 'target'>[] = [{ kind: 'minutes', target: 10 }]
  // Тренировка — не урок: «Пройди 2 урока» — только если на два урока хватит повторений и новых (по 5 в узле).
  const lessons = Math.ceil(ctx.due / Math.max(1, ctx.lessonSize)) + Math.ceil(ctx.newAvailable / 5)
  if (lessons >= 2) out.push({ kind: 'lessons', target: 2 })
  if (ctx.newAvailable >= 3) out.push({ kind: 'newWords', target: Math.min(5, ctx.newAvailable) })
  if (ctx.due >= 5) out.push({ kind: 'reviews', target: Math.min(20, Math.floor(ctx.due / 5) * 5) })
  // Каждое новое слово — 1–2 задания с выбором; в повторениях проверяемые — ввод и аудирование.
  const checkable = ctx.newAvailable * 2 + ctx.due
  if (checkable >= 12) out.push({ kind: 'combo', target: 10 })
  else if (checkable >= 6) out.push({ kind: 'combo', target: 5 })
  if (ctx.newAvailable + ctx.due >= 3) out.push({ kind: 'perfect', target: 1 })
  return out
}

/** Число от 0 до 1 из строки — одно и то же для одного дня. */
function seeded(key: string): () => number {
  let h = 2166136261
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** До трёх разных заданий на день из выполнимых сегодня (учить нечего — меньше). Для одного дня — всегда те же. */
export function pickQuests(dayKey: string, ctx: QuestContext): Quest[] {
  const rng = seeded(dayKey)
  const pool = candidates(ctx)
  const picked: Pick<Quest, 'kind' | 'target'>[] = []
  while (picked.length < QUESTS_PER_DAY && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return picked.map((q) => ({ ...q, progress: 0, done: false }))
}

/** Задания дня без «Набери XP»: в записях, сделанных до 2026-10-27, оно ещё есть — не показываем и не празднуем. */
export function activeQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.kind !== 'xp')
}

/** Прогресс по свежим итогам дня. Может и уменьшиться (отменили оценку). Старое «Набери XP» в записи не трогаем. */
export function updateQuests(quests: Quest[], d: QuestDayStats): Quest[] {
  return quests.map((q) => {
    if (q.kind === 'xp') return q
    const progress = Math.min(q.target, questValue(q.kind, d))
    return { ...q, progress, done: progress >= q.target }
  })
}

export interface QuestNews {
  /** Выполнены за этот урок. */
  done: Quest[]
  /** Этим уроком выполнены все задания дня — праздник побольше. */
  all: boolean
  /** Все задания дня после урока (для экрана праздника). */
  after: Quest[]
}

/** Что выполнилось между началом и концом урока. */
export function questNews(before: Quest[], after: Quest[]): QuestNews {
  const done = after.filter((q, i) => q.done && !before[i]?.done)
  const all = after.length > 0 && after.every((q) => q.done) && !before.every((q) => q.done)
  return { done, all, after }
}
