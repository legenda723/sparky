import type { ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface ListRowProps {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Справа: число, переключатель, стрелка */
  right?: ReactNode
  onClick?: () => void
}

/** Строка списка (DESIGN.md → «Строка списка»). Без onClick — просто строка (например, с переключателем). */
export function ListRow({ icon, title, subtitle, right, onClick }: ListRowProps) {
  const { pressed, pressHandlers } = usePress(!onClick)
  const content = (
    <>
      {icon && <span className="flex size-10 shrink-0 items-center justify-center">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-body font-bold text-text">{title}</span>
        {subtitle && <span className="truncate text-caption font-semibold text-muted">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const cls =
    'flex min-h-14 w-full items-center gap-3 border-b-2 border-border px-4 py-2 transition-colors duration-100 data-pressed:bg-surface'
  if (!onClick) return <div className={cls}>{content}</div>
  return (
    <button
      type="button"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className={cls}
    >
      {content}
    </button>
  )
}
