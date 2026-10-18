import type { ReactNode } from 'react'
import { SheetFrame } from './SheetFrame'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  text?: ReactNode
  /** Кнопки во всю ширину (опасное действие — опасная кнопка) */
  children?: ReactNode
}

/** Окно подтверждения / нижний лист (DESIGN.md): выезжает снизу, под ним затемнение; закрывается касанием мимо или свайпом вниз. */
export function Sheet({ open, onClose, title, text, children }: SheetProps) {
  return (
    <SheetFrame
      open={open}
      label={title}
      onClose={onClose}
      closeOnOverlay
      layer="z-40"
      className="flex flex-col gap-3 px-4 pt-6 pb-[calc(16px+var(--safe-bottom))]"
    >
      <div className="flex flex-col gap-3">
        <h2 className="m-0 text-center text-heading font-black text-text">{title}</h2>
        {text && <p className="m-0 text-center text-small font-semibold text-muted">{text}</p>}
      </div>
      {children && <div className="mt-2 flex flex-col gap-3">{children}</div>}
    </SheetFrame>
  )
}
