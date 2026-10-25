// Уровни и дневная цель (SPEC 8.1). Чистые функции.

/** Сколько XP нужно пройти на уровне n, чтобы получить следующий: 100 + 50·(n−1). */
export function levelNeed(n: number): number {
  return 100 + 50 * (n - 1)
}

export interface LevelInfo {
  level: number
  /** XP, набранные на этом уровне. */
  into: number
  /** Сколько XP всего нужно на этом уровне. */
  need: number
}

/** Уровень по всему XP: 0–99 — уровень 1, 100–249 — уровень 2, 250–449 — уровень 3… */
export function levelInfo(totalXp: number): LevelInfo {
  let level = 1
  let left = Math.max(0, totalXp)
  while (left >= levelNeed(level)) {
    left -= levelNeed(level)
    level++
  }
  return { level, into: left, need: levelNeed(level) }
}

/** Варианты дневной цели в настройках. */
export const GOAL_OPTIONS = [20, 50, 100, 150] as const

export interface GoalInfo {
  xp: number
  goal: number
  /** Доля кольца 0–1. */
  ratio: number
  done: boolean
}

export function goalInfo(dayXp: number, goal: number): GoalInfo {
  const g = Math.max(1, goal)
  return { xp: dayXp, goal: g, ratio: Math.min(1, dayXp / g), done: dayXp >= g }
}
