import { ClipboardPaste, ImagePlus, Mic, Square, Volume2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import type { MediaInput } from '../db/cards'
import { feedback } from '../feedback/feedback'
import { compressImage, readClipboardImage } from '../media/image'
import { MAX_RECORD_MS, useRecorder } from '../media/recorder'
import { Button } from '../ui/Button'
import { TextButton } from '../ui/TextButton'
import { useToast } from '../ui/Toast'
import { usePress } from '../ui/usePress'
import { useBlobUrl } from './useMediaUrl'

interface FieldProps {
  /** Что сейчас показать: сохранённое или только что выбранное */
  blob: Blob | undefined
  onChange: (input: MediaInput) => void
}

function Label({ children }: { children: string }) {
  return <h3 className="m-0 mb-1.5 text-small font-bold text-muted">{children}</h3>
}

/** Фото карточки (DESIGN.md → «Фото карточки»): галерея/камера, вставка из буфера, замена, «Убрать». */
export function ImageField({ blob, onChange }: FieldProps) {
  const input = useRef<HTMLInputElement>(null)
  const url = useBlobUrl(blob)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const take = async (file: Blob | null) => {
    if (!file) {
      toast({ message: 'В буфере нет картинки' })
      return
    }
    setBusy(true)
    try {
      onChange(await compressImage(file))
    } catch {
      toast({ message: 'Не получилось открыть картинку' })
    } finally {
      setBusy(false)
    }
  }

  const paste = async () => {
    try {
      await take(await readClipboardImage())
    } catch {
      toast({ message: 'Не получилось вставить картинку' })
    }
  }

  return (
    <section>
      <Label>Фото (необязательно)</Label>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void take(file)
        }}
      />
      {url ? (
        <>
          <img src={url} alt="Фото карточки" className="block max-h-[200px] w-full rounded-card border-2 border-border bg-surface object-contain" />
          <div className="mt-1 flex justify-center gap-2">
            <TextButton onClick={() => input.current?.click()}>Заменить</TextButton>
            <TextButton danger onClick={() => onChange(null)}>
              Убрать
            </TextButton>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} icon={<ImagePlus size={22} />} onClick={() => input.current?.click()}>
            Фото
          </Button>
          <Button variant="secondary" disabled={busy} icon={<ClipboardPaste size={22} />} onClick={() => void paste()}>
            Вставить
          </Button>
        </div>
      )}
    </section>
  )
}

/** Своя запись произношения (DESIGN.md → «Запись произношения»). */
export function AudioField({ blob, onChange }: FieldProps) {
  const { state, elapsed, start, stop } = useRecorder((rec) => onChange(rec))
  const url = useBlobUrl(blob)
  const reduce = useReducedMotion()
  const recording = state === 'recording'
  const left = Math.max(0, Math.ceil((MAX_RECORD_MS - elapsed) / 1000))

  const play = () => {
    if (!url) return
    void new Audio(url).play().catch(() => {})
  }

  return (
    <section>
      <Label>Своё произношение (необязательно)</Label>
      {url && !recording ? (
        <div className="flex flex-col items-center gap-1">
          <Button variant="info" block icon={<Volume2 size={22} />} onClick={play}>
            Прослушать
          </Button>
          <div className="flex justify-center gap-2">
            <TextButton onClick={() => void start()}>Перезаписать</TextButton>
            <TextButton danger onClick={() => onChange(null)}>
              Убрать
            </TextButton>
          </div>
        </div>
      ) : state === 'unsupported' ? (
        <p className="m-0 text-caption font-bold text-muted">Здесь запись недоступна.</p>
      ) : (
        <div className="flex items-center gap-4">
          <RecordButton recording={recording} onPress={() => (recording ? stop() : void start())} />
          <span className="flex-1 text-small font-bold text-muted">
            {recording ? (
              <motion.span animate={reduce ? undefined : { opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                Говори… <span className="text-caption font-extrabold text-danger-ink">{left} с</span>
              </motion.span>
            ) : (
              'Нажми и скажи слово — до 5 секунд'
            )}
          </span>
        </div>
      )}
      {state === 'denied' && (
        <p className="m-0 mt-2 text-caption font-bold text-danger-ink">
          Нет доступа к микрофону. Разреши его в Настройках iPhone → Приложения → Safari → Микрофон.
        </p>
      )}
    </section>
  )
}

function RecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const { pressed, pressHandlers } = usePress()
  const reduce = useReducedMotion()
  return (
    <span className="relative flex size-16 shrink-0">
      {recording && !reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-4 border-danger"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeOut' }}
        />
      )}
      <button
        type="button"
        aria-label={recording ? 'Остановить запись' : 'Записать произношение'}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          if (!recording) feedback('tap')
          onPress()
        }}
        className="press-3d relative flex size-16 items-center justify-center rounded-full bg-danger text-on-color [--press-shadow:var(--c-danger-shadow)]"
      >
        {recording ? <Square size={24} fill="currentColor" /> : <Mic size={28} strokeWidth={2.5} />}
      </button>
    </span>
  )
}
