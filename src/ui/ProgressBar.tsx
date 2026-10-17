import { motion, useReducedMotion } from 'motion/react'

interface ProgressBarProps {
  /** 0–1 */
  value: number
  label?: string
}

/** Прогресс-бар (DESIGN.md → «Прогресс-бар»): плавно заполняется, с бликом сверху. */
export function ProgressBar({ value, label = 'Прогресс' }: ProgressBarProps) {
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
      className="h-4 w-full overflow-hidden rounded-lg bg-border"
    >
      <motion.div
        className="relative h-full rounded-lg bg-primary"
        style={{ minWidth: v > 0 ? 16 : 0 }}
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 24 }}
      >
        <span className="absolute top-[3px] right-2 left-2 h-1 rounded-full bg-on-color/35" />
      </motion.div>
    </div>
  )
}
