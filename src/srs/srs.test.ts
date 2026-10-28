import { createEmptyCard, Rating, State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { buildPath, nodeCardIds } from '../game/path'
import { dayKey, dayStart, nextDayStart } from './day'
import { gradeAuto } from './grade'
import {
  accuracy,
  afterGrade,
  afterIntro,
  buildLesson,
  currentTask,
  isFinished,
  MAX_RETURNS,
  startLesson,
  todayCounts,
  type LessonCardInput,
  type LessonLimits,
} from './lesson'
import { GRADES, outcomes, shortInterval } from './scheduler'

const at = (s: string) => new Date(s) // местное время: '2026-10-18T15:00'

describe('dayKey — день начинается в 04:00', () => {
  it('днём — сегодняшний день', () => {
    expect(dayKey(at('2026-10-18T15:00'))).toBe('2026-10-18')
  })
  it('в 01:30 ночи — ещё вчерашний', () => {
    expect(dayKey(at('2026-10-19T01:30'))).toBe('2026-10-18')
  })
  it('в 03:59 — вчерашний, в 04:00 — новый', () => {
    expect(dayKey(at('2026-10-19T03:59'))).toBe('2026-10-18')
    expect(dayKey(at('2026-10-19T04:00'))).toBe('2026-10-19')
  })
  it('через полночь месяца и года', () => {
    expect(dayKey(at('2027-01-01T02:00'))).toBe('2026-12-31')
  })
  it('начало дня и следующего дня', () => {
    expect(dayStart(at('2026-10-19T01:30'))).toEqual(at('2026-10-18T04:00'))
    expect(nextDayStart(at('2026-10-18T23:00'))).toEqual(at('2026-10-19T04:00'))
    expect(nextDayStart(at('2026-10-19T02:00'))).toEqual(at('2026-10-19T04:00'))
  })
})

describe('планировщик', () => {
  const t = at('2026-10-18T15:00')

  it('новое слово: Снова — 1 мин, Хорошо — 10 мин (шаги обучения)', () => {
    const o = outcomes(createEmptyCard(t), t, 0.9)
    expect(shortInterval(o[Rating.Again].card.due, t)).toBe('1 мин')
    expect(shortInterval(o[Rating.Good].card.due, t)).toBe('10 мин')
    expect(o[Rating.Easy].card.state).toBe(State.Review)
  })

  it('интервалы растут от «Снова» к «Легко»', () => {
    let card = createEmptyCard(t)
    let time = t
    // Выучили и повторили пару раз на «Хорошо»
    for (let i = 0; i < 4; i++) {
      card = outcomes(card, time, 0.9)[Rating.Good].card
      time = card.due
    }
    const o = outcomes(card, time, 0.9)
    const dues = GRADES.map((g) => o[g].card.due.getTime())
    for (let i = 1; i < dues.length; i++) expect(dues[i]).toBeGreaterThan(dues[i - 1])
    // «Снова» у знакомого слова — переобучение через 10 минут
    expect(shortInterval(o[Rating.Again].card.due, time)).toBe('10 мин')
    expect(o[Rating.Again].card.state).toBe(State.Relearning)
  })

  it('подписи интервалов', () => {
    const d = (ms: number) => new Date(t.getTime() + ms)
    expect(shortInterval(d(30_000), t)).toBe('1 мин')
    expect(shortInterval(d(3 * 3600_000), t)).toBe('3 ч')
    expect(shortInterval(d(1 * 86400_000), t)).toBe('1 день')
    expect(shortInterval(d(3 * 86400_000), t)).toBe('3 дня')
    expect(shortInterval(d(12 * 86400_000), t)).toBe('12 дней')
    expect(shortInterval(d(61 * 86400_000), t)).toBe('2 мес')
    expect(shortInterval(d(548 * 86400_000), t)).toBe('1,5 г')
  })

  it('разброс (fuzz) включён: у одинаковых слов в разное время — разные длинные интервалы', () => {
    const days = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const time = new Date(t.getTime() + i * 1000)
      let card = createEmptyCard(time)
      card = outcomes(card, time, 0.9)[Rating.Easy].card
      const o = outcomes(card, card.due, 0.9)[Rating.Good]
      days.add(o.card.scheduled_days)
    }
    expect(days.size).toBeGreaterThan(1)
  })
})

