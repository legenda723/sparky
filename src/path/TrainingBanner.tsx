import { Dumbbell } from 'lucide-react'
import type { Ref } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'

/**
 * Плашка «ТРЕНИРОВКА» наверху «Пути» (DESIGN.md → «Плашка тренировки»): как прежняя кнопка «ТРЕНИРОВКА»
 * (гантель и надпись заглавными по центру, цвета info), только во всю ширину и крупнее.
 */
export function TrainingBanner({ onClick, ref }: { onClick: () => void; ref?: Ref<HTMLButtonElement> }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      ref={ref}
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className="press-3d flex h-[60px] w-full items-center justify-center gap-3 rounded-card bg-info px-5 text-heading font-extrabold tracking-[0.04em] text-on-color uppercase [--press-shadow:var(--c-info-shadow)]"
    >
      <Dumbbell size={26} strokeWidth={2.75} />
      Тренировка
    </button>
  )
}
