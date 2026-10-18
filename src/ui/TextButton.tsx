import type { ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface TextButtonProps {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  /** Опасное действие — красный текст */
  danger?: boolean
  className?: string
}

/** Текстовая кнопка (DESIGN.md → «Текстовая кнопка»). */
export function TextButton({ onClick, children, disabled, danger, className = '' }: TextButtonProps) {
  const { pressed, pressHandlers } = usePress(disabled)
  const color = disabled ? 'text-muted' : danger ? 'text-danger-ink' : 'text-info-ink'
  return (
    <button
      type="button"
      disabled={disabled}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className={`min-h-11 rounded-card px-3 text-small font-extrabold transition-colors duration-200 data-pressed:bg-surface data-pressed:duration-75 ${color} ${className}`}
    >
      {children}
    </button>
  )
}
