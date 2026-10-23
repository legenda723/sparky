import { Plus } from 'lucide-react'
import { forwardRef } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from '../ui/usePress'

/** Место будущего урока (DESIGN.md → «Место будущего урока»): пунктирный круг 72 с «+». */
export const GhostButton = forwardRef<HTMLButtonElement, { onSelect: () => void }>(function GhostButton({ onSelect }, ref) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Новый урок: добавь слова"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onSelect()
      }}
      className="press-soft flex h-[56px] w-[70px] items-center justify-center rounded-[50%] border-[3px] border-dashed border-road bg-bg text-muted"
    >
      <Plus size={30} strokeWidth={3} />
    </button>
  )
})
