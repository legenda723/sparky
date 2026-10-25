import 'fake-indexeddb/auto'
import { Rating, State } from 'ts-fsrs'
import { afterEach, describe, expect, it } from 'vitest'
import { outcomes } from '../srs/scheduler'
import { addCards } from './cards'
import { SparkyDb } from './db'
import { createDeck } from './decks'
import { addExtraNew, claimPlanScreen, ensureQuests, finishLesson, moreNewWords, planStatus, settleDay } from './game'
import { loadLessonInput, saveAnswer, undoAnswer } from './review'
import { DEFAULT_PROFILE } from './types'

let n = 0
const opened: SparkyDb[] = []
function freshDb(): SparkyDb {
  const d = new SparkyDb(`game-${++n}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

const T = new Date('2026-10-25T15:00')

async function setup(words = 8) {
  const db = freshDb()
  const deck = await createDeck(db, { title: 'Еда', emoji: '🍎', color: 'green' })
  const cards = await addCards(db, deck.id, Array.from({ length: words }, (_, i) => ({ front: `w${i}`, back: `с${i}` })))
  return { db, cards }
}

describe('задания дня в базе', () => {
  it('выбираются один раз за день; ответ двигает прогресс в той же записи, отмена — назад', async () => {
    const { db, cards } = await setup()
    const q1 = await ensureQuests(db, T)
    expect(q1).toHaveLength(3)
    expect(await ensureQuests(db, T)).toEqual(q1)
    // Подменим задания на известные — проверить прогресс XP и серии.
    await db.quests.put({
      dayKey: '2026-10-25',
      chestClaimed: false,
      quests: [
        { kind: 'xp', target: 4, progress: 0, done: false },
        { kind: 'combo', target: 5, progress: 0, done: false },
        { kind: 'reviews', target: 5, progress: 0, done: false },
      ],
    })
    const c = cards[0]
    const o = outcomes(c, T, 0.9)[Rating.Good]
    const token = await saveAnswer(db, { before: c, grade: Rating.Good, outcome: o, exerciseType: 'choice-en-ru', durationMs: 1000, xp: 5, combo: 3 })
    let q = (await db.quests.get('2026-10-25'))!.quests
    expect(q.map((x) => [x.progress, x.done])).toEqual([
      [4, true],
      [3, false],
      [1, false],
    ])
    expect((await db.days.get('2026-10-25'))!.goalMet).toBe(false)
    await undoAnswer(db, token)
    q = (await db.quests.get('2026-10-25'))!.quests
    expect(q.map((x) => x.progress)).toEqual([0, 0, 0])
    expect((await db.days.get('2026-10-25'))!.bestCombo).toBe(0)
  })

  it('цель дня отмечается в итогах дня', async () => {
    const { db, cards } = await setup()
    const c = cards[0]
    const o = outcomes(c, T, 0.9)[Rating.Good]
    await saveAnswer(db, { before: c, grade: Rating.Good, outcome: o, exerciseType: 'type', durationMs: 1000, xp: 60 })
    expect((await db.days.get('2026-10-25'))!.goalMet).toBe(true)
  })
})

describe('конец урока', () => {
  it('первый урок за день засчитывает стрик, второй — нет; уроки без ошибок копятся', async () => {
    const { db } = await setup()
    const a = await finishLesson(db, T, { xp: 15, perfect: true })
    expect(a.streak?.counted).toBe(true)
    expect(a.streak?.state.streak).toBe(1)
    const b = await finishLesson(db, new Date('2026-10-26T01:30'), { xp: 10 })
    expect(b.streak?.counted).toBe(false)
    const day = await db.days.get('2026-10-25')
    expect(day).toMatchObject({ lessons: 2, perfectLessons: 1, streakDay: true, xp: 25 })
    expect(await db.profile.get('me')).toMatchObject({ streak: 1, lastStreakDay: '2026-10-25', totalXp: 25 })
  })

  it('новый уровень и достижения — раз и навсегда', async () => {
    const { db, cards } = await setup()
    await db.cards.update(cards[0].id, { state: State.Review, stability: 3 })
    await db.profile.put({ ...DEFAULT_PROFILE, totalXp: 120 })
    const r = await finishLesson(db, T, { xp: 10 })
    expect([r.levelBefore, r.levelAfter]).toEqual([1, 2])
    expect(r.achievements.map((x) => x.id)).toEqual(['first-word', 'first-lesson'])
    const again = await finishLesson(db, T, { xp: 10 })
    expect([again.levelBefore, again.levelAfter]).toEqual([2, 2])
    expect(again.achievements).toEqual([])
    expect((await db.profile.get('me'))!.achievements).toEqual(['first-word', 'first-lesson'])
  })

  it('тренировка, которая день не засчитывает, стрик не трогает', async () => {
    const { db } = await setup()
    const r = await finishLesson(db, T, { xp: 5, countsStreak: false })
    expect(r.streak).toBeUndefined()
    expect((await db.profile.get('me'))?.streak ?? 0).toBe(0)
  })
})

describe('стрик при открытии', () => {
  it('пропущенный день закрывает заморозка — отметка в итогах дня', async () => {
    const db = freshDb()
    await db.profile.put({ ...DEFAULT_PROFILE, streak: 8, bestStreak: 8, lastStreakDay: '2026-10-23', freezes: 1 })
    expect(await settleDay(db, T)).toEqual({ frozen: ['2026-10-24'], lost: false })
    expect(await db.profile.get('me')).toMatchObject({ streak: 8, freezes: 0, lastStreakDay: '2026-10-24' })
    expect((await db.days.get('2026-10-24'))!.freezeUsed).toBe(true)
    // Повторное открытие в тот же день ничего не тратит.
    expect(await settleDay(db, T)).toEqual({ frozen: [], lost: false })
  })

  it('без заморозок стрик сгорает', async () => {
    const db = freshDb()
    await db.profile.put({ ...DEFAULT_PROFILE, streak: 8, bestStreak: 8, lastStreakDay: '2026-10-22', freezes: 1 })
    expect(await settleDay(db, T)).toEqual({ frozen: [], lost: true })
    expect(await db.profile.get('me')).toMatchObject({ streak: 0, bestStreak: 8, freezes: 1 })
  })

  it('первое открытие после обновления — стрик по прошлым урокам', async () => {
    const db = freshDb()
    for (const key of ['2026-10-22', '2026-10-23', '2026-10-24']) {
      await db.days.put({ dayKey: key, xp: 20, lessons: 1, reviews: 5, newLearned: 0, correct: 5, wrong: 0, msSpent: 60_000, goalMet: false, freezeUsed: false })
    }
    await settleDay(db, T)
    expect(await db.profile.get('me')).toMatchObject({ streak: 3, bestStreak: 3, lastStreakDay: '2026-10-24' })
    expect((await db.days.get('2026-10-22'))!.streakDay).toBe(true)
    const r = await finishLesson(db, T, { xp: 10 })
    expect(r.streak?.state.streak).toBe(4)
  })
})

describe('«Выучить ещё 5 новых слов»', () => {
  it('поднимает лимит новых только на сегодня', async () => {
    const { db } = await setup()
    expect((await loadLessonInput(db, T)).limits.newPerDay).toBe(10)
    await addExtraNew(db, T)
    expect((await loadLessonInput(db, T)).limits.newPerDay).toBe(15)
    expect((await loadLessonInput(db, new Date('2026-10-26T15:00'))).limits.newPerDay).toBe(10)
  })
})

describe('«План на сегодня выполнен» (6.5)', () => {
  it('выполнен, когда повторять нечего и новые на сегодня кончились; экран — раз в день', async () => {
    const { db, cards } = await setup(12)
    expect((await planStatus(db, T)).done).toBe(false)
    // Сегодня уже познакомились с 10 словами (лимит), остальные новые ждут.
    for (const c of cards.slice(0, 10)) {
      await db.cards.update(c.id, { state: State.Review, stability: 5, due: new Date('2026-10-30T10:00'), introducedAt: T.getTime() - 1000 })
    }
    const st = await planStatus(db, T)
    expect(st).toMatchObject({ done: true, freshLeft: 2, known: 10 })
    expect(st.extraEstimate).toBeGreaterThan(0)
    expect(await claimPlanScreen(db, T)).not.toBeNull()
    expect(await claimPlanScreen(db, T)).toBeNull()
  })

  it('«Ещё 5 новых слов» поднимает лимит и ведёт в урок текущего узла', async () => {
    const { db, cards } = await setup(12)
    for (const c of cards.slice(0, 10)) {
      await db.cards.update(c.id, { state: State.Review, stability: 5, due: new Date('2026-10-30T10:00'), introducedAt: T.getTime() - 1000 })
    }
    const target = await moreNewWords(db, T)
    expect(target).toMatchObject({ kind: 'node', index: 2 })
    expect((await planStatus(db, T)).done).toBe(false)
  })
})

