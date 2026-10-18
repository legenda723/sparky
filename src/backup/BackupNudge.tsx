import { CloudUpload } from 'lucide-react'
import { Button } from '../ui/Button'

interface BackupNudgeProps {
  /** «ещё не было», «9 дней назад»… */
  age: string
  never: boolean
  onSave: () => void
}

/** Плашка-напоминание о бэкапе (DESIGN.md → «Плашка-напоминание»). Мягкая, без тревоги. */
export function BackupNudge({ age, never, onSave }: BackupNudgeProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border-2 border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <CloudUpload size={28} strokeWidth={2.5} className="shrink-0 text-streak-ink" />
        <div className="flex min-w-0 flex-col gap-0.5 text-left">
          <span className="text-body font-extrabold text-text">
            {never ? 'Сохрани копию слов' : `Последняя копия — ${age}`}
          </span>
          <span className="text-small font-semibold text-muted">
            Если с телефоном что-то случится, слова и прогресс вернутся из файла в iCloud Drive.
          </span>
        </div>
      </div>
      <Button block onClick={onSave}>
        Сохранить копию
      </Button>
    </div>
  )
}
