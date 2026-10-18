import { createEmptyCard, Rating, State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { answerXp, lessonXp, practiceXp } from '../game/xp'
import {
  checkTyped,
  exerciseCandidates,
  normalizeTyped,
  pickExercise,
  pickOptions,
  typingHint,
  type ExerciseCard,
  type PoolCard,
  type Rng,
} from './exercise'
import { gradeAuto, isChoice, type ExerciseType } from './grade'
import {
  afterGrade,
  afterIntro,
  afterPractice,
  buildLesson,
  currentTask,
  isFinished,
  isNewWordBonus,
  prepareCurrent,
  startLesson,
  type LessonCardInput,
  type LessonState,
  type PrepareContext,
} from './lesson'
import { outcomes } from './scheduler'

/** Повторяемая «случайность» для тестов. */
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOW = new Date('2026-10-18T15:00')

function excard(state: State, stability = 0, imageId?: string): ExerciseCard {
  return { ...createEmptyCard(NOW), id: 'x', state, stability, imageId }
}

const WORDS: [string, string][] = [
  ['apple', 'яблоко'],
  ['house', 'дом'],
  ['water', 'вода'],
  ['cat', 'кошка'],
  ['dog', 'собака'],
  ['window', 'окно'],
  ['bread', 'хлеб'],
  ['table', 'стол'],
]

function pool(n = WORDS.length, deckId = 'd1'): PoolCard[] {
  return WORDS.slice(0, n).map(([front, back], i) => ({ id: `w${i}`, deckId, front, back, introduced: true }))
}

describe('задание по состоянию слова (6.3)', () => {
  it('новое — выбор EN→RU', () => {
    expect(exerciseCandidates(excard(State.New))).toEqual(['choice-en-ru'])
  })
  it('в обучении и переобучении — только выбор; картинка — если есть фото', () => {
    expect(exerciseCandidates(excard(State.Learning))).toEqual(['choice-en-ru', 'choice-ru-en', 'listen'])
    expect(exerciseCandidates(excard(State.Relearning, 1, 'img'))).toEqual(['choice-en-ru', 'choice-ru-en', 'listen', 'picture'])
  })
  it('повторение < 7 дней — переворот и ввод; ≥ 7 дней — ещё аудирование с вводом', () => {
    expect(exerciseCandidates(excard(State.Review, 3))).toEqual(['flip', 'type'])
    expect(exerciseCandidates(excard(State.Review, 7, 'img'))).toEqual(['type', 'listen-type', 'flip'])
  })
  it('слова-созвучия (their / there) — без аудирования', () => {
    expect(exerciseCandidates({ ...excard(State.Learning), front: 'their' })).toEqual(['choice-en-ru', 'choice-ru-en'])
    expect(exerciseCandidates({ ...excard(State.Review, 10), front: 'There' })).toEqual(['type', 'flip'])
    expect(exerciseCandidates({ ...excard(State.Review, 10), front: 'they’re' })).toEqual(['type', 'flip'])
    expect(exerciseCandidates({ ...excard(State.Review, 10), front: 'the sun' })).toEqual(['type', 'flip'])
    // обычное слово — как раньше
    expect(exerciseCandidates({ ...excard(State.Review, 10), front: 'window' })).toEqual(['type', 'listen-type', 'flip'])
  })

  it('their / there в уроке не попадают в аудирование — ни заданием, ни вариантом', () => {
    const words: [string, string][] = [['their', 'их'], ['there', 'там'], ['cat', 'кошка'], ['dog', 'собака'], ['house', 'дом'], ['water', 'вода'], ['bread', 'хлеб']]
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const rng = seeded(seed)
      const learning = (i: number) => ({ ...createEmptyCard(NOW), state: State.Learning, stability: 0.5, difficulty: 5, reps: 1, id: `h${i}`, front: words[i][0] })
      const p: PoolCard[] = words.map(([front, back], i) => ({ id: `h${i}`, deckId: 'd1', front, back, introduced: true }))
      for (const i of words.keys()) {
        const r = pickExercise(learning(i), p, undefined, rng)
        if (r.exercise === 'listen') {
          expect(i).toBeGreaterThan(1)
          expect(r.options).not.toContain('h0')
          expect(r.options).not.toContain('h1')
        }
      }
    }
  })

  it('в повторениях никогда не выпадает выбор — даже с фото и при любой случайности', () => {
    const rng = seeded(1)
    for (let i = 0; i < 300; i++) {
      const c = { ...excard(State.Review, rng() * 40, 'img'), id: 'w0' }
      expect(isChoice(pickExercise(c, pool(), undefined, rng).exercise)).toBe(false)
    }
  })
  it('то же задание два раза подряд не ставится, если есть другое', () => {
    const rng = seeded(2)
    for (let i = 0; i < 50; i++) {
      const c = { ...excard(State.Review, 3), id: 'w0' }
      expect(pickExercise(c, pool(), 'type', rng).exercise).toBe('flip')
    }
  })
  it('слов меньше 4 — вместо выбора переворот', () => {
    const c = { ...excard(State.Learning), id: 'w0' }
    expect(pickExercise(c, pool(3), undefined, seeded(3))).toEqual({ exercise: 'flip' })
  })
})

