import { describe, expect, it } from 'vitest'
import { addDays, dayKey, daysBetween, weekday } from '../srs/day'
import { goalInfo, levelInfo, levelNeed } from './progress'
import { countStreakDay, isDayDone, isStreakAlarm, reconcileStreak, streakFromHistory, streakWeek, type StreakState } from './streak'

const fresh: StreakState = { streak: 0, bestStreak: 0, freezes: 0 }
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min)

describe('дни приложения', () => {
  it('сложение и разница дней — по календарю, через месяц и год', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
    // Переход на зимнее время не ломает счёт (день — по календарю, без часов).
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
  it('день недели: понедельник — 0', () => {
    expect(weekday('2026-10-26')).toBe(0)
    expect(weekday('2026-10-25')).toBe(6)
  })
})

describe('уровни и дневная цель (8.1)', () => {
  it('уровень n требует 100 + 50·(n−1) XP', () => {
    expect([levelNeed(1), levelNeed(2), levelNeed(5)]).toEqual([100, 150, 300])
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelInfo(99).level).toBe(1)
    expect(levelInfo(100)).toEqual({ level: 2, into: 0, need: 150 })
    expect(levelInfo(249).level).toBe(2)
    expect(levelInfo(250)).toEqual({ level: 3, into: 0, need: 200 })
  })
  it('кольцо цели заполняется и не переливается', () => {
    expect(goalInfo(25, 50)).toEqual({ xp: 25, goal: 50, ratio: 0.5, done: false })
    expect(goalInfo(70, 50)).toMatchObject({ ratio: 1, done: true })
  })
})

