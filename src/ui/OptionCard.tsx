import type { ReactNode } from 'react'
import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong'

const STATES: Record<OptionState, string> = {
  idle: 'bg-bg border-border text-text [--press-shadow:var(--c-border)]',
  selected: 'bg-info-tint border-info text-info-ink [--press-shadow:var(--c-info)]',
  correct: 'bg-primary-tint border-primary text-primary-ink [--press-shadow:var(--c-primary)]',
  wrong: 'bg-danger-tint border-danger text-danger-ink [--press-shadow:var(--c-danger)]',
}

interface OptionCardProps {
  state?: OptionState
  disabled?: boolean
  onSelect?: () => void
  /** Без «тика»: задание само играет звук ответа («Пары»). */
  silent?: boolean
  children: ReactNode
}

/** Вариант ответа (DESIGN.md → «Вариант ответа»). */
export function OptionCard({ state = 'idle', disabled, onSelect, silent, children }: OptionCardProps) {
  const { pressed, pressHandlers } = usePress(disabled)
  return (
    <button
      type="button"
      {...pressHandlers}
      disabled={disabled}
      aria-pressed={state === 'selected'}
      data-pressed={pressed || undefined}
      onClick={() => {
        if (!silent) feedback('tap')
        onSelect?.()
      }}
      className={`flex min-h-14 w-full items-center justify-center rounded-card border-2 px-4 py-3 text-center text-body font-extrabold press-3d ${STATES[state]}`}
    >
      {children}
    </button>
  )
}
