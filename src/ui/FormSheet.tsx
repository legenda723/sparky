import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'
import { SheetFrame, type SheetHandle } from './SheetFrame'
import { TextButton } from './TextButton'

interface FormSheetProps {
  open: boolean
  title: string
  onCancel: () => void
  onDone: () => void
  doneLabel?: string
  doneDisabled?: boolean
  children: ReactNode
  /** dismiss() — увезти лист и потом закрыть (после сохранения) */
  ref?: Ref<SheetHandle>
}

/** Полноэкранный лист (DESIGN.md): форма колоды, слова, «Вставить списком». Закрывается и свайпом вниз. */
export function FormSheet({ open, title, onCancel, onDone, doneLabel = 'Готово', doneDisabled, children, ref }: FormSheetProps) {
  const frame = useRef<SheetHandle>(null)
  useImperativeHandle(ref, () => ({ dismiss: async () => frame.current?.dismiss() }), [])
  return (
    <SheetFrame ref={frame} open={open} label={title} onClose={onCancel} layer="z-30" className="flex h-[calc(100%-8px-var(--safe-top))] flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-1 border-b-2 border-border px-1">
        <TextButton className="min-h-12! px-4! text-body!" onClick={() => void frame.current?.dismiss()}>
          Отмена
        </TextButton>
        <h2 className="m-0 min-w-0 flex-1 truncate text-center text-heading font-black text-text">{title}</h2>
        <TextButton className="min-h-12! px-4! text-body!" onClick={onDone} disabled={doneDisabled}>
          {doneLabel}
        </TextButton>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(24px+var(--safe-bottom))]">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </SheetFrame>
  )
}
