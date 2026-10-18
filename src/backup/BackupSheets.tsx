import { CloudUpload, Share } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getPrefs, loadPrefs } from '../app/prefs'
import { changeTheme } from '../app/theme'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { feedback } from '../feedback/feedback'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/Toast'
import { BackupError, exportBackup, markBackedUp, parseBackup, replaceAll, type BackupSummary, type ParsedBackup, type PreparedBackup } from './backup'
import { formatSize } from './reminder'
import { prefetchWords } from '../words/prefetch'
import { saveFile } from './share'

/** «3 колоды · 412 слов · 5 фото · 2 записи» (нулевые фото и записи не пишем). */
export function summaryText(s: BackupSummary): string {
  const parts = [`${s.decks} ${plural(s.decks, 'колода', 'колоды', 'колод')}`, `${s.cards} ${plural(s.cards, 'слово', 'слова', 'слов')}`]
  if (s.images) parts.push(`${s.images} фото`)
  if (s.audios) parts.push(`${s.audios} ${plural(s.audios, 'запись', 'записи', 'записей')}`)
  return parts.join(' · ')
}

/** Состояние бэкапа для Профиля и итога урока. */
export function useBackupStatus() {
  return useCachedLiveQuery(
    'backup-status',
    async () => {
      const [profile, cards] = await Promise.all([db.profile.get('me'), db.cards.filter((c) => c.deletedAt === undefined).count()])
      return { lastBackupAt: profile?.lastBackupAt, nudgeAt: profile?.backupNudgeAt, hasCards: cards > 0 }
    },
    [],
  )
}

interface SaveBackupSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * «Сохранить копию»: файл готовится при открытии, владелец видит, что в нём и сколько весит,
 * и вторым касанием открывает меню «Поделиться» (iOS открывает его только сразу после касания).
 */
export function SaveBackupSheet({ open, onClose }: SaveBackupSheetProps) {
  const toast = useToast()
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setPrepared(null)
    setFailed(false)
    exportBackup(db)
      .then((p) => alive && setPrepared(p))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [open])

  const save = async () => {
    if (!prepared || busy) return
    setBusy(true)
    try {
      const result = await saveFile(prepared.text, prepared.fileName)
      if (result === 'cancelled') return
      await markBackedUp(db)
      feedback('correct')
      toast({ message: result === 'shared' ? 'Копия сохранена' : 'Файл скачан — он в «Загрузках»' })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const text = failed
    ? 'Не получилось собрать файл. Попробуй ещё раз.'
    : prepared
      ? `${summaryText(prepared.summary)}\nРазмер файла ${formatSize(prepared.size)}`
      : 'Собираю файл…'

  return (
    <Sheet open={open} onClose={onClose} title="Сохранить копию" text={<span className="whitespace-pre-line">{text}</span>}>
      <p className="m-0 text-center text-caption font-bold text-muted">
        В меню выбери «Сохранить в Файлы» → iCloud Drive
      </p>
      <Button block icon={<Share size={22} strokeWidth={2.75} />} disabled={!prepared || busy} silent onClick={() => void save()}>
        Сохранить
      </Button>
      <Button block variant="secondary" onClick={onClose}>
        Отмена
      </Button>
    </Sheet>
  )
}

/** Пауза между закрытием одного нижнего окна и открытием другого (основная часть пути шторки). */
const SHEET_SWAP_MS = 280

type RestoreStep = { kind: 'error'; message: string } | { kind: 'preview' | 'confirm' | 'busy'; parsed: ParsedBackup }

const fileDate = (d: Date) =>
  d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * «Восстановить»: выбрать файл → проверка → что внутри → предложение сначала сохранить текущее →
 * «Заменить всё» → ещё одно подтверждение. Открывается функцией pick() прямо из нажатия.
 */
export function useRestore() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<RestoreStep | null>(null)
  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const show = (s: RestoreStep) => {
    setStep(s)
    setOpen(true)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      show({ kind: 'preview', parsed: parseBackup(await file.text()) })
    } catch (e) {
      feedback('wrong')
      show({ kind: 'error', message: e instanceof BackupError ? e.message : 'Не получилось прочитать файл' })
    }
  }

  const replace = async (parsed: ParsedBackup) => {
    setStep({ kind: 'busy', parsed })
    try {
      await replaceAll(db, parsed.file)
    } catch {
      feedback('wrong')
      setStep({ kind: 'error', message: 'Не получилось восстановить. Данные на телефоне не изменились.' })
      return
    }
    // Данные уже заменены: обновляем то, что экраны держат в памяти (колоды, слова), и настройки.
    // Если не выйдет — всё подхватится при следующем открытии.
    await prefetchWords().catch(() => {})
    await loadPrefs()
      .then(() => changeTheme(getPrefs().theme))
      .catch(() => {})
    feedback('finish')
    toast({ message: 'Готово! Всё восстановлено из копии' })
    setOpen(false)
  }

  const pick = () => input.current?.click()

  let title = ''
  let text: ReactNode = null
  let buttons: ReactNode = null
  if (step?.kind === 'error') {
    title = 'Не получилось'
    text = step.message
    buttons = (
      <Button block variant="secondary" onClick={() => setOpen(false)}>
        Понятно
      </Button>
    )
  } else if (step?.kind === 'preview') {
    const { parsed } = step
    title = 'Восстановить из копии?'
    text = (
      <span className="whitespace-pre-line">
        {`Копия от ${fileDate(parsed.file.exportedAt)}\n${summaryText(parsed.summary)}\n\nВсё, что сейчас на телефоне, заменится данными из файла. Сначала можно сохранить копию текущих.`}
      </span>
    )
    buttons = (
      <>
        <Button
          block
          variant="secondary"
          icon={<CloudUpload size={22} strokeWidth={2.75} />}
          onClick={() => {
            // Второе окно — после того, как первое уехало: два выезжающих окна сразу не накладываем.
            setOpen(false)
            window.setTimeout(() => setSaveOpen(true), SHEET_SWAP_MS)
          }}
        >
          Сохранить текущее
        </Button>
        <Button block variant="danger" onClick={() => setStep({ kind: 'confirm', parsed })}>
          Заменить всё
        </Button>
      </>
    )
  } else if (step) {
    const { parsed } = step
    title = 'Точно заменить всё?'
    text = 'Слова и прогресс, которые сейчас на телефоне, сотрутся. Отменить это нельзя.'
    buttons = (
      <>
        <Button block variant="danger" disabled={step.kind === 'busy'} onClick={() => void replace(parsed)}>
          {step.kind === 'busy' ? 'Восстанавливаю…' : 'Да, заменить'}
        </Button>
        <Button block variant="secondary" disabled={step.kind === 'busy'} onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </>
    )
  }

  const busy = step?.kind === 'busy'
  const ui = (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void onFile(file)
        }}
      />
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={title} text={text}>
        {buttons}
      </Sheet>
      <SaveBackupSheet
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false)
          // После копии текущих данных — назад к восстановлению.
          if (step?.kind === 'preview') window.setTimeout(() => setOpen(true), SHEET_SWAP_MS)
        }}
      />
    </>
  )
  return { pick, ui }
}
