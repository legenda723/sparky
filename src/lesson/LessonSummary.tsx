import { BookOpen, Target, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/Mascot'

function Tile({ icon, value, label, ink }: { icon: ReactNode; value: string; label: string; ink: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-card border-2 border-border bg-surface p-3">
      <span className={ink}>{icon}</span>
      <span className="text-title font-black text-text">{value}</span>
      <span className="text-caption font-extrabold text-muted">{label}</span>
    </div>
  )
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface LessonSummaryProps {
  words: number
  accuracy: number
  elapsedMs: number
  onDone: () => void
}

/** Итог урока — пока простой (DESIGN.md → «Итог урока»). */
export function LessonSummary({ words, accuracy, elapsedMs, onDone }: LessonSummaryProps) {
  const phrase = accuracy === 100 ? 'Без единой ошибки!' : accuracy >= 80 ? 'Так держать!' : 'Каждый урок — шаг вперёд!'
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-[calc(16px+var(--safe-left))] text-center">
        <Mascot mood="cheer" size={140} />
        <h1 className="m-0 text-display font-black text-text">Урок пройден!</h1>
        <p className="m-0 text-body font-bold text-muted">{phrase}</p>
        <div className="mt-4 flex w-full gap-3">
          <Tile icon={<BookOpen size={24} strokeWidth={2.5} />} value={String(words)} label={plural(words, 'Слово', 'Слова', 'Слов')} ink="text-info-ink" />
          <Tile icon={<Target size={24} strokeWidth={2.5} />} value={`${accuracy}%`} label="Точность" ink="text-primary-ink" />
          <Tile icon={<Timer size={24} strokeWidth={2.5} />} value={formatDuration(elapsedMs)} label="Время" ink="text-streak-ink" />
        </div>
      </div>
      <div className="px-[calc(16px+var(--safe-left))] pt-2 pb-[calc(16px+var(--safe-bottom))]">
        <Button block onClick={onDone}>
          Готово
        </Button>
      </div>
    </div>
  )
}
