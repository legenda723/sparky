import { motion, useReducedMotion } from 'motion/react'

interface ProgressBarProps {
  /** 0–1 */
  value: number
  label?: string
  /** Цвет заливки (по умолчанию — основной зелёный; уровень в «Профиле» — `bg-xp`). */
  colorClass?: string
  /** Тонкий — 10 вместо 16 (шапка «Профиля»). */
  small?: boolean
}

/** Прогресс-бар (DESIGN.md → «Прогресс-бар»): плавно заполняется, с бликом сверху. */
export function ProgressBar({ value, label = 'Прогресс', colorClass = 'bg-primary', small }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value))
  // Ширину Motion сам не глушит при «Уменьшении движения» — делаем мгновенной.
  const reduce = useReducedMotion()
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`${small ? 'h-2.5 rounded-[5px]' : 'h-4 rounded-lg'} w-full overflow-hidden bg-border`}
    >
      <motion.div
        className={`relative h-full ${small ? 'rounded-[5px]' : 'rounded-lg'} ${colorClass}`}
        style={{ minWidth: v > 0 ? (small ? 10 : 16) : 0 }}
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 24 }}
      >
        <span className={`absolute right-2 left-2 rounded-full bg-on-color/35 ${small ? 'top-[2px] h-[3px]' : 'top-[3px] h-1'}`} />
      </motion.div>
    </div>
  )
}