describe('варианты для выбора', () => {
  it('4 разных варианта, среди них правильный', () => {
    const p = pool()
    const opts = pickOptions(p[0], p, 'back', seeded(4))!
    expect(opts).toHaveLength(4)
    expect(new Set(opts).size).toBe(4)
    expect(opts).toContain('w0')
  })
  it('сначала — из той же колоды и знакомые слова', () => {
    const p = [...pool(4, 'd1'), ...pool(8, 'd2').slice(4).map((c) => ({ ...c, id: `o${c.id}` }))]
    // другая колода — запасной вариант
    for (let i = 0; i < 20; i++) expect(pickOptions(p[0], p, 'back', seeded(i))!.every((id) => !id.startsWith('o'))).toBe(true)
    const unseen = pool().map((c, i) => (i > 0 && i < 4 ? { ...c, introduced: false } : c))
    for (let i = 0; i < 20; i++) expect(pickOptions(unseen[0], unseen, 'back', seeded(i))).not.toContain('w1')
  })
  it('синонимы (тот же перевод или то же слово) не берутся — они тоже были бы верными', () => {
    const p = [...pool(5), { id: 'syn', deckId: 'd1', front: 'home', back: 'Дом', introduced: true }]
    for (let i = 0; i < 20; i++) {
      expect(pickOptions(p[1], p, 'front', seeded(i))).not.toContain('syn')
    }
  })
  it('не хватает разных вариантов — null', () => {
    const p = pool(3)
    expect(pickOptions(p[0], p, 'back', seeded(5))).toBeNull()
  })
})

describe('проверка ввода', () => {
  it('регистр, пробелы, артикли и точка не важны', () => {
    expect(checkTyped('  The Apple. ', 'apple')).toBe('correct')
    expect(checkTyped('an apple', 'apple')).toBe('correct')
    expect(checkTyped('apple', 'an apple')).toBe('correct')
    expect(checkTyped('ice  cream', 'ice cream')).toBe('correct')
    expect(checkTyped('don’t', "don't")).toBe('correct')
  })
  it('одна опечатка в слове от 5 букв — «опечатка»', () => {
    expect(checkTyped('aple', 'apple')).toBe('typo')
    expect(checkTyped('housse', 'house')).toBe('typo')
    expect(checkTyped('hause', 'house')).toBe('typo')
  })
  it('в коротком слове опечатка — ошибка; две опечатки — ошибка', () => {
    expect(checkTyped('dag', 'dog')).toBe('wrong')
    expect(checkTyped('hhousse', 'house')).toBe('wrong')
    expect(checkTyped('', 'house')).toBe('wrong')
  })
  it('варианты через «/» — подходит любой', () => {
    expect(checkTyped('colour', 'color / colour')).toBe('correct')
    expect(checkTyped('color', 'color / colour')).toBe('correct')
  })
  it('подсказка — первая буква без артикля', () => {
    expect(typingHint('the window')).toBe('w')
    expect(normalizeTyped('A Cat!')).toBe('cat')
  })
})

