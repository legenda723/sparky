// Ход урока на экране: очередь заданий, сохранение каждого ответа сразу, плашка ответа и «Отменить оценку».
import { useCallback, useEffect, useRef, useState } from 'react'
import { State } from 'ts-fsrs'
import { navigate } from '../app/routes'
import { setUpdateBlocked } from '../app/updates'
import { db } from '../db/db'
import { feedback } from '../feedback/feedback'
import {
  finishLesson,
  loadLessonInput,
  markIntroduced,
  saveAnswer,
  savePractice,
  undoAnswer,
  type UndoToken,
} from '../db/review'
import type { Card, Settings } from '../db/types'
import { answerXp, lessonXp, practiceXp, XP } from '../game/xp'
import { stopSpeech } from '../media/speech'
import { now } from '../srs/clock'
import type { PoolCard } from '../srs/exercise'
import { gradeAuto, isCorrect, type AutoAnswer, type ExerciseType } from '../srs/grade'
import {
  afterGrade,
  afterIntro,
  afterPractice,
  buildLesson,
  currentTask,
  isFinished,
  prepareCurrent,
  startLesson,
  type LessonState,
  type TaskKind,
} from '../srs/lesson'
import { outcomes, Rating, type Grade, type Outcome } from '../srs/scheduler'
import { useToast } from '../ui/Toast'

/** Реакция на оценку переворота: «later» — «Снова», но слово уже возвращалось 3 раза и придёт в следующем уроке. */
export interface Reaction {
  kind: 'correct' | 'hard' | 'again' | 'later' | 'undo'
  id: number
}

interface Loaded {
  /** Слова урока (свежие — после каждого ответа). */
  cards: Map<string, Card>
  audio: Map<string, Blob>
  settings: Settings
  /** Все живые слова — для вариантов выбора. */
  pool: PoolCard[]
  poolById: Map<string, PoolCard>
}

/** Ответ проверен, плашка показана; урок идёт дальше по «ДАЛЕЕ». */
export interface Checked {
  correct: boolean
  typo?: boolean
  cardId: string
  exercise: ExerciseType
  /** «Пары»: время. */
  ms?: number
  /** Состояние урока после ответа (уже сохранено). */
  next: LessonState
}

export interface LessonApi {
  loaded: Loaded | null
  state: LessonState | null
  /** Проверенный ответ, ждущий «ДАЛЕЕ». */
  checked: Checked | null
  /** Можно отменить последнюю оценку. */
  canUndo: boolean
  reaction: Reaction | null
  /** Время урока от начала до конца, мс. */
  elapsedMs: number
  /** XP за урок вместе с бонусом за завершение (для итога). */
  totalXp: number
  /** Сколько раз отменяли оценку: часть ключа задания, чтобы вернувшееся задание было новым, а не гаснущим. */
  undoCount: number
  introDone: (cardId: string, durationMs: number) => void
  /** Переворот: оценка владельца, без плашки. */
  gradeFlip: (cardId: string, grade: Grade, outcome: Outcome<Card>, durationMs: number) => void
  /** Выбор и ввод: оценка по правилам 6.4 (или тренировка, если это лёгкое задание). */
  check: (cardId: string, answer: AutoAnswer) => void
  /** «Пары» собраны. */
  pairsDone: (durationMs: number) => void
  /** «ДАЛЕЕ» на плашке. */
  next: () => void
  undo: () => void
}

interface UndoSnapshot {
  state: LessonState
  token: UndoToken
}

