// Ход урока на экране: очередь заданий, сохранение каждого ответа сразу и «Отменить оценку».
import { useCallback, useEffect, useRef, useState } from 'react'
import { setUpdateBlocked } from '../app/updates'
import { db } from '../db/db'
import { feedback } from '../feedback/feedback'
import { finishLesson, loadLessonInput, markIntroduced, saveAnswer, undoAnswer, type UndoToken } from '../db/review'
import type { Card, Settings } from '../db/types'
import { stopSpeech } from '../media/speech'
import { now } from '../srs/clock'
import { afterGrade, afterIntro, buildLesson, currentTask, isFinished, startLesson, type LessonState } from '../srs/lesson'
import { Rating, type Grade, type Outcome } from '../srs/scheduler'
import { useToast } from '../ui/Toast'

/** Реакция на оценку: «later» — «Снова», но слово уже возвращалось 3 раза и придёт в следующем уроке. */
export interface Reaction {
  kind: 'correct' | 'hard' | 'again' | 'later' | 'undo'
  id: number
}

interface Loaded {
  cards: Map<string, Card>
  audio: Map<string, Blob>
  settings: Settings
}

export interface LessonApi {
  loaded: Loaded | null
  state: LessonState | null
  /** Можно отменить последнюю оценку. */
  canUndo: boolean
  reaction: Reaction | null
  /** Время урока от начала до конца, мс. */
  elapsedMs: number
  introDone: (cardId: string, durationMs: number) => void
  grade: (cardId: string, grade: Grade, outcome: Outcome<Card>, durationMs: number) => void
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
  const [undoSnap, setUndoSnap] = useState<UndoSnapshot | null>(null)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAt = useRef(Date.now())
  // Записи в базу идут строго по очереди: быстрые касания не обгоняют друг друга.
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const reactionId = useRef(0)
  // Номер последнего действия: отмена предлагается только для самой последней оценки.
  const actionSeq = useRef(0)
  // Свежее состояние для обработчиков касаний: гаснущее задание держит старые обработчики,
  // и касание по нему не должно откатить урок назад.
  const live = useRef<{ state: LessonState | null; loaded: Loaded | null }>({ state: null, loaded: null })

  const commit = (nextState: LessonState, nextLoaded?: Loaded) => {
    live.current = { state: nextState, loaded: nextLoaded ?? live.current.loaded }
    setState(nextState)
    if (nextLoaded) setLoaded(nextLoaded)
  }

  /** Касание относится к заданию, которое сейчас на экране. */
  const isCurrent = (kind: 'intro' | 'flip', cardId: string) => {
    const s = live.current.state
    const task = s ? currentTask(s) : undefined
    return task?.kind === kind && task.cardId === cardId
  }

  const enqueue = useCallback(
    <T,>(job: () => Promise<T>): Promise<T | undefined> => {
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
      if (!alive) return
      startedAt.current = Date.now()
      commit(startLesson(plan), { cards, audio, settings: input.settings })
    })()
    return () => {
      alive = false
    }
  }, [])

  const react = (kind: Reaction['kind']) => setReaction({ kind, id: ++reactionId.current })

  const finishIfDone = (next: LessonState) => {
    if (!isFinished(next)) return
    setElapsedMs(Date.now() - startedAt.current)
    setUndoSnap(null)
    void enqueue(() => finishLesson(db, now()))
  }

  const introDone = (cardId: string, durationMs: number) => {
    const state = live.current.state
    if (!state || !isCurrent('intro', cardId)) return
    const next = afterIntro(state)
    actionSeq.current++
    commit(next)
    setUndoSnap(null)
    void enqueue(() => markIntroduced(db, cardId, now(), durationMs))
    finishIfDone(next)
  }

  const grade = (cardId: string, g: Grade, outcome: Outcome<Card>, durationMs: number) => {
    const { state, loaded } = live.current
    if (!state || !loaded || !isCurrent('flip', cardId)) return
    const before = loaded.cards.get(cardId)
    if (!before) return
    const prev = state
    const at = outcome.log.review
    const next = afterGrade(state, cardId, g, outcome.card.due, at)
    commit(next, { ...loaded, cards: new Map(loaded.cards).set(cardId, outcome.card) })
    const comesBack = next.queue.length > prev.queue.length
    react(g === Rating.Again ? (comesBack ? 'again' : 'later') : g === Rating.Hard ? 'hard' : 'correct')
    feedback(isFinished(next) ? 'finish' : g === Rating.Again ? 'wrong' : 'correct')
    const seq = ++actionSeq.current
    setUndoSnap(null)
    void enqueue(() => saveAnswer(db, { before, grade: g, outcome, exerciseType: 'flip', durationMs })).then((token) => {
      // Конец урока не отменяется — итог уже показан.
      if (token && seq === actionSeq.current && !isFinished(next)) setUndoSnap({ state: prev, token })
    })
    finishIfDone(next)
  }

  const undo = () => {
    const { loaded } = live.current
    if (!undoSnap || !loaded) return
    const { state: prev, token } = undoSnap
    actionSeq.current++
    setUndoSnap(null)
    commit(prev, { ...loaded, cards: new Map(loaded.cards).set(token.cardBefore.id, token.cardBefore) })
    react('undo')
    void enqueue(() => undoAnswer(db, token))
  }

  return { loaded, state, canUndo: undoSnap !== null, reaction, elapsedMs, introDone, grade, undo }
}