describe('правила оценок для новых заданий (6.4)', () => {
  it('аудирование с вводом — как ввод: опечатка или дольше 20 с → Трудно', () => {
    expect(gradeAuto({ type: 'listen-type', correct: true, typo: true, durationMs: 1000 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'listen-type', correct: true, durationMs: 15_000 })).toBe(Rating.Good)
    expect(gradeAuto({ type: 'listen-type', correct: true, durationMs: 20_001 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'listen-type', correct: false, durationMs: 1000 })).toBe(Rating.Again)
  })
  it('картинка и аудирование с выбором — как выбор: дольше 12 с → Трудно', () => {
    expect(gradeAuto({ type: 'picture', correct: true, durationMs: 12_001 })).toBe(Rating.Hard)
    expect(gradeAuto({ type: 'listen', correct: true, durationMs: 11_000 })).toBe(Rating.Good)
    expect(gradeAuto({ type: 'type', correct: true, hinted: true, durationMs: 1000 })).toBe(Rating.Hard)
  })
})

describe('XP (8.1)', () => {
  it('верно +2, новое слово +3, серия 5+ — +1; ошибка — 0', () => {
    expect(answerXp({ correct: true, newWord: false, streak: 1 })).toBe(2)
    expect(answerXp({ correct: true, newWord: true, streak: 1 })).toBe(5)
    expect(answerXp({ correct: true, newWord: false, streak: 5 })).toBe(3)
    expect(answerXp({ correct: false, newWord: true, streak: 0 })).toBe(0)
  })
  it('тренировка — половина; урок +10, идеальный — ещё +5', () => {
    expect(practiceXp(true)).toBe(1)
    expect(practiceXp(false)).toBe(0)
    expect(lessonXp(0, 12)).toBe(15)
    expect(lessonXp(1, 12)).toBe(10)
  })
})

// --- Целый урок ---

const DECKS = new Map([['d1', 0]])
const LIMITS = { size: 15, newPerDay: 10, newToday: 0, reviewLimit: 0, reviewsToday: 0, retention: 0.9 }

function lessonCard(i: number, patch: Partial<LessonCardInput> = {}): LessonCardInput & { front: string; back: string } {
  const [front, back] = WORDS[i % WORDS.length]
  return { ...createEmptyCard(new Date('2026-10-01T12:00')), id: `c${i}`, deckId: 'd1', order: i, suspended: false, front: `${front}${i}`, back: `${back}${i}`, ...patch }
}

function reviewCard(i: number, stability: number) {
  return lessonCard(i, { state: State.Review, due: new Date('2026-10-17T10:00'), stability, difficulty: 5, reps: 4, last_review: new Date('2026-10-10T12:00') })
}

/** Проходит урок: ответ по каждому заданию через настоящий планировщик. answer(task) → верно ли. */
function play(cards: ReturnType<typeof lessonCard>[], answer: (state: LessonState) => boolean, seed = 7) {
  const rng = seeded(seed)
  const map = new Map(cards.map((c) => [c.id, c as ExerciseCard & LessonCardInput]))
  const ctxPool: PoolCard[] = cards.map((c) => ({ id: c.id, deckId: c.deckId, front: c.front, back: c.back, introduced: c.state !== State.New }))
  const ctx = (): PrepareContext => ({ cards: map, pool: ctxPool, rng })
  let s = prepareCurrent(startLesson(buildLesson(cards, DECKS, NOW, LIMITS)), ctx())
  const shown: { kind: string; exercise?: ExerciseType; cardId: string; stateBefore?: State }[] = []
  let t = NOW.getTime()
  for (let guard = 0; guard < 100 && !isFinished(s); guard++) {
    const task = currentTask(s)!
    const card = map.get(task.cardId)
    shown.push({ kind: task.kind, exercise: task.exercise, cardId: task.cardId, stateBefore: card?.state })
    t += 10_000
    if (task.kind === 'intro') s = afterIntro(s, task.cardId)
    else if (task.kind === 'pairs' || task.kind === 'easy') s = afterPractice(s, 1, task.kind === 'easy' ? true : undefined)
    else {
      const ok = answer(s)
      const at = new Date(t)
      const g = ok ? Rating.Good : Rating.Again
      const o = outcomes(card!, at, 0.9)[g]
      map.set(card!.id, { ...card!, ...o.card })
      s = afterGrade(s, card!.id, g, o.card.due, at)
    }
    s = prepareCurrent(s, ctx())
  }
  return { s, shown }
}

