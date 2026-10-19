import { ChevronLeft } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { IconButton } from '../ui/IconButton'
import { Mascot } from '../ui/Mascot'

interface ScreenProps {
  title: string
  /** Вложенный экран: кнопка «назад» слева от заголовка */
  onBack?: () => void
  /** Кнопка справа от заголовка */
  action?: ReactNode
  children: ReactNode
  /** Прокручиваемая область — например, чтобы доехать до нужного места. */
  scrollRef?: Ref<HTMLDivElement>
}

/** Прокручиваемая область экрана с отступами от «острова». */
export function Screen({ title, onBack, action, children, scrollRef }: ScreenProps) {
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain pt-[calc(12px+var(--safe-top))] pr-[calc(16px+var(--safe-right))] pb-6 pl-[calc(16px+var(--safe-left))]">
      <div className="mb-4 flex min-h-11 items-center gap-1">
        {onBack && (
          <IconButton label="Назад" onClick={onBack} className="-ml-3 text-text">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </IconButton>
        )}
        <h1 className="m-0 min-w-0 flex-1 truncate text-title font-black text-text">{title}</h1>
        {action}
      </div>
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
