import type { ReactNode } from 'react'
import { Mascot } from './Mascot'

interface EmptyStateProps {
  title: string
  text: string
  mascotSize?: number
  /** Кнопки во всю ширину */
  children?: ReactNode
}

/** Пустое состояние с действием (DESIGN.md). */
export function EmptyState({ title, text, mascotSize = 120, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center pt-[6vh] text-center">
      <Mascot size={mascotSize} />
      <h2 className="m-0 mt-4 text-heading font-black text-text">{title}</h2>
      <p className="m-0 mt-2 max-w-[300px] text-small font-semibold text-muted">{text}</p>
      {children && <div className="mt-6 flex w-full flex-col gap-3">{children}</div>}
    </div>
  )
}
