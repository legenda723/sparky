import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

export type ButtonVariant = 'primary' | 'secondary' | 'info' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'press-3d bg-primary text-on-color [--press-shadow:var(--c-primary-shadow)]',
  info: 'press-3d bg-info text-on-color [--press-shadow:var(--c-info-shadow)]',
  danger: 'press-3d bg-danger text-on-color [--press-shadow:var(--c-danger-shadow)]',
  secondary: 'press-3d bg-bg text-text border-2 border-border [--press-shadow:var(--c-border)]',
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  icon?: ReactNode
  /** Растянуть на всю ширину */
  block?: boolean
  /** Не играть «тик»: кнопка сама запускает другой отклик (например, «верно») */
  silent?: boolean
  className?: string
}

/** Объёмная кнопка (DESIGN.md → «Кнопка объёмная»): при нажатии «проваливается» на 4 px. */
export function Button({
  variant = 'primary',
  icon,
  block,
  silent,
  disabled,
  onClick,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const { pressed, pressHandlers } = usePress(disabled)
  const look = disabled ? 'bg-disabled text-muted cursor-default' : VARIANTS[variant]
  return (
    <button
      type="button"
      {...rest}
      {...pressHandlers}
      disabled={disabled}
      data-pressed={pressed || undefined}
      onClick={(e) => {
        if (!silent) feedback('tap')
        onClick?.(e)
      }}
      className={`inline-flex h-[50px] items-center justify-center gap-2 rounded-card px-5 text-body font-extrabold tracking-[0.04em] uppercase ${look} ${block ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
