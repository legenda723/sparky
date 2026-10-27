// Содержимое всплывашек пути (DESIGN.md → «Всплывашка узла», «Сундук пути»).
import { RotateCcw } from 'lucide-react'
import type { PathData } from '../db/path'
import type { PathNode } from '../game/path'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'

const words = (n: number) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`
const newWords = (n: number) => `${n} ${plural(n, 'новое слово', 'новых слова', 'новых слов')}`

function Title({ children }: { children: string }) {
  return <div className="text-body font-black text-text">{children}</div>
}

function Text({ children }: { children: string }) {
  return <p className="m-0 mt-1 text-small font-semibold text-muted">{children}</p>
}

interface NodeInfoProps {
  node: PathNode
  /** Сколько узлов на пути. */
  total: number
  data: PathData
  onStart: () => void
  onReview: () => void
  /** «Ещё 5 новых слов» (SPEC 6.5). */
  onMore: () => void
}

export function NodeInfo({ node, total, data, onStart, onReview, onMore }: NodeInfoProps) {
  const title = `Урок ${node.index + 1} из ${total}`
  const { today } = data
  const review = (
    <div className="mt-4">
      <Button variant="info" block icon={<RotateCcw size={22} strokeWidth={2.75} />} onClick={onReview}>
        Повторить
      </Button>
    </div>
  )

  if (node.state === 'locked') {
    return (
      <>
        <Title>{title}</Title>
        <Text>Сначала пройди уроки выше</Text>
      </>
    )
  }

  if (node.state === 'passed' || node.state === 'mastered') {
    return (
      <>
        <Title>{`${title} · ${node.state === 'mastered' ? 'освоен 👑' : 'пройден'}`}</Title>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
          {node.cardIds.map((id) => {
            const w = data.words.get(id)
            return w ? (
              <li key={id} className="truncate text-small font-bold text-text">
                <span lang="en">{w.front}</span> <span className="text-muted">— {w.back}</span>
              </li>
            ) : null
          })}
        </ul>
      </>
    )
  }

  // Текущий: сначала повторения к сроку (решение владельца), потом новые.
  if (today.dueNow > 0) {
    return (
      <>
        <Title>{title}</Title>
        <Text>{`Сначала повтори ${words(today.due)} — потом новые`}</Text>
        {review}
      </>
    )
  }
  const left = node.cardIds.length - node.introduced
  const n = Math.min(left, today.newAvailable, data.newPerLesson)
  if (n === 0) {
    const est = data.plan.extraEstimate
    return (
      <>
        <Title>{title}</Title>
        <Text>Новые слова на сегодня — всё</Text>
        {today.due > 0 ? (
          review
        ) : (
          <div className="mt-4">
            <Button variant="secondary" block onClick={onMore}>
              {`Ещё ${Math.min(5, left)} новых слов`}
            </Button>
            <p className="m-0 mt-1 text-center text-caption font-bold text-muted">
              {`≈ ${est} ${plural(est, 'повторение', 'повторения', 'повторений')} за неделю`}
            </p>
          </div>
        )}
      </>
    )
  }
  return (
    <>
      <Title>{title}</Title>
      <Text>{n < left ? `${newWords(n)} из ${left}` : newWords(n)}</Text>
      <div className="mt-4">
        <Button block onClick={onStart}>
          Начать
        </Button>
      </div>
    </>
  )
}

/** Место следующего урока в конце пути (закрытый круг с замком). */
export function GhostInfo({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <Title>Новый урок</Title>
      <Text>Добавь слова в любую колоду — каждые 5 новых слов становятся уроком</Text>
      <div className="mt-4">
        <Button block onClick={onAdd}>
          Добавить слова
        </Button>
      </div>
    </>
  )
}