describe('правила оценок (6.4)', () => {
  it('ошибка → Снова, верно → Хорошо', () => {
    expect(gradeAuto({ type: 'choice-en-ru', correct: false, durationMs: 1000 })).toBe(Rating.Again)
    expect(gradeAuto({ type: 'choice-en-ru', correct: true, durationMs: 1000 })).toBe(Rating.Good)
  })
  it('подсказка, опечатка, долго → Трудно', () => {
    expect(gradeAuto({ type: 'listen', correct: true, hinted: true, durationMs: 1000 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'type', correct: true, typo: true, durationMs: 1000 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'choice-ru-en', correct: true, durationMs: 12_001 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'type', correct: true, durationMs: 15_000 })).toBe(Rating.Good)
    expect(gradeAuto({ type: 'type', correct: true, durationMs: 20_001 })).toBe(Rating.Hard)
  })
})

// --- Урок ---

const NOW = at('2026-10-18T15:00')
const LIMITS: LessonLimits = { size: 15, newPerDay: 10, newToday: 0, reviewLimit: 0, reviewsToday: 0, retention: 0.9 }

function card(id: string, deckId: string, order: number, patch: Partial<LessonCardInput> = {}): LessonCardInput {
  return { ...createEmptyCard(at('2026-10-01T12:00')), id, deckId, order, suspended: false, ...patch }
}

function review(id: string, dueISO: string, stability = 5): LessonCardInput {
  return card(id, 'd1', 100, {
    state: State.Review,
    due: at(dueISO),
    stability,
    difficulty: 5,
    reps: 3,
    last_review: at('2026-10-10T12:00'),
  })
}

const DECKS = new Map([
  ['d1', 0],
  ['d2', 1],
])

