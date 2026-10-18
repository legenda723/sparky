import { Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { navigate } from '../app/routes'
import { speak } from '../media/speech'
import { screenFade } from '../shell/screenFade'
import type { PoolCard } from '../srs/exercise'
import { isChoice, isTyping } from '../srs/grade'
import { accuracy, currentTask, isFinished } from '../srs/lesson'
import { AnswerBanner } from '../ui/AnswerBanner'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Mascot } from '../ui/Mascot'
import { ProgressBar } from '../ui/ProgressBar'
import { Sheet } from '../ui/Sheet'
import { ChoiceTask } from './ChoiceTask'
import { formatDuration, LessonSummary } from './LessonSummary'
import { PairsTask } from './PairsTask'
import { ReactionPill } from './ReactionPill'
import { StreakPill } from './StreakPill'
import { FlipTask, IntroTask } from './tasks'
import { TypeTask } from './TypeTask'
import { useLesson, type Checked, type LessonApi } from './useLesson'
import { SpeakButton } from './WordView'

const TASK_FADE = screenFade(() => 0.18)
const PRAISE = ['Отлично!', 'Точно!', 'Огонь!', 'Так держать!']

function leave() {
  navigate('path')
}

/** Плашка ответа после выбора, ввода и «Пар» (DESIGN.md → «Плашка ответа в уроке»). */
function Banner({ lesson, checked }: { lesson: LessonApi; checked: Checked | null }) {
  // Держим последний ответ, пока плашка уезжает.
  const [last, setLast] = useState<Checked | null>(null)
  if (checked && checked !== last) setLast(checked)
  const c = checked ?? last
  const card = c?.cardId ? lesson.loaded?.cards.get(c.cardId) : undefined
  const settings = lesson.loaded?.settings
  let title = ''
  let text = null
  if (c?.exercise === 'pairs') {
    title = 'Пары собраны!'
    text = <>За {formatDuration(c.ms ?? 0)}</>
  } else if (c && card) {
    const word = (
      <>
        <span lang="en" className="font-black">
          {card.front}
        </span>{' '}
        — {card.back}
      </>
    )
    if (!c.correct) {
      title = 'Почти!'
      text = <>Правильно: {word}</>
    } else if (c.typo) {
      title = 'Засчитано!'
      text = (
        <>
          Опечатка: правильно{' '}
          <span lang="en" className="font-black">
            {card.front}
          </span>
        </>
      )
    } else {
      title = PRAISE[c.next.index % PRAISE.length]
      text = word
    }
  }
  return (
    <AnswerBanner
      open={checked !== null}
      kind={!c || c.correct ? 'correct' : 'wrong'}
      title={title}
      action={
        card && settings ? (
          <SpeakButton
            onClick={() => speak(card.front, { voiceURI: settings.voiceURI, rate: settings.speechRate }, lesson.loaded?.audio.get(card.id))}
          />
        ) : undefined
      }
      onNext={lesson.next}
    >
      {text}
    </AnswerBanner>
  )
}

