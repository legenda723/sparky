import type { ReactNode } from 'react'
import { Mascot } from '../ui/Mascot'

/** Прокручиваемая область экрана с отступами от «острова». */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain pt-[calc(12px+var(--safe-top))] pr-[calc(16px+var(--safe-right))] pb-6 pl-[calc(16px+var(--safe-left))]">
      <h1 className="m-0 mb-4 text-title font-black text-text">{title}</h1>
      {children}
    </div>
  )
}

/** Экран-заглушка (DESIGN.md → «Экран-заглушка»). */
export function PlaceholderScreen({ title, text }: { title: string; text: string }) {
  return (
    <Screen title={title}>
      <div className="flex flex-col items-center gap-4 pt-[12vh] text-center">
        <Mascot size={120} />
        <p className="m-0 max-w-[280px] text-body font-bold text-muted">{text}</p>
      </div>
    </Screen>
  )
}
