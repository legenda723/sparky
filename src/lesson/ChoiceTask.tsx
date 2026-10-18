// Задание «Выбор»: EN→RU, RU→EN, «Картинка → слово», аудирование с выбором (DESIGN.md → «Задание «Выбор»»).
import { Turtle, Volume2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { answerSide, type PoolCard } from '../srs/exercise'
import type { AutoAnswer, ChoiceType } from '../srs/grade'
import { Button } from '../ui/Button'
import { OptionCard, type OptionState } from '../ui/OptionCard'
import { usePress } from '../ui/usePress'
import { TaskLabel, TaskLayout, useSpeech, type TaskProps } from './tasks'
import { Photo, SpeakButton } from './WordView'

const LABEL: Record<ChoiceType, string> = {
  'choice-en-ru': 'Выбери перевод',
  'choice-ru-en': 'Как по-английски?',
  picture: 'Что на картинке?',
  listen: 'Что ты услышал?',
}

/** Кнопки аудирования: большая «послушать» и «медленно» (DESIGN.md → «Кнопки аудирования»). */
export function ListenButtons({ onSay }: { onSay: (slow: boolean) => void }) {
  const big = usePress()
  const slow = usePress()
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        type="button"
        aria-label="Послушать ещё раз"
        {...big.pressHandlers}
        data-pressed={big.pressed || undefined}
        onClick={() => onSay(false)}
        className="press-3d flex size-24 items-center justify-center rounded-[24px] bg-info text-on-color [--press-shadow:var(--c-info-shadow)]"
      >
        <Volume2 size={44} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Послушать медленно"
        {...slow.pressHandlers}
        data-pressed={slow.pressed || undefined}
        onClick={() => onSay(true)}
        className="press-3d flex size-14 items-center justify-center rounded-card border-2 border-border bg-bg text-info-ink [--press-shadow:var(--c-border)]"
      >
        <Turtle size={28} strokeWidth={2.5} />
      </button>
    </div>
  )
}

interface ChoiceTaskProps extends TaskProps {
  exercise: ChoiceType
  options: PoolCard[]
  onCheck: (answer: AutoAnswer) => void
}

export function ChoiceTask(props: ChoiceTaskProps) {
  const { card, exercise, options } = props
  // Слово звучит само в EN→RU (по настройке) и в аудировании (всегда); в RU→EN и картинке слово — это ответ.
  const say = useSpeech(props, exercise === 'listen' ? 'always' : exercise === 'choice-en-ru' ? 'setting' : 'never')
  const shownAt = useRef(performance.now())
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const side = answerSide(exercise)

  const check = () => {
    if (!selected || checked) return
    setChecked(true)
    if (exercise !== 'choice-en-ru' && exercise !== 'listen' && props.settings.autoSpeak) say()
    props.onCheck({ type: exercise, correct: selected === card.id, durationMs: performance.now() - shownAt.current })
  }

  const stateOf = (id: string): OptionState => {
    if (!checked) return id === selected ? 'selected' : 'idle'
    if (id === card.id) return 'correct'
    return id === selected ? 'wrong' : 'idle'
  }

  return (
    <TaskLayout
      footer={
        <Button block silent disabled={!selected || checked} onClick={check}>
          Проверить
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <TaskLabel>{LABEL[exercise]}</TaskLabel>
        {exercise === 'choice-en-ru' && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex max-w-full items-center gap-3">
              <h2 lang="en" className="m-0 min-w-0 text-[36px] leading-tight font-black break-words text-text">
                {card.front}
              </h2>
              <SpeakButton onClick={() => say()} />
            </div>
            {card.transcription && <p className="m-0 text-body font-bold text-muted">{card.transcription}</p>}
          </div>
        )}
        {exercise === 'choice-ru-en' && <h2 className="m-0 text-display leading-tight font-black break-words text-text">{card.back}</h2>}
        {exercise === 'picture' && card.imageId && <Photo id={card.imageId} />}
        {exercise === 'listen' && <ListenButtons onSay={say} />}
        <div className="mt-2 flex w-full flex-col gap-3">
          {options.map((o) => (
            <div key={o.id} className={`transition-opacity duration-200 ${checked && stateOf(o.id) === 'idle' ? 'opacity-50' : ''}`}>
              <OptionCard state={stateOf(o.id)} disabled={checked} onSelect={() => setSelected(o.id)}>
                <span lang={side === 'front' ? 'en' : undefined}>{o[side]}</span>
              </OptionCard>
            </div>
          ))}
        </div>
      </div>
    </TaskLayout>
  )
}
