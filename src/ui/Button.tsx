import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

export type ButtonVariant = 'primary' | 'secondary' | 'info' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-color shadow-[0_4px_0_var(--c-primary-shadow)]',
  info: 'bg-info text-on-color shadow-[0_4px_0_var(--c-info-shadow)]',
  danger: 'bg-danger text-on-color shadow-[0_4px_0_var(--c-danger-shadow)]',
  secondary: 'bg-bg text-text border-2 border-border shadow-[0_4px_0_var(--c-border)]',
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
      className={`inline-flex h-[50px] items-center justify-center gap-2 rounded-card px-5 text-body font-extrabold tracking-[0.04em] uppercase transition-[translate,box-shadow] duration-100 ease-out data-pressed:translate-y-1 data-pressed:shadow-none ${look} ${block ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
