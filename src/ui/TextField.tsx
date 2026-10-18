import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  error?: string
  ref?: Ref<HTMLInputElement>
}

/** Поле ввода (DESIGN.md → «Поле ввода»). Шрифт 17 — iOS не приближает экран. */
export function TextField({ label, error, id, ref, ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-small font-bold text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-[52px] w-full rounded-card border-2 bg-surface px-4 text-body font-bold text-text outline-none transition-colors duration-200 placeholder:font-semibold placeholder:text-muted focus:border-info ${error ? 'border-danger focus:border-danger' : 'border-border'}`}
      />
      {error && (
        <p id={errorId} className="m-0 text-caption font-bold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
