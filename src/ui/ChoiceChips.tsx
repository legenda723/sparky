import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface ChoiceChipsProps<T extends string | number> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  /** Одной строкой с прокруткой вбок (фильтры) */
  scroll?: boolean
}

/** Выбор из вариантов (DESIGN.md → «Выбор из вариантов»): ряд чипов-пилюль. */
export function ChoiceChips<T extends string | number>({ options, value, onChange, label, scroll }: ChoiceChipsProps<T>) {
  const layout = scroll ? 'no-scrollbar -mx-4 flex-nowrap overflow-x-auto px-4 py-1' : 'flex-wrap'
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-2 ${layout}`}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <Chip
            key={String(o.value)}
            label={o.label}
            selected={selected}
            onSelect={() => onChange(o.value)}
          />
        )
      })}
    </div>
  )
}

function Chip({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onSelect()
      }}
      className={`press-soft h-11 shrink-0 rounded-full border-2 px-4 text-small font-extrabold ${selected ? 'border-info bg-info-tint text-info-ink' : 'border-border bg-bg text-text'}`}
    >
      {label}
    </button>
  )
}
