import { motion } from 'motion/react'
import { feedback } from '../feedback/feedback'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** Переключатель 51×31 (DESIGN.md → «Переключатель»). Касание — вся область 51×44. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        // Отклик звучит по новому значению: при выключении звука «тик» уже не играет.
        onChange(!checked)
        feedback('tap')
      }}
      className="flex h-11 w-[51px] shrink-0 items-center"
    >
      <span
        className={`flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-colors duration-200 ${checked ? 'justify-end bg-primary' : 'justify-start bg-border'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          className="block size-[27px] rounded-full bg-on-color shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        />
      </span>
    </button>
  )
}