export function useLesson(): LessonApi {
  const toast = useToast()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [state, setState] = useState<LessonState | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [undoSnap, setUndoSnap] = useState<UndoSnapshot | null>(null)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [undoCount, setUndoCount] = useState(0)
  const startedAt = useRef(Date.now())
  // Записи в базу идут строго по очереди: быстрые касания не обгоняют друг друга.
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const reactionId = useRef(0)
  // Номер последнего действия: отмена предлагается только для самой последней оценки.
  const actionSeq = useRef(0)
  // Отмена для проверенного ответа — становится доступной после «ДАЛЕЕ».
  const pendingUndo = useRef<{ prev: LessonState; token: Promise<UndoToken | undefined> } | null>(null)
  // Свежее состояние для обработчиков касаний: гаснущее задание держит старые обработчики,
  // и касание по нему не должно откатить урок назад.
  const live = useRef<{ state: LessonState | null; loaded: Loaded | null; checked: Checked | null }>({
    state: null,
    loaded: null,
    checked: null,
  })

  const prepare = (s: LessonState, l: Loaded) => prepareCurrent(s, { cards: l.cards, pool: l.pool, rng: Math.random })

  const commit = (nextState: LessonState, nextLoaded?: Loaded) => {
    live.current = { ...live.current, state: nextState, loaded: nextLoaded ?? live.current.loaded, checked: null }
    setState(nextState)
    setChecked(null)
    if (nextLoaded) setLoaded(nextLoaded)
  }

  const showChecked = (c: Checked, nextLoaded?: Loaded) => {
    live.current = { ...live.current, loaded: nextLoaded ?? live.current.loaded, checked: c }
    setChecked(c)
    if (nextLoaded) setLoaded(nextLoaded)
  }

  /** Касание относится к заданию, которое сейчас на экране, и ответ ещё не проверен. */
  const isCurrent = (kinds: TaskKind[], cardId: string) => {
    const { state: s, checked: c } = live.current
    const task = s ? currentTask(s) : undefined
    return !c && task !== undefined && kinds.includes(task.kind) && task.cardId === cardId
  }

  const enqueue = useCallback(
    <T>(job: () => Promise<T>): Promise<T | undefined> => {
      const p = chain.current.then(job).catch(() => {
        toast({ message: 'Не получилось сохранить ответ' })
        return undefined
      })
      chain.current = p
      return p
    },
    [toast],
  )

  // Во время урока обновление приложения ждёт (SPEC 8.3).
  useEffect(() => {
    setUpdateBlocked(true)
    return () => {
      setUpdateBlocked(false)
      stopSpeech()
    }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const at = now()
        const input = await loadLessonInput(db, at)
        const plan = buildLesson(input.cards, input.deckOrder, at, input.limits)
        const ids = new Set(plan.tasks.map((t) => t.cardId))
        const cards = new Map(input.cards.filter((c) => ids.has(c.id)).map((c) => [c.id, c]))
        // Свои записи произношения — заранее, чтобы озвучка при показе слова звучала сразу.
        const audioIds = [...cards.values()].flatMap((c) => (c.audioId ? [c.audioId] : []))
        const media = await db.media.bulkGet(audioIds)
        const audio = new Map<string, Blob>()
        for (const c of cards.values()) {
          const m = media.find((x) => x?.id === c.audioId)
          if (m) audio.set(c.id, m.blob)
        }
        const pool: PoolCard[] = input.cards.map((c) => ({
          id: c.id,
          deckId: c.deckId,
          front: c.front,
          back: c.back,
          introduced: c.state !== State.New || c.introducedAt !== undefined,
        }))
        if (!alive) return
        const l: Loaded = { cards, audio, settings: input.settings, pool, poolById: new Map(pool.map((p) => [p.id, p])) }
        startedAt.current = Date.now()
        commit(prepare(startLesson(plan), l), l)
      } catch {
        if (!alive) return
        toast({ message: 'Не получилось открыть урок' })
        navigate('path')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const react = (kind: Reaction['kind']) => setReaction({ kind, id: ++reactionId.current })

  /** Урок закончился этим ответом: время и бонус за завершение — сразу в базу. */
  const finishIfDone = (next: LessonState) => {
    if (!isFinished(next)) return
    setElapsedMs(Date.now() - startedAt.current)
    setUndoSnap(null)
    void enqueue(() => finishLesson(db, now(), lessonXp(next.wrong, next.correct + next.wrong)))
  }

  /** Звук ответа: верно, «серия» на каждых 5 подряд, неверно. */
  const answerSound = (ok: boolean, next: LessonState) => {
    if (!ok) feedback('wrong')
    else feedback(next.streak > 0 && next.streak % XP.streakFrom === 0 ? 'streak' : 'correct')
  }

  const introDone = (cardId: string, durationMs: number) => {
    const { state, loaded } = live.current
    if (!state || !loaded || !isCurrent(['intro'], cardId)) return
    const p = loaded.poolById.get(cardId)
    let l = loaded
    if (p && !p.introduced) {
      const fresh = { ...p, introduced: true }
      const pool = loaded.pool.map((x) => (x.id === cardId ? fresh : x))
      l = { ...loaded, pool, poolById: new Map(loaded.poolById).set(cardId, fresh) }
    }
    const next = prepare(afterIntro(state), l)
    actionSeq.current++
    commit(next, l)
    setUndoSnap(null)
    void enqueue(() => markIntroduced(db, cardId, now(), durationMs))
    finishIfDone(next)
  }

  /** Оценка FSRS: считает XP, сохраняет одной транзакцией, двигает урок. */
  const applyGrade = (cardId: string, g: Grade, outcome: Outcome<Card>, durationMs: number, exercise: ExerciseType) => {
    const { state, loaded } = live.current
    if (!state || !loaded) return null
    const before = loaded.cards.get(cardId)
    if (!before) return null
    const ok = isCorrect(g)
    const xp = answerXp({ correct: ok, newWord: before.state === State.New, streak: ok ? state.streak + 1 : 0 })
    const l = { ...loaded, cards: new Map(loaded.cards).set(cardId, outcome.card) }
    const next = prepare(afterGrade(state, cardId, g, outcome.card.due, outcome.log.review, xp), l)
    const token = enqueue(() => saveAnswer(db, { before, grade: g, outcome, exerciseType: exercise, durationMs, xp }))
    return { prev: state, next, l, token, ok }
  }

  const gradeFlip = (cardId: string, g: Grade, outcome: Outcome<Card>, durationMs: number) => {
    if (!isCurrent(['graded'], cardId)) return
    const r = applyGrade(cardId, g, outcome, durationMs, 'flip')
    if (!r) return
    commit(r.next, r.l)
    const comesBack = r.next.returns[cardId] !== r.prev.returns[cardId]
    react(g === Rating.Again ? (comesBack ? 'again' : 'later') : g === Rating.Hard ? 'hard' : 'correct')
    if (isFinished(r.next)) feedback('finish')
    else answerSound(r.ok, r.next)
    const seq = ++actionSeq.current
    setUndoSnap(null)
    void r.token.then((token) => {
      // Конец урока не отменяется — итог уже показан.
      if (token && seq === actionSeq.current && !isFinished(r.next)) setUndoSnap({ state: r.prev, token })
    })
    finishIfDone(r.next)
  }

  const check = (cardId: string, answer: AutoAnswer) => {
    const { state, loaded } = live.current
    if (!state || !loaded || !isCurrent(['graded', 'easy'], cardId)) return
    const task = currentTask(state)!
    actionSeq.current++
    setUndoSnap(null)
    pendingUndo.current = null
    if (task.kind === 'easy') {
      // Лёгкое задание в конце — тренировка: без оценки FSRS, половина XP.
      const xp = practiceXp(answer.correct)
      const next = prepare(afterPractice(state, xp, answer.correct), loaded)
      void enqueue(() => savePractice(db, now(), xp, answer.durationMs))
      answerSound(answer.correct, next)
      showChecked({ correct: answer.correct, cardId, exercise: answer.type, next })
      finishIfDone(next)
      return
    }
    const card = loaded.cards.get(cardId)
    if (!card) return
    const g = gradeAuto(answer)
    const outcome = outcomes(card, now(), loaded.settings.retention)[g]
    const r = applyGrade(cardId, g, outcome, answer.durationMs, answer.type)
    if (!r) return
    answerSound(r.ok, r.next)
    showChecked({ correct: r.ok, typo: answer.typo, cardId, exercise: answer.type, next: r.next }, r.l)
    if (!isFinished(r.next)) pendingUndo.current = { prev: r.prev, token: r.token }
    finishIfDone(r.next)
  }

  const pairsDone = (durationMs: number) => {
    const { state, loaded } = live.current
    const task = state ? currentTask(state) : undefined
    if (!state || !loaded || live.current.checked || task?.kind !== 'pairs') return
    actionSeq.current++
    setUndoSnap(null)
    pendingUndo.current = null
    const xp = practiceXp(true) * (task.pairIds?.length ?? 0)
    const next = prepare(afterPractice(state, xp), loaded)
    void enqueue(() => savePractice(db, now(), xp, durationMs))
    feedback('correct')
    showChecked({ correct: true, cardId: '', exercise: 'pairs', ms: durationMs, next })
    finishIfDone(next)
  }

  const next = () => {
    const c = live.current.checked
    if (!c) return
    commit(c.next)
    if (isFinished(c.next)) {
      feedback('finish')
      return
    }
    const pu = pendingUndo.current
    pendingUndo.current = null
    if (!pu) return
    const seq = actionSeq.current
    void pu.token.then((token) => {
      if (token && seq === actionSeq.current) setUndoSnap({ state: pu.prev, token })
    })
  }

  const undo = () => {
    const { loaded } = live.current
    if (!undoSnap || !loaded || live.current.checked) return
    const { state: prev, token } = undoSnap
    actionSeq.current++
    setUndoSnap(null)
    setUndoCount((n) => n + 1)
    commit(prev, {
      ...loaded,
      cards: new Map(loaded.cards).set(token.cardBefore.id, token.cardBefore),
    })
    react('undo')
    void enqueue(() => undoAnswer(db, token))
  }

  const shown = checked?.next ?? state
  return {
    loaded,
    state,
    checked,
    canUndo: undoSnap !== null && !checked,
    reaction,
    elapsedMs,
    totalXp: shown ? shown.xp + (isFinished(shown) ? lessonXp(shown.wrong, shown.correct + shown.wrong) : 0) : 0,
    undoCount,
    introDone,
    gradeFlip,
    check,
    pairsDone,
    next,
    undo,
  }
}