/** Экран урока (SPEC 7.2, DESIGN.md → «Экран урока»). */
export default function LessonScreen() {
  const lesson = useLesson()
  const { loaded, state, checked } = lesson
  const [confirmExit, setConfirmExit] = useState(false)

  const finished = state ? isFinished(state) : false
  const task = state ? currentTask(state) : undefined
  const card = task && loaded ? loaded.cards.get(task.cardId) : undefined
  // Прогресс и серия — уже с учётом проверенного ответа.
  const shown = checked?.next ?? state
  const rawProgress = shown && shown.queue.length ? shown.index / shown.queue.length : 0
  // Возврат слова в конец урока удлиняет очередь — полоска не откатывается назад (кроме «Отменить оценку»).
  const progressMax = useRef({ value: 0, undo: 0 })
  if (progressMax.current.undo !== lesson.undoCount) progressMax.current = { value: rawProgress, undo: lesson.undoCount }
  else progressMax.current.value = Math.max(progressMax.current.value, rawProgress)
  const progress = progressMax.current.value
  const poolOf = (ids: string[] | undefined): PoolCard[] =>
    (ids ?? []).flatMap((id) => {
      const p = loaded?.poolById.get(id)
      return p ? [p] : []
    })

  let body = null
  let key = 'loading'
  if (state && state.queue.length === 0) {
    key = 'empty'
    body = (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <Mascot size={120} />
          <h1 className="m-0 text-heading font-black text-text">На сегодня всё!</h1>
          <p className="m-0 text-small font-semibold text-muted">Повторений нет, а новые слова — завтра.</p>
        </div>
        <div className="px-4 pt-2 pb-[calc(16px+var(--safe-bottom))]">
          <Button block onClick={leave}>
            Готово
          </Button>
        </div>
      </div>
    )
  } else if (state && finished) {
    key = 'summary'
    body = (
      <LessonSummary
        xp={lesson.totalXp}
        accuracy={accuracy(state)}
        elapsedMs={lesson.elapsedMs}
        bestStreak={state.bestStreak}
        onDone={leave}
      />
    )
  } else if (task && loaded) {
    key = `task-${state!.index}-${lesson.undoCount}`
    const ex = task.exercise
    if (task.kind === 'pairs') {
      body = <PairsTask words={poolOf(task.pairIds)} settings={loaded.settings} audio={loaded.audio} onDone={lesson.pairsDone} />
    } else if (card) {
      const common = { card, settings: loaded.settings, audio: loaded.audio.get(card.id) }
      if (task.kind === 'intro') {
        body = <IntroTask {...common} onDone={(ms) => lesson.introDone(card.id, ms)} />
      } else if (isChoice(ex)) {
        body = <ChoiceTask {...common} exercise={ex} options={poolOf(task.options)} onCheck={(a) => lesson.check(card.id, a)} />
      } else if (isTyping(ex)) {
        body = <TypeTask {...common} exercise={ex} onCheck={(a) => lesson.check(card.id, a)} />
      } else {
        body = <FlipTask {...common} onGrade={(g, outcome, ms) => lesson.gradeFlip(card.id, g, outcome, ms)} />
      }
    }
  }

  const inLesson = !finished && state !== null && state.queue.length > 0

  return (
    <motion.div
      className="relative flex h-full flex-col bg-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.18 } }}
    >
      {inLesson && (
        <div className="pt-[calc(8px+var(--safe-top))] pr-[calc(8px+var(--safe-right))] pl-[calc(8px+var(--safe-left))]">
          <div className="flex items-center gap-2">
            <IconButton label="Выйти из урока" onClick={() => setConfirmExit(true)}>
              <X size={28} strokeWidth={2.5} />
            </IconButton>
            <div className="min-w-0 flex-1">
              <ProgressBar value={progress} label="Прогресс урока" />
            </div>
            {lesson.canUndo ? (
              <IconButton label="Отменить последнюю оценку" onClick={lesson.undo}>
                <Undo2 size={26} strokeWidth={2.5} />
              </IconButton>
            ) : (
              <span className="size-11 shrink-0" />
            )}
          </div>
          <StreakPill streak={shown?.streak ?? 0} />
        </div>
      )}
      {inLesson && <ReactionPill reaction={lesson.reaction} />}
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div key={key} variants={TASK_FADE} initial="enter" animate="center" exit="exit" className="absolute inset-0">
            {body}
          </motion.div>
        </AnimatePresence>
      </main>
      <Banner lesson={lesson} checked={checked} />
      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Выйти из урока?" text="Ответы уже сохранены.">
        <Button block onClick={() => setConfirmExit(false)}>
          Продолжить урок
        </Button>
        <Button variant="secondary" block className="text-danger-ink!" onClick={leave}>
          Выйти
        </Button>
      </Sheet>
    </motion.div>
  )
}
