import { useRef, useState, type ReactNode } from 'react'
import { useDrawer } from '../ui/motion/useDrawer'

interface PushScreenProps {
  open: boolean
  /** Смахнули вправо — экран уже уехал (родитель уходит назад) */
  onClose: () => void
  children: ReactNode
}

/**
 * Вложенный экран, как в iOS (DESIGN.md → «Движение»): въезжает справа поверх
 * предыдущего, тот слегка темнеет. Назад — смахнуть вправо (тянет прокрутка iPhone)
 * или кнопкой «назад» (родитель ставит open=false — экран уезжает пружиной).
 */
export function PushScreen(props: PushScreenProps) {
  const [mounted, setMounted] = useState(props.open)
  if (props.open && !mounted) setMounted(true)
  if (!mounted) return null
  return <Pane {...props} onGone={() => setMounted(false)} />
}

function Pane({ open, onClose, children, onGone }: PushScreenProps & { onGone: () => void }) {
  const { scrollerRef, dimRef, scrollerProps } = useDrawer({ open, axis: 'x', onClose, onGone })
  // Пока уезжает, показываем то же, что было (родитель уже сменил адрес).
  const shown = useRef(children)
  if (open) shown.current = children

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <div ref={dimRef} className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-overlay opacity-50" />
      </div>
      <div ref={scrollerRef} {...scrollerProps} className="absolute inset-0 flex snap-x snap-mandatory overflow-x-scroll overscroll-x-none no-scrollbar">
        <div className="h-full w-full shrink-0 snap-start" />
        <div className="relative h-full w-full shrink-0 snap-end bg-bg">{shown.current}</div>
      </div>
    </div>
  )
}
