import { forwardRef, type ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface HeaderChipProps {
  icon: ReactNode
  value: ReactNode
  /** Класс цвета иконки, например text-streak (число — цветом текста, ради контраста) */
  colorClass: string
  label: string
  onClick?: () => void
  /** Крупный (полоса «Пути»): число 20/900 вместо 17. */
  large?: boolean
}

/** Чип в шапке (DESIGN.md → «Чип в шапке»): иконка + число, тап — всплывашка. */
export const HeaderChip = forwardRef<HTMLButtonElement, HeaderChipProps>(function HeaderChip(
  { icon, value, colorClass, label, onClick, large },
  ref,
) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick?.()
      }}
      className={`flex h-11 items-center rounded-full px-2 font-black text-text press-soft ${large ? 'gap-2 text-heading' : 'gap-1.5 text-body'}`}
    >
      <span className={`flex ${colorClass}`}>{icon}</span>
      <span>{value}</span>
    </button>
  )
})
