// Задание «Ввод»: по переводу или на слух напиши слово по-английски (DESIGN.md → «Задание «Ввод»»).
import { useRef, useState } from 'react'
import { checkTyped, typingHint } from '../srs/exercise'
import type { AutoAnswer, TypingType } from '../srs/grade'
import { Button } from '../ui/Button'
import { TextButton } from '../ui/TextButton'
import { TextField } from '../ui/TextField'
import { useKeyboardInset } from '../ui/useKeyboardInset'
import { ListenButtons } from './ChoiceTask'
import { TaskLabel, TaskLayout, useSpeech, type TaskProps } from './tasks'

interface TypeTaskProps extends TaskProps {
  exercise: TypingType
  onCheck: (answer: AutoAnswer) => void
}

export function TypeTask(props: TypeTaskProps) {
  const { card, exercise } = props
  const listen = exercise === 'listen-type'
  // Во вводе по переводу слово — это ответ: озвучиваем после проверки.
  const say = useSpeech(props, listen ? 'always' : 'never')
  const shownAt = useRef(performance.now())
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [hinted, setHinted] = useState(false)
  const [checked, setChecked] = useState(false)
  const keyboard = useKeyboardInset()
  // iOS 26: над клавиатурой висит плавающая панель (стрелки и ✓), а страница сдвигается так, чтобы поле было
  // посередине. Поэтому, пока клавиатура открыта, «ПРОВЕРИТЬ» стоит прямо под полем, а не у края клавиатуры.
  const keyboardOpen = keyboard > 0 && !checked

  const check = () => {
    if (!value.trim() || checked) return
    setChecked(true)
    // Клавиатура прячется — видна плашка ответа.
    input.current?.blur()
    const verdict = checkTyped(value, card.front)
    if (!listen && props.settings.autoSpeak) say()
    props.onCheck({
      type: exercise,
      correct: verdict !== 'wrong',
      typo: verdict === 'typo',
      hinted,
      durationMs: performance.now() - shownAt.current,
    })
  }

  const checkButton = (
    <Button block silent disabled={!value.trim() || checked} onClick={check}>
      Проверить
    </Button>
  )

  return (
    <TaskLayout footer={checkButton} hideFooter={keyboardOpen}>
      <div className="flex flex-col items-center gap-4 text-center">
        <TaskLabel>{listen ? 'Напиши, что услышал' : 'Напиши по-английски'}</TaskLabel>
        {listen ? <ListenButtons onSay={say} /> : <h2 className="m-0 text-display leading-tight font-black break-words text-text">{card.back}</h2>}
        <form
          className="mt-2 w-full text-left"
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
        >
          <TextField
            ref={input}
            aria-label="Слово по-английски"
            lang="en"
            value={value}
            readOnly={checked}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Слово по-английски"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
          />
        </form>
        {keyboardOpen && (
          // Касание кнопки не должно сначала убирать фокус с поля (иначе клавиатура прыгнет до проверки).
          <div className="w-full" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
            {checkButton}
          </div>
        )}
        {/* «Подсказка» не прячет клавиатуру: фокус остаётся в поле. */}
        <div className="flex min-h-11 items-center" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          {hinted ? (
            <p className="m-0 text-small font-bold text-muted">
              Начинается на «<span lang="en">{typingHint(card.front)}…</span>»
            </p>
          ) : (
            !checked && <TextButton onClick={() => setHinted(true)}>Подсказка</TextButton>
          )}
        </div>
      </div>
    </TaskLayout>
  )
}
