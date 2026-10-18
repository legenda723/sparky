// Задание «Пары»: соедини 5 слов с переводами на время. Только тренировка (DESIGN.md → «Задание «Пары»»).
import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../db/types'
import { feedback } from '../feedback/feedback'
import { speak } from '../media/speech'
import { shuffle, type PoolCard } from '../srs/exercise'
import { OptionCard, type OptionState } from '../ui/OptionCard'
import { formatDuration } from './LessonSummary'
import { TaskLabel, TaskLayout } from './tasks'

type Side = 'front' | 'back'

interface Pick {
  side: Side
  id: string
}

interface PairsTaskProps {
  words: PoolCard[]
  settings: Settings
  audio: Map<string, Blob>
  onDone: (durationMs: number) => void
}

export function PairsTask({ words, settings, audio, onDone }: PairsTaskProps) {
  // Перемешиваем один раз при показе: экран урока перерисовывается, а плитки не должны прыгать.
  const [left] = useState(() => shuffle(words, Math.random))
  const [right] = useState(() => shuffle(words, Math.random))
  const startedAt = useRef(performance.now())
  const [elapsed, setElapsed] = useState(0)
  const [picked, setPicked] = useState<Pick | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  // Вспышка после попытки: совпало (зелёные) или нет (красные).
  const [flash, setFlash] = useState<{ ids: Pick[]; ok: boolean } | null>(null)
  const done = matched.size === words.length

  useEffect(() => {
    if (done) return
    const t = setInterval(() => setElapsed(performance.now() - startedAt.current), 1000)
    return () => clearInterval(t)
  }, [done])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), flash.ok ? 300 : 400)
    return () => clearTimeout(t)
  }, [flash])

  useEffect(() => {
    if (!done) return
    const ms = performance.now() - startedAt.current
    setElapsed(ms)
    const t = setTimeout(() => onDone(ms), 350)
    return () => clearTimeout(t)
  }, [done])

  const tap = (p: Pick) => {
    if (done || matched.has(p.id)) return
    if (p.side === 'front' && settings.autoSpeak) {
      const w = words.find((x) => x.id === p.id)
      if (w) speak(w.front, { voiceURI: settings.voiceURI, rate: settings.speechRate }, audio.get(w.id))
    }
    if (!picked || picked.side === p.side) {
      setPicked(picked?.side === p.side && picked.id === p.id ? null : p)
      return
    }
    setPicked(null)
    if (picked.id === p.id) {
      setFlash({ ids: [picked, p], ok: true })
      setMatched(new Set(matched).add(p.id))
      feedback('correct')
    } else {
      setFlash({ ids: [picked, p], ok: false })
      feedback('wrong')
    }
  }

  const stateOf = (p: Pick): OptionState => {
    const inFlash = flash?.ids.some((x) => x.side === p.side && x.id === p.id)
    if (inFlash) return flash!.ok ? 'correct' : 'wrong'
    if (picked && picked.side === p.side && picked.id === p.id) return 'selected'
    return 'idle'
  }

  const column = (items: PoolCard[], side: Side) => (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {items.map((w) => {
        const p = { side, id: w.id }
        const gone = matched.has(w.id) && !flash?.ids.some((x) => x.side === side && x.id === w.id)
        return (
          <div key={w.id} className={`transition-opacity duration-200 ${gone ? 'opacity-35' : ''}`}>
            <OptionCard state={stateOf(p)} disabled={gone} onSelect={() => tap(p)}>
              <span lang={side === 'front' ? 'en' : undefined} className="break-words">
                {w[side]}
              </span>
            </OptionCard>
          </div>
        )
      })}
    </div>
  )

  return (
    <TaskLayout footer={null}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <TaskLabel>Соедини пары</TaskLabel>
          <span className="flex items-center gap-1 text-small font-extrabold text-muted tabular-nums" aria-label="Время">
            <Timer size={18} strokeWidth={2.5} />
            {formatDuration(elapsed)}
          </span>
        </div>
        <div className="mt-2 flex w-full gap-3">
          {column(left, 'front')}
          {column(right, 'back')}
        </div>
      </div>
    </TaskLayout>
  )
}