describe('целый урок', () => {
  const mixed = () => [
    ...[0, 1, 2, 3].map((i) => reviewCard(i, 3)),
    ...[4, 5, 6, 7].map((i) => reviewCard(i, 20)),
    lessonCard(8, { state: State.Learning, due: new Date('2026-10-18T14:55'), stability: 0.5, difficulty: 5, reps: 1, last_review: new Date('2026-10-18T14:45') }),
    ...[9, 10, 11, 12].map((i) => lessonCard(i)),
  ]

  it('урок из 15 заданий разнообразный: не меньше 4 разных заданий и есть «Пары»', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { shown } = play(mixed(), () => true, seed)
      const kinds = new Set(shown.filter((x) => x.kind === 'graded').map((x) => x.exercise))
      expect(kinds.size).toBeGreaterThanOrEqual(4)
      expect(shown.some((x) => x.kind === 'pairs')).toBe(true)
    }
  })

  it('слово в повторениях никогда не получает выбор с оценкой FSRS', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { shown } = play(mixed(), (s) => s.index % 3 !== 0, seed)
      for (const x of shown.filter((x) => x.kind === 'graded' && x.stateBefore === State.Review)) {
        expect(isChoice(x.exercise)).toBe(false)
      }
    }
  })

  it('новое слово: знакомство, затем выбор EN→RU', () => {
    const { shown } = play(mixed(), () => true)
    const i = shown.findIndex((x) => x.kind === 'intro')
    expect(shown[i + 1]).toMatchObject({ kind: 'graded', exercise: 'choice-en-ru', cardId: shown[i].cardId })
  })

  it('урок закончился ошибкой — в конце лёгкий выбор по слову из этого урока, без оценки', () => {
    const cards = [0, 1, 2, 3, 4].map((i) => reviewCard(i, 3))
    // Всё верно, кроме последнего возврата: ошибаемся на c0 всегда
    const { s, shown } = play(cards, (st) => currentTask(st)!.cardId !== 'c0')
    const last = shown.at(-1)!
    expect(last.kind).toBe('easy')
    expect(last.exercise).toBe('choice-en-ru')
    expect(last.cardId).not.toBe('c0')
    const before = shown.slice(0, -1).map((x) => x.cardId)
    expect(before).toContain(last.cardId)
    expect(s.easyCount).toBe(1)
  })

  it('урок закончился верным выбором — лёгкое задание не добавляется', () => {
    const cards = [0, 1, 2, 3].map((i) => lessonCard(i, { state: State.Learning, due: new Date('2026-10-18T14:55'), stability: 0.5, difficulty: 5, reps: 1, last_review: new Date('2026-10-18T14:45') }))
    const { shown } = play(cards, () => true)
    expect(shown.some((x) => x.kind === 'easy')).toBe(false)
    expect(isChoice(shown.at(-1)!.exercise)).toBe(true)
  })

  it('«Пары» — из 5 разных слов, которые уже были в уроке', () => {
    const rng = seeded(9)
    const cards = mixed()
    const map = new Map(cards.map((c) => [c.id, c as ExerciseCard]))
    const ctxPool = cards.map((c) => ({ id: c.id, deckId: c.deckId, front: c.front, back: c.back, introduced: true }))
    let s = startLesson(buildLesson(cards, DECKS, NOW, LIMITS))
    const pairsAt = s.queue.findIndex((t) => t.kind === 'pairs')
    expect(pairsAt).toBeGreaterThan(0)
    s = { ...s, index: pairsAt }
    s = prepareCurrent(s, { cards: map, pool: ctxPool, rng })
    const task = currentTask(s)!
    expect(task.pairIds).toHaveLength(5)
    const before = new Set(s.queue.slice(0, pairsAt).map((t) => t.cardId))
    for (const id of task.pairIds!) expect(before.has(id)).toBe(true)
  })

  it('подготовленное задание не меняется при повторной подготовке (после «Отменить» — то же)', () => {
    const cards = mixed()
    const map = new Map(cards.map((c) => [c.id, c as ExerciseCard]))
    const ctxPool = cards.map((c) => ({ id: c.id, deckId: c.deckId, front: c.front, back: c.back, introduced: true }))
    const s1 = prepareCurrent(startLesson(buildLesson(cards, DECKS, NOW, LIMITS)), { cards: map, pool: ctxPool, rng: seeded(1) })
    const s2 = prepareCurrent(s1, { cards: map, pool: ctxPool, rng: seeded(99) })
    expect(currentTask(s2)).toBe(currentTask(s1))
  })

  it('ошибка в лёгком задании — ещё одно лёгкое по другому слову, но не больше двух', () => {
    const cards = mixed()
    const map = new Map(cards.map((c) => [c.id, c as ExerciseCard]))
    const ctxPool = cards.map((c) => ({ id: c.id, deckId: c.deckId, front: c.front, back: c.back, introduced: true }))
    const ctx = { cards: map, pool: ctxPool, rng: seeded(3) }
    const far = new Date(NOW.getTime() + 86400_000 * 3)
    let s = startLesson({ tasks: ['c0', 'c1', 'c2'].map((cardId) => ({ kind: 'graded' as const, cardId, exercise: 'flip' as const })), newCount: 0, reviewCount: 3 })
    for (const id of ['c0', 'c1', 'c2']) s = prepareCurrent(afterGrade(s, id, Rating.Good, far, NOW), ctx)
    // Закончили переворотом — первое лёгкое задание
    expect(currentTask(s)?.kind).toBe('easy')
    const first = currentTask(s)!.cardId
    s = prepareCurrent(afterPractice(s, 0, false), ctx)
    expect(currentTask(s)?.kind).toBe('easy')
    expect(currentTask(s)!.cardId).not.toBe(first)
    s = prepareCurrent(afterPractice(s, 0, false), ctx)
    expect(isFinished(s)).toBe(true)
  })

  it('бонус «новое слово выучено» — за первый верный ответ после знакомства, даже после ошибки', () => {
    let s = startLesson({ tasks: [{ kind: 'intro', cardId: 'n' }, { kind: 'graded', cardId: 'n' }], newCount: 1, reviewCount: 0 })
    expect(isNewWordBonus(s, 'n')).toBe(false)
    s = afterIntro(s, 'n')
    expect(isNewWordBonus(s, 'n')).toBe(true)
    s = afterGrade(s, 'n', Rating.Again, new Date(NOW.getTime() + 60_000), NOW)
    expect(isNewWordBonus(s, 'n')).toBe(true)
    s = afterGrade(s, 'n', Rating.Good, new Date(NOW.getTime() + 600_000), NOW)
    expect(isNewWordBonus(s, 'n')).toBe(false)
  })

  it('серия верных и XP копятся в состоянии урока, ошибка обнуляет серию', () => {
    let s = startLesson({ tasks: [0, 1, 2].map((i) => ({ kind: 'graded' as const, cardId: `c${i}` })), newCount: 0, reviewCount: 3 })
    const far = new Date(NOW.getTime() + 86400_000 * 3)
    s = afterGrade(s, 'c0', Rating.Good, far, NOW, 2)
    s = afterGrade(s, 'c1', Rating.Good, far, NOW, 2)
    expect([s.streak, s.xp]).toEqual([2, 4])
    s = afterGrade(s, 'c2', Rating.Again, far, NOW, 0)
    expect([s.streak, s.bestStreak, s.xp]).toEqual([0, 2, 4])
  })
})
