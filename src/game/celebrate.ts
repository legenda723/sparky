// Праздники после урока (SPEC 7.2, 8.1): что показать после итога и в каком порядке. Чистая функция.
// Каждый экран — только по своему событию, поэтому обычный второй урок за день заканчивается одним итогом.
import type { Achievement } from './achievements'
import type { QuestNews } from './quests'
import type { Counted } from './streak'

export type Celebration =
  | { kind: 'quests'; news: QuestNews }
  | { kind: 'streak'; streak: number; milestone?: number; freezeEarned: boolean; freezes: number }
  | { kind: 'level'; level: number }
  | { kind: 'achievements'; list: Achievement[] }
  /** «План на сегодня выполнен!» (SPEC 6.5) — всегда последним, раз в день. */
  | { kind: 'plan'; freshLeft: number; extraEstimate: number }

export interface LessonEvents {
  quests: QuestNews
  /** Итог засчитывания дня; нет — урок день не засчитывает (тренировка, когда есть что учить). */
  streak?: Counted
  levelBefore: number
  levelAfter: number
  achievements: Achievement[]
}

/** Порядок: задания дня → стрик (только первый урок за день) → новый уровень → достижения. */
export function lessonCelebrations(e: LessonEvents): Celebration[] {
  const out: Celebration[] = []
  if (e.quests.done.length > 0) out.push({ kind: 'quests', news: e.quests })
  if (e.streak?.counted) {
    const s = e.streak
    out.push({ kind: 'streak', streak: s.state.streak, milestone: s.milestone, freezeEarned: s.freezeEarned, freezes: s.state.freezes })
  }
  // Сразу несколько уровней (редко) — один экран с последним.
  if (e.levelAfter > e.levelBefore) out.push({ kind: 'level', level: e.levelAfter })
  if (e.achievements.length > 0) out.push({ kind: 'achievements', list: e.achievements })
  return out
}
