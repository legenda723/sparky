import { Dumbbell } from 'lucide-react'
import type { Ref } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'

/**
 * Плашка «ТРЕНИРОВКА» наверху «Пути» (DESIGN.md → «Плашка тренировки»): на месте и в стиле прежней плашки раздела,
 * цвета info, одна крупная надпись «Тренировка», справа гантель. Касание — вся плашка.
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
      className="press-3d flex w-full items-center gap-3 rounded-card bg-info p-4 text-left text-on-color [--press-shadow:var(--c-info-shadow)]"
    >
      <span className="min-w-0 flex-1 truncate text-title font-black">Тренировка</span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-info-shadow">
        <Dumbbell size={24} strokeWidth={2.5} />
      </span>
    </button>
  )
}
