import { Share, SquarePlus, ToggleRight, type LucideIcon } from 'lucide-react'
import { feedback } from '../feedback/feedback'
import { Mascot } from '../ui/Mascot'

const STEPS: { icon: LucideIcon; text: string }[] = [
  { icon: Share, text: 'Нажми «Поделиться» внизу Safari (в iOS 26 — сначала «•••»)' },
  { icon: SquarePlus, text: 'Выбери «На экран „Домой“»' },
  { icon: ToggleRight, text: 'Включи «Открыть как веб-приложение» и нажми «Добавить»' },
]

/** SPEC 7.6: в обычной вкладке Safari — просим установить на экран Домой (DESIGN.md → «Экран-инструкция»). */
export function InstallScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-bg pt-[calc(24px+var(--safe-top))] pr-[calc(16px+var(--safe-right))] pb-[calc(16px+var(--safe-bottom))] pl-[calc(16px+var(--safe-left))]">
      <div className="mx-auto flex min-h-full max-w-[420px] flex-col">
        <div className="flex flex-col items-center text-center">
          <Mascot size={120} />
          <h1 className="m-0 mt-4 text-title font-black text-text">Добавь Спарки на экран Домой</h1>
          <p className="m-0 mt-2 text-body font-semibold text-muted">
            Так Спарки откроется на весь экран и будет работать без интернета. Слова из этой вкладки туда не
            переносятся — поэтому лучше начать сразу там.
          </p>
        </div>

        <ol className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {STEPS.map(({ icon: Icon, text }, i) => (
            <li
              key={text}
              className="flex min-h-16 items-center gap-3 rounded-card border-2 border-border bg-surface px-4 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info text-small font-black text-on-color">
                {i + 1}
              </span>
              <span className="flex-1 text-body font-bold text-text">{text}</span>
              <Icon size={26} className="shrink-0 text-info-ink" aria-hidden />
            </li>
          ))}
        </ol>

        <p className="m-0 mt-4 text-center text-small font-semibold text-muted">
          Потом открывай Спарки с иконки на экране Домой.
        </p>

        <div className="mt-auto flex justify-center pt-6">
          <button
            type="button"
            onClick={() => {
              feedback('tap')
              onContinue()
            }}
            className="min-h-11 rounded-card px-4 text-small font-extrabold text-info-ink active:bg-surface"
          >
            Всё равно продолжить в браузере
          </button>
        </div>
      </div>
    </div>
  )
}