describe('сборщик урока', () => {
  it('новые слова — по порядку добавления из всех колод (как узлы пути), до 5, каждое: знакомство + задание с оценкой', () => {
    // Колода d1 выше d2, но слово b1 из d2 добавлено раньше — оно и первое (решение владельца 2026-10-27).
    const cards = [
      card('a2', 'd1', 1, { createdAt: 200 }),
      card('b1', 'd2', 0, { createdAt: 100 }),
      card('a1', 'd1', 0, { createdAt: 200 }),
      ...['a3', 'a4', 'a5', 'a6'].map((id, i) => card(id, 'd1', i + 2, { createdAt: 300 })),
    ]
    const plan = buildLesson(cards, DECKS, NOW, LIMITS)
    expect(plan.newCount).toBe(5)
    expect(plan.tasks.map((t) => `${t.kind}:${t.cardId}`)).toEqual(
      // «Пары» — после 5-го слова, перед возвратами слов в обучении
      [...['b1', 'a1', 'a2', 'a3', 'a4'].flatMap((id) => [`intro:${id}`, `graded:${id}`]), 'pairs:'],
    )
  })

  it('урок узла — ровно слова этого узла пути, даже если они из разных колод', () => {
    const cards = [
      ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => card(id, 'd1', i, { createdAt: 100 })),
      card('v1', 'd2', 0, { createdAt: 200 }),
      card('a6', 'd1', 5, { createdAt: 300 }),
    ]
    const path = buildPath([{ id: 'd1', order: 0, archived: false }, { id: 'd2', order: 1, archived: false }], cards)
    const second = path.items[1]
    expect(second.kind === 'node' && second.cardIds).toEqual(['v1', 'a6'])
    const ids = nodeCardIds(cards, 1)
    const plan = buildLesson(cards, DECKS, NOW, LIMITS, { kind: 'node', cardIds: ids })
    expect(plan.tasks.filter((t) => t.kind === 'intro').map((t) => t.cardId)).toEqual(['v1', 'a6'])
  })

  it('дневной лимит новых: сегодня уже было 8 из 10 — в урок 2', () => {
    const cards = ['a1', 'a2', 'a3', 'a4'].map((id, i) => card(id, 'd1', i))
    expect(buildLesson(cards, DECKS, NOW, { ...LIMITS, newToday: 8 }).newCount).toBe(2)
    expect(buildLesson(cards, DECKS, NOW, { ...LIMITS, newToday: 10 }).newCount).toBe(0)
  })

  it('повторения — сначала, самые «забытые» первыми; новые — через каждые 2', () => {
    const cards = [
      review('r-fresh', '2026-10-18T10:00', 30),
      review('r-old', '2026-10-01T10:00', 2),
      review('r-mid', '2026-10-15T10:00', 5),
      card('n1', 'd1', 0),
    ]
    const plan = buildLesson(cards, DECKS, NOW, LIMITS)
    expect(plan.tasks.map((t) => `${t.kind}:${t.cardId}`)).toEqual([
      'graded:r-old',
      'graded:r-mid',
      'intro:n1',
      'graded:n1',
      'graded:r-fresh',
    ])
  })

  it('повторение на «завтра» доступно только с 04:00 своего дня', () => {
    const tomorrow = review('t', '2026-10-19T09:00')
    expect(buildLesson([tomorrow], DECKS, at('2026-10-18T23:30'), LIMITS).tasks).toEqual([])
    // В 01:30 ночи — всё ещё «вчера»
    expect(buildLesson([tomorrow], DECKS, at('2026-10-19T01:30'), LIMITS).tasks).toEqual([])
    // С 04:00 — уже пора, хотя точное время ещё не наступило
    expect(buildLesson([tomorrow], DECKS, at('2026-10-19T04:00'), LIMITS).tasks).toHaveLength(1)
  })

  it('слова в обучении — по точному времени с запасом 20 минут', () => {
    const soon = card('l1', 'd1', 0, { state: State.Learning, due: new Date(NOW.getTime() + 10 * 60_000), reps: 1 })
    const later = card('l2', 'd1', 1, { state: State.Learning, due: new Date(NOW.getTime() + 60 * 60_000), reps: 1 })
    expect(buildLesson([soon, later], DECKS, NOW, LIMITS).tasks.map((t) => t.cardId)).toEqual(['l1'])
  })

  it('много повторений — новые не влезают, урок не больше размера', () => {
    const cards = [...Array.from({ length: 20 }, (_, i) => review(`r${i}`, '2026-10-10T10:00')), card('n1', 'd1', 0)]
    const plan = buildLesson(cards, DECKS, NOW, LIMITS)
    expect(plan.tasks.filter((t) => t.kind !== 'pairs')).toHaveLength(15)
    // «Пары» — бонус, в счёт размера урока не входят
    expect(plan.tasks.filter((t) => t.kind === 'pairs')).toHaveLength(1)
    expect(plan.newCount).toBe(0)
  })

  it('лимит повторений в день', () => {
    const cards = Array.from({ length: 10 }, (_, i) => review(`r${i}`, '2026-10-10T10:00'))
    expect(buildLesson(cards, DECKS, NOW, { ...LIMITS, reviewLimit: 5, reviewsToday: 3 }).reviewCount).toBe(2)
  })

  it('замороженные, удалённые и слова удалённых колод — не берутся', () => {
    const cards = [
      card('s', 'd1', 0, { suspended: true }),
      card('x', 'd1', 1, { deletedAt: 1 }),
      card('gone', 'deleted-deck', 0),
      card('ok', 'd1', 2),
    ]
    expect(buildLesson(cards, DECKS, NOW, LIMITS).tasks.map((t) => t.cardId)).toEqual(['ok', 'ok'])
  })

  it('счётчики на сегодня', () => {
    const cards = [review('r1', '2026-10-17T10:00'), review('r2', '2026-10-20T10:00'), card('n1', 'd1', 0), card('n2', 'd1', 1)]
    expect(todayCounts(cards, DECKS, NOW, { ...LIMITS, newToday: 9 })).toEqual({ due: 1, dueNow: 1, newAvailable: 1 })
  })

  it('к сроку — повторения на сегодня и слова в обучении, чьё время уже пришло', () => {
    const cards = [
      review('r1', '2026-10-18T22:00'),
      card('l-now', 'd1', 0, { state: State.Learning, due: new Date(NOW.getTime() - 60_000), reps: 1 }),
      card('l-soon', 'd1', 1, { state: State.Learning, due: new Date(NOW.getTime() + 10 * 60_000), reps: 1 }),
    ]
    expect(todayCounts(cards, DECKS, NOW, LIMITS)).toMatchObject({ due: 3, dueNow: 2 })
    // Лимит повторений исчерпан — оставшиеся повторения новые не держат
    expect(todayCounts([cards[0]], DECKS, NOW, { ...LIMITS, reviewLimit: 5, reviewsToday: 5 }).dueNow).toBe(0)
  })
})

