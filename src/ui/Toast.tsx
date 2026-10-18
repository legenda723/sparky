import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { feedback } from '../feedback/feedback'

export interface ToastOptions {
  message: string
  /** Если задано — кнопка «Отменить», тост держится 5 с */
  onUndo?: () => void
  /** Своя кнопка вместо «Отменить» (например, «Обновить») */
  action?: { label: string; onClick: () => void }
  /** Сколько держать, мс (по умолчанию 2,5 с, с кнопкой — 5 с) */
  durationMs?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

/** Тост сверху под safe-area (DESIGN.md → «Тост»): 2,5 с, с «Отменить» — 5 с. Можно смахнуть вверх. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const nextId = useRef(1)
  // Пока палец на тосте, он не исчезает сам.
  const touching = useRef(false)
  const expired = useRef(false)

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: nextId.current++ })
  }, [])

  useEffect(() => {
    if (!toast) return
    expired.current = false
    const ms = toast.durationMs ?? (toast.onUndo || toast.action ? 5000 : 2500)
    const timer = setTimeout(() => {
      if (touching.current) expired.current = true
      else setToast(null)
    }, ms)
    return () => clearTimeout(timer)
  }, [toast])

  const release = () => {
    touching.current = false
    if (expired.current) setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, transform: 'translateY(-24px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-24px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            >
              <SwipeAway
                onTouch={() => (touching.current = true)}
                onRelease={release}
                onGone={() => {
                  touching.current = false
                  setToast(null)
                }}
              >
                <div
                  role="status"
                  className="flex min-h-14 w-full max-w-[420px] items-center gap-3 rounded-card border-2 border-border bg-bg py-2 pr-2 pl-4 shadow-[0_4px_0_var(--c-border)]"
                >
                  <span className="flex-1 text-small font-bold text-text">{toast.message}</span>
                  {(toast.action || toast.onUndo) && (
                    <button
                      type="button"
                      onClick={() => {
                        feedback('tap')
                        if (toast.action) toast.action.onClick()
                        else toast.onUndo?.()
                        setToast(null)
                      }}
                      className="h-11 rounded-card px-3 text-small font-extrabold tracking-[0.04em] text-info-ink uppercase active:bg-surface"
                    >
                      {toast.action ? toast.action.label : 'Отменить'}
                    </button>
                  )}
                </div>
              </SwipeAway>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/**
 * «Смахнуть вверх» на встроенной прокрутке (DESIGN.md → «Движение», правило 3): прокрутка с двумя
 * положениями — тост и пустое место под ним. Палец и инерция — родные; доехал до пустого места — тост убран.
 */
function SwipeAway({ children, onTouch, onRelease, onGone }: { children: ReactNode; onTouch: () => void; onRelease: () => void; onGone: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const item = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  const gone = useRef(false)

  // Высота тоста (одна или две строки) — столько же пустого места под ним.
  useLayoutEffect(() => {
    if (item.current) setHeight(item.current.offsetHeight)
  }, [])

  const onScroll = () => {
    const el = scroller.current
    if (!el || !height || gone.current) return
    if (el.scrollTop >= height - 2) {
      gone.current = true
      onGone()
    }
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      onTouchStart={onTouch}
      onTouchEnd={onRelease}
      onTouchCancel={onRelease}
      style={{ height }}
      className="pointer-events-auto snap-y snap-mandatory overflow-y-auto overscroll-contain no-scrollbar"
    >
      <div ref={item} className="flex snap-start justify-center px-4 pt-[calc(8px+var(--safe-top))] pb-2">
        {children}
      </div>
      {height !== undefined && <div aria-hidden className="snap-start" style={{ height }} />}
    </div>
  )
}
