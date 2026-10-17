import type { ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong'

const STATES: Record<OptionState, string> = {
  idle: 'bg-bg border-border text-text shadow-[0_4px_0_var(--c-border)]',
  selected: 'bg-info-tint border-info text-info-ink shadow-[0_4px_0_var(--c-info)]',
  correct: 'bg-primary-tint border-primary text-primary-ink shadow-[0_4px_0_var(--c-primary)]',
  wrong: 'bg-danger-tint border-danger text-danger-ink shadow-[0_4px_0_var(--c-danger)]',
}

interface OptionCardProps {
  state?: OptionState
  disabled?: boolean
  onSelect?: () => void
  children: ReactNode
}

/** Вариант ответа (DESIGN.md → «Вариант ответа»). */
export function OptionCard({ state = 'idle', disabled, onSelect, children }: OptionCardProps) {
  const { pressed, pressHandlers } = usePress(disabled)
  return (
    <button
      type="button"
      {...pressHandlers}
      disabled={disabled}
      aria-pressed={state === 'selected'}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onSelect?.()
      }}
      className={`flex min-h-14 w-full items-center justify-center rounded-card border-2 px-4 py-3 text-center text-body font-extrabold transition-[translate,box-shadow,background-color,border-color] duration-100 ease-out data-pressed:translate-y-1 data-pressed:shadow-none ${STATES[state]}`}
    >
      {children}
    </button>
  )
}
