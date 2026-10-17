import { feedback } from '../feedback/feedback'

interface ChoiceChipsProps<T extends string | number> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}

/** Выбор из вариантов (DESIGN.md → «Выбор из вариантов»): ряд чипов-пилюль. */
export function ChoiceChips<T extends string | number>({ options, value, onChange, label }: ChoiceChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              feedback('tap')
              onChange(o.value)
            }}
            className={`h-11 rounded-full border-2 px-4 text-small font-extrabold transition-colors duration-200 active:scale-95 ${selected ? 'border-info bg-info-tint text-info-ink' : 'border-border bg-bg text-text'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
