import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { feedback } from '../feedback/feedback'

export interface ToastOptions {
  message: string
  /** Если задано — кнопка «Отменить», тост держится 5 с */
  onUndo?: () => void
}

interface ToastItem extends ToastOptions {
  id: number
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

/** Тост сверху под safe-area (DESIGN.md → «Тост»): 2,5 с, с «Отменить» — 5 с. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const nextId = useRef(1)

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: nextId.current++ })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.onUndo ? 5000 : 2500)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(8px+var(--safe-top))] z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              className="pointer-events-auto flex min-h-14 w-full max-w-[420px] items-center gap-3 rounded-card border-2 border-border bg-bg py-2 pr-2 pl-4 shadow-[0_4px_0_var(--c-border)]"
            >
              <span className="flex-1 text-small font-bold text-text">{toast.message}</span>
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    feedback('tap')
                    toast.onUndo?.()
                    setToast(null)
                  }}
                  className="h-11 rounded-card px-3 text-small font-extrabold tracking-[0.04em] text-info-ink uppercase active:bg-surface"
                >
                  Отменить
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