describe('урок узла и урок повторений (SPEC 7.1)', () => {
  const nodeWords = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => card(id, 'd1', i))
  const NODE = { kind: 'node' as const, cardIds: nodeWords.map((c) => c.id) }

  it('повторения сделаны — урок узла: его 5 новых слов', () => {
    const other = card('b1', 'd2', 0)
    const plan = buildLesson([other, ...nodeWords], DECKS, NOW, LIMITS, NODE)
    expect(plan.newCount).toBe(5)
    expect(plan.tasks.filter((t) => t.kind === 'intro').map((t) => t.cardId)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })

  it('пока есть повторения к сроку — новые слова узла не открываются', () => {
    const plan = buildLesson([review('r1', '2026-10-18T10:00'), ...nodeWords], DECKS, NOW, LIMITS, NODE)
    expect(plan.newCount).toBe(0)
    expect(plan.tasks.map((t) => t.cardId)).toEqual(['r1'])
  })

  it('слово в обучении, чьё время пришло, тоже держит новые; ещё не пришло — не держит', () => {
    const now = card('l', 'd2', 0, { state: State.Learning, due: new Date(NOW.getTime() - 60_000), reps: 1 })
    expect(buildLesson([now, ...nodeWords], DECKS, NOW, LIMITS, NODE).newCount).toBe(0)
    const soon = { ...now, due: new Date(NOW.getTime() + 10 * 60_000) }
    expect(buildLesson([soon, ...nodeWords], DECKS, NOW, LIMITS, NODE).newCount).toBe(5)
  })

  it('новые занимают урок первыми; повторения — на оставшееся место', () => {
    const soon = card('l', 'd2', 0, { state: State.Learning, due: new Date(NOW.getTime() + 10 * 60_000), reps: 1 })
    expect(buildLesson([soon, ...nodeWords], DECKS, NOW, LIMITS, NODE).reviewCount).toBe(0)
    const big = buildLesson([soon, ...nodeWords], DECKS, NOW, { ...LIMITS, size: 20 }, NODE)
    expect([big.newCount, big.reviewCount]).toEqual([5, 1])
    // Порядок: сначала все новые слова узла, повторение — после них
    expect(big.tasks.filter((t) => t.kind !== 'pairs').map((t) => t.cardId).at(-1)).toBe('l')
    expect(big.tasks[0]).toEqual({ kind: 'intro', cardId: 'a1' })
  })

  it('дневной лимит новых — узел даёт сколько можно', () => {
    expect(buildLesson(nodeWords, DECKS, NOW, { ...LIMITS, newToday: 8 }, NODE).newCount).toBe(2)
    expect(buildLesson(nodeWords, DECKS, NOW, { ...LIMITS, newToday: 10 }, NODE).newCount).toBe(0)
  })

  it('урок повторений — без новых слов', () => {
    const plan = buildLesson([review('r1', '2026-10-18T10:00'), ...nodeWords], DECKS, NOW, LIMITS, { kind: 'review' })
    expect(plan.newCount).toBe(0)
    expect(plan.reviewCount).toBe(1)
  })

  it('урок повторения на пути — не больше размера урока; остальные — в следующем уроке повторения', () => {
    const due = Array.from({ length: 20 }, (_, i) => review(`r${i}`, '2026-10-18T10:00'))
    const plan = buildLesson(due, DECKS, NOW, LIMITS, { kind: 'review' })
    expect(plan.reviewCount).toBe(15)
    // Повторил 15 — осталось 5: путь снова покажет урок повторения.
    const left = due.map((c) => (plan.tasks.some((t) => t.cardId === c.id) ? { ...c, due: at('2026-10-25T10:00') } : c))
    expect(todayCounts(left, DECKS, NOW, LIMITS).dueNow).toBe(5)
  })
})

describe('ход урока', () => {
  const plan = { tasks: [{ kind: 'intro' as const, cardId: 'a' }, { kind: 'graded' as const, cardId: 'a' }, { kind: 'graded' as const, cardId: 'b' }], newCount: 1, reviewCount: 1 }
  const inMin = (m: number) => new Date(NOW.getTime() + m * 60_000)

  it('ошибка или шаг обучения (≤ 20 мин) — слово в конец урока', () => {
    let s = startLesson(plan)
    s = afterIntro(s)
    s = afterGrade(s, 'a', Rating.Again, inMin(1), NOW)
    expect(s.queue.at(-1)).toEqual({ kind: 'graded', cardId: 'a' })
    expect(currentTask(s)).toEqual({ kind: 'graded', cardId: 'b' })
    s = afterGrade(s, 'b', Rating.Good, inMin(60 * 24 * 3), NOW)
    expect(currentTask(s)).toEqual({ kind: 'graded', cardId: 'a' })
    s = afterGrade(s, 'a', Rating.Good, inMin(60 * 24), NOW)
    expect(isFinished(s)).toBe(true)
    expect([s.correct, s.wrong, accuracy(s)]).toEqual([2, 1, 67])
  })

  it(`слово возвращается не больше ${MAX_RETURNS} раз`, () => {
    let s = startLesson({ tasks: [{ kind: 'graded', cardId: 'a' }], newCount: 0, reviewCount: 1 })
    for (let i = 0; i < 10 && !isFinished(s); i++) s = afterGrade(s, 'a', Rating.Again, inMin(1), NOW)
    expect(s.queue).toHaveLength(1 + MAX_RETURNS)
    expect(isFinished(s)).toBe(true)
  })

  it('прошлое состояние не меняется (на нём держится «Отменить оценку»)', () => {
    const s0 = startLesson(plan)
    const s1 = afterGrade(afterIntro(s0), 'a', Rating.Again, inMin(1), NOW)
    expect(s0.queue).toHaveLength(3)
    expect(s0.index).toBe(0)
    expect(s1.queue).toHaveLength(4)
  })
})
