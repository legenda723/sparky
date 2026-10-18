// Задания этапа 4: «Знакомство» и «Карточка с переворотом».
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Card, Settings } from '../db/types'
import { speak } from '../media/speech'
import { now } from '../srs/clock'
import { GRADES, outcomes, Rating, shortInterval, type Grade, type Outcome } from '../srs/scheduler'
import { Button } from '../ui/Button'
import { usePress } from '../ui/usePress'
import { WordView } from './WordView'

interface TaskProps {
  card: Card
  settings: Settings
  audio?: Blob
}

/** Общая раскладка задания: прокручиваемая середина и кнопки внизу. */
function TaskLayout({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      {/* Слово прижато к верху: когда появляется ответ, оно не «уезжает». */}
      <div className="flex-1 overflow-y-auto overscroll-none px-[calc(16px+var(--safe-left))] pt-[5vh] pb-4">{children}</div>
      <div className="flex min-h-[calc(88px+var(--safe-bottom))] flex-col justify-end px-[calc(16px+var(--safe-left))] pt-2 pb-[calc(16px+var(--safe-bottom))]">
        {footer}
      </div>
    </div>
  )
}

function useSpeech({ card, settings, audio }: TaskProps) {
  const say = () => speak(card.front, { voiceURI: settings.voiceURI, rate: settings.speechRate }, audio)
  // Автоозвучка при показе (настройка). Звук уже разрешён касанием «УЧИТЬ».
  const auto = useRef(settings.autoSpeak)
  useEffect(() => {
    if (auto.current) say()
  }, []) // только при показе
  return say
}

export function IntroTask(props: TaskProps & { onDone: (durationMs: number) => void }) {
  const say = useSpeech(props)
  const shownAt = useRef(performance.now())
  return (
    <TaskLayout
      footer={
        <Button block onClick={() => props.onDone(performance.now() - shownAt.current)}>
          Запомнил
        </Button>
      }
    >
      <WordView card={props.card} label="Новое слово" answer photoFirst onSpeak={say} />
    </TaskLayout>
  )
}

const GRADE_LOOK: Record<Grade, { label: string; ink: string }> = {
  [Rating.Again]: { label: 'Снова', ink: 'text-danger-ink' },
  [Rating.Hard]: { label: 'Трудно', ink: 'text-streak-ink' },
  [Rating.Good]: { label: 'Хорошо', ink: 'text-primary-ink' },
  [Rating.Easy]: { label: 'Легко', ink: 'text-info-ink' },
}

function GradeButton({ grade, interval, onClick }: { grade: Grade; interval: string; onClick: () => void }) {
  const { pressed, pressHandlers } = usePress()
  const look = GRADE_LOOK[grade]
  return (
    <button
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={onClick}
      className="press-3d flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-card border-2 border-border bg-bg [--press-shadow:var(--c-border)]"
    >
      <span className={`text-small font-black tracking-[0.02em] uppercase ${look.ink}`}>{look.label}</span>
      <span className="text-caption font-extrabold text-muted">{interval}</span>
    </button>
  )
}

export function FlipTask(props: TaskProps & { onGrade: (g: Grade, outcome: Outcome<Card>, durationMs: number) => void }) {
  const say = useSpeech(props)
  const shownAt = useRef(performance.now())
  // Исходы считаются один раз при показе ответа: подпись на кнопке = то, что сохранится.
  const [revealed, setRevealed] = useState<{ at: Date; outs: Record<Grade, Outcome<Card>> } | null>(null)
  const done = useRef(false)

  const reveal = () => {
    const at = now()
    setRevealed({ at, outs: outcomes(props.card, at, props.settings.retention) })
  }

  const choose = (g: Grade) => {
    if (!revealed || done.current) return
    done.current = true
    props.onGrade(g, revealed.outs[g], performance.now() - shownAt.current)
  }

  return (
    <TaskLayout
      footer={
        revealed ? (
          <div className="flex gap-2">
            {GRADES.map((g) => (
              <GradeButton key={g} grade={g} interval={shortInterval(revealed.outs[g].card.due, revealed.at)} onClick={() => choose(g)} />
            ))}
          </div>
        ) : (
          <Button variant="info" block onClick={reveal}>
            Показать ответ
          </Button>
        )
      }
    >
      <WordView card={props.card} label="Вспомни перевод" answer={revealed !== null} onSpeak={say} />
    </TaskLayout>
  )
}
