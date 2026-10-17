import { feedback } from '../feedback/feedback'
import { usePress } from './usePress'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/**
 * Переключатель 51×31 (DESIGN.md → «Переключатель»). Касание — вся область 51×44.
 * Кружок едет простым сдвигом (без пересчёта раскладки — на iPhone так плавнее),
 * при касании чуть вытягивается, как в iOS.
 */
export function Switch({ checked, onChange, label }: SwitchProps) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      data-checked={checked || undefined}
      onClick={() => {
        // Отклик звучит по новому значению: при выключении звука «тик» уже не играет.
        onChange(!checked)
        feedback('tap')
      }}
      className="flex h-11 w-[51px] shrink-0 items-center"
    >
      <span
        className={`relative block h-[31px] w-[51px] rounded-full transition-colors duration-200 ease-out ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className="switch-knob absolute top-0.5 left-0.5 block h-[27px] w-[27px] rounded-full bg-on-color shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
      </span>
    </button>
  )
}