describe('стрик (8.1)', () => {
  it('первый урок — стрик 1; второй урок в тот же день ничего не меняет', () => {
    const a = countStreakDay(fresh, '2026-10-20')
    expect(a).toMatchObject({ counted: true, state: { streak: 1, bestStreak: 1, lastStreakDay: '2026-10-20' } })
    const b = countStreakDay(a.state, '2026-10-20')
    expect(b.counted).toBe(false)
    expect(b.state).toEqual(a.state)
  })

  it('через полночь и 04:00: урок в 23:50 и в 01:30 — один день, в 04:05 — уже следующий', () => {
    const evening = countStreakDay(fresh, dayKey(at(2026, 10, 20, 23, 50)))
    const night = countStreakDay(evening.state, dayKey(at(2026, 10, 21, 1, 30)))
    expect(night.counted).toBe(false)
    expect(night.state.streak).toBe(1)
    const morning = countStreakDay(night.state, dayKey(at(2026, 10, 21, 4, 5)))
    expect(morning.counted).toBe(true)
    expect(morning.state).toMatchObject({ streak: 2, lastStreakDay: '2026-10-21' })
  })

  it('урок в 04:00 и следующей ночью в 03:59 — ещё один и тот же день', () => {
    const a = countStreakDay(fresh, dayKey(at(2026, 10, 20, 4, 0)))
    const b = countStreakDay(a.state, dayKey(at(2026, 10, 21, 3, 59)))
    expect([a.state.lastStreakDay, b.counted]).toEqual(['2026-10-20', false])
  })

  it('пропуск без заморозки — стрик сгорает, следующий урок начинает с 1', () => {
    const s: StreakState = { streak: 5, bestStreak: 5, lastStreakDay: '2026-10-20', freezes: 0 }
    expect(reconcileStreak(s, '2026-10-22')).toMatchObject({ lost: true, state: { streak: 0 } })
    const c = countStreakDay(s, '2026-10-22')
    expect(c.state).toMatchObject({ streak: 1, bestStreak: 5 })
  })

  it('пропуск с заморозкой — она тратится сама, стрик живёт, замороженный день его не увеличивает', () => {
    const s: StreakState = { streak: 5, bestStreak: 5, lastStreakDay: '2026-10-20', freezes: 1 }
    const r = reconcileStreak(s, '2026-10-22')
    expect(r).toEqual({ state: { ...s, freezes: 0, lastStreakDay: '2026-10-21' }, frozen: ['2026-10-21'], lost: false })
    // Повторная проверка в тот же день ничего не тратит.
    expect(reconcileStreak(r.state, '2026-10-22').frozen).toEqual([])
    const c = countStreakDay(s, '2026-10-22')
    expect(c.state).toMatchObject({ streak: 6, freezes: 0 })
    expect(c.frozen).toEqual(['2026-10-21'])
  })

  it('два пропуска и две заморозки — обе тратятся; три пропуска и две заморозки — стрик сгорает, заморозки целы', () => {
    const s: StreakState = { streak: 9, bestStreak: 9, lastStreakDay: '2026-10-20', freezes: 2 }
    expect(reconcileStreak(s, '2026-10-23')).toMatchObject({ frozen: ['2026-10-21', '2026-10-22'], state: { streak: 9, freezes: 0 } })
    expect(reconcileStreak(s, '2026-10-24')).toMatchObject({ lost: true, frozen: [], state: { streak: 0, freezes: 2 } })
  })

  it('сегодня ещё не занимался — это не пропуск', () => {
    const s: StreakState = { streak: 3, bestStreak: 3, lastStreakDay: '2026-10-20', freezes: 0 }
    expect(reconcileStreak(s, '2026-10-21')).toMatchObject({ lost: false, frozen: [], state: s })
  })

  it('каждые 7 дней подряд — +1 заморозка, в запасе не больше 2', () => {
    let s: StreakState = fresh
    const earned: number[] = []
    for (let i = 0; i < 21; i++) {
      const c = countStreakDay(s, addDays('2026-10-01', i))
      if (c.freezeEarned) earned.push(c.state.streak)
      s = c.state
    }
    expect(earned).toEqual([7, 14])
    expect(s.freezes).toBe(2)
  })

  it('отметки 3, 7, 14, 30 … — праздник только в день отметки', () => {
    let s: StreakState = fresh
    const marks: number[] = []
    for (let i = 0; i < 31; i++) {
      const c = countStreakDay(s, addDays('2026-10-01', i))
      if (c.milestone) marks.push(c.milestone)
      s = c.state
    }
    expect(marks).toEqual([3, 7, 14, 30])
  })

  it('тревожный огонь — с 20:00 и до 04:00, пока день не засчитан', () => {
    const s: StreakState = { streak: 4, bestStreak: 4, lastStreakDay: '2026-10-20', freezes: 0 }
    const today = '2026-10-21'
    expect(isStreakAlarm(s, today, at(2026, 10, 21, 19, 59))).toBe(false)
    expect(isStreakAlarm(s, today, at(2026, 10, 21, 20, 0))).toBe(true)
    expect(isStreakAlarm(s, today, at(2026, 10, 22, 1, 30))).toBe(true)
    const done = countStreakDay(s, today).state
    expect(isDayDone(done, today)).toBe(true)
    expect(isStreakAlarm(done, today, at(2026, 10, 21, 21, 0))).toBe(false)
    // Без стрика тревожиться не о чем.
    expect(isStreakAlarm(fresh, today, at(2026, 10, 21, 21, 0))).toBe(false)
  })

  it('неделя для календаря: с понедельника, засчитанные, замороженные, пропуски, сегодня и будущее', () => {
    const marks = new Map([
      ['2026-10-26', 'done'],
      ['2026-10-27', 'frozen'],
    ] as const)
    const w = streakWeek('2026-10-29', marks)
    expect(w.map((d) => `${d.label}:${d.state}`)).toEqual([
      'Пн:done',
      'Вт:frozen',
      'Ср:missed',
      'Чт:today',
      'Пт:future',
      'Сб:future',
      'Вс:future',
    ])
  })

  it('стрик по прошлым урокам (первое открытие после обновления)', () => {
    const days = new Set(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-20', '2026-10-21', '2026-10-22'])
    // Сегодня ещё не занимался — стрик до вчера.
    expect(streakFromHistory(days, '2026-10-23')).toEqual({ streak: 3, bestStreak: 3, lastStreakDay: '2026-10-22', freezes: 0 })
    // Уже занимался сегодня.
    expect(streakFromHistory(new Set([...days, '2026-10-23']), '2026-10-23').streak).toBe(4)
    // Был пропуск — стрик 0, лучший сохраняется.
    expect(streakFromHistory(days, '2026-10-25')).toMatchObject({ streak: 0, bestStreak: 3, lastStreakDay: undefined })
    // Неделя подряд — заморозка.
    const week = new Set(Array.from({ length: 8 }, (_, i) => addDays('2026-10-15', i)))
    expect(streakFromHistory(week, '2026-10-23')).toMatchObject({ streak: 8, freezes: 1 })
  })
})
