import type { ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}

/** Кнопка-иконка 44×44 (шапка вложенного экрана): нажатие — круглый фон --c-surface. */
export function IconButton({ label, onClick, children, className = 'text-muted' }: IconButtonProps) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-label={label}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className={`press-soft flex size-11 shrink-0 items-center justify-center rounded-full data-pressed:bg-surface ${className}`}
    >
      {children}
    </button>
  )
}
