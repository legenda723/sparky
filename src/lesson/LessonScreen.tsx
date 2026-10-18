import { Undo2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { navigate } from '../app/routes'
import { screenFade } from '../shell/screenFade'
import { accuracy, currentTask, isFinished } from '../srs/lesson'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Mascot } from '../ui/Mascot'
import { ProgressBar } from '../ui/ProgressBar'
import { Sheet } from '../ui/Sheet'
import { LessonSummary } from './LessonSummary'
import { ReactionPill } from './ReactionPill'
import { FlipTask, IntroTask } from './tasks'
import { useLesson } from './useLesson'

const TASK_FADE = screenFade(() => 0.18)

function leave() {
  navigate('path')
}

/** Экран урока (SPEC 7.2, DESIGN.md → «Экран урока»). */
export default function LessonScreen() {
  const lesson = useLesson()
  const { loaded, state } = lesson
  const [confirmExit, setConfirmExit] = useState(false)

  const finished = state ? isFinished(state) : false
  const task = state ? currentTask(state) : undefined
  const card = task && loaded ? loaded.cards.get(task.cardId) : undefined
  const progress = state && state.queue.length ? state.index / state.queue.length : 0

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
        words={new Set(state.queue.map((t) => t.cardId)).size}
        accuracy={accuracy(state)}
        elapsedMs={lesson.elapsedMs}
        onDone={leave}
      />
    )
  } else if (task && card && loaded) {
    key = `task-${state!.index}`
    const common = { card, settings: loaded.settings, audio: loaded.audio.get(card.id) }
    body =
      task.kind === 'intro' ? (
        <IntroTask {...common} onDone={(ms) => lesson.introDone(card.id, ms)} />
      ) : (
        <FlipTask {...common} onGrade={(g, outcome, ms) => lesson.grade(card.id, g, outcome, ms)} />
      )
  }

  const inLesson = !finished && state !== null && state.queue.length > 0

  return (
    <motion.div
      className="relative flex h-full flex-col bg-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.18 } }}
    >
      {inLesson && (
        <div className="flex items-center gap-2 pt-[calc(8px+var(--safe-top))] pr-[calc(8px+var(--safe-right))] pl-[calc(8px+var(--safe-left))]">
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
      )}
      {inLesson && <ReactionPill reaction={lesson.reaction} />}
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div key={key} variants={TASK_FADE} initial="enter" animate="center" exit="exit" className="absolute inset-0">
            {body}
          </motion.div>
        </AnimatePresence>
      </main>
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
