import { ClipboardPaste } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addCards } from '../db/cards'
import { db } from '../db/db'
import type { Card, Id } from '../db/types'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
import { ListRow } from '../ui/ListRow'
import { Switch } from '../ui/Switch'
import { TextButton } from '../ui/TextButton'
import { useToast } from '../ui/Toast'
import { parseList } from './parseList'

interface PasteListProps {
  open: boolean
  deckId: Id
  existing: Card[]
  onClose: () => void
}

const HINT = 'apple - яблоко\nrun | бежать | [rʌn] | I run every day. | Я бегаю каждый день.'

/** «Вставить списком» (SPEC 7.3): строка — карточка, предпросмотр, дубли подсвечены. */
export function PasteList({ open, deckId, existing, onClose }: PasteListProps) {
  const [input, setInput] = useState('')
  const [withDups, setWithDups] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  // Каждое открытие — с чистого листа, уже в первом кадре окна.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setInput('')
      setWithDups(false)
      setSaving(false)
    }
  }

  const parsed = useMemo(() => parseList(input, existing.map((c) => c.front)), [input, existing])
  const toAdd = parsed.cards.filter((c) => withDups || !c.duplicate)
  const dupCount = parsed.cards.length - parsed.cards.filter((c) => !c.duplicate).length
  const n = toAdd.length
  const label = n ? `Добавить ${n} ${plural(n, 'слово', 'слова', 'слов')}` : 'Добавить'

  const save = async () => {
    // Двойное касание (или обе кнопки «Добавить») не должно добавить список дважды.
    if (!n || saving) return
    setSaving(true)
    await addCards(db, deckId, toAdd.map((c) => c.text))
    onClose()
    toast({ message: `Добавлено: ${n} ${plural(n, 'слово', 'слова', 'слов')}` })
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setInput((v) => (v.trim() ? `${v.replace(/\s*$/, '')}\n${text}` : text))
    } catch {
      toast({ message: 'Не получилось — вставь в поле долгим нажатием' })
    }
  }

  return (
    <FormSheet open={open} title="Вставить списком" onCancel={onClose} onDone={() => void save()} doneLabel="Добавить" doneDisabled={!n || saving}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="paste-list" className="text-small font-bold text-muted">
            По строке на слово
          </label>
          <TextButton onClick={() => void pasteFromClipboard()} className="-mr-3 flex items-center gap-1.5">
            <ClipboardPaste size={18} /> Вставить
          </TextButton>
        </div>
        <textarea
          id="paste-list"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={HINT}
          rows={7}
          lang="en"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-[180px] w-full resize-none rounded-card border-2 border-border bg-surface px-4 py-3 text-body font-bold text-text outline-none transition-colors duration-200 placeholder:font-semibold placeholder:text-muted focus:border-info"
        />
        <p className="m-0 text-caption font-semibold text-muted">
          Коротко: <b className="font-extrabold">слово - перевод</b>. Полно: <b className="font-extrabold">слово | перевод | транскрипция | пример | перевод примера</b> — лишнее можно не писать.
        </p>
      </div>

      {(parsed.cards.length > 0 || parsed.errors.length > 0) && (
        <section>
          <h3 className="m-0 mb-2 text-small font-bold text-muted">
            Получилось: {parsed.cards.length}
            {dupCount > 0 && ` · уже есть: ${dupCount}`}
          </h3>
          {dupCount > 0 && (
            <div className="-mx-4 mb-2 border-t-2 border-border">
              <ListRow title="Добавить и повторы" right={<Switch label="Добавить и повторы" checked={withDups} onChange={setWithDups} />} />
            </div>
          )}
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {parsed.cards.map((c) => (
              <li
                key={c.line}
                className={`flex items-baseline gap-3 rounded-xl px-3 py-2 ${c.duplicate ? 'bg-danger-tint' : 'bg-surface'}`}
              >
                <span className="w-6 shrink-0 text-right text-caption font-bold text-muted">{c.line}</span>
                <span className="min-w-0 flex-1 text-small font-bold text-text">
                  <span lang="en" className="font-extrabold">
                    {c.text.front}
                  </span>{' '}
                  — {c.text.back}
                  {c.text.transcription && <span className="text-muted"> {c.text.transcription}</span>}
                  {c.text.example && <span className="block text-caption font-semibold text-muted">{c.text.example}</span>}
                </span>
                {c.duplicate && <span className="shrink-0 text-caption font-extrabold text-danger-ink">уже есть</span>}
              </li>
            ))}
            {parsed.errors.map((e) => (
              <li key={`e${e.line}`} className="flex items-baseline gap-3 rounded-xl bg-danger-tint px-3 py-2">
                <span className="w-6 shrink-0 text-right text-caption font-bold text-muted">{e.line}</span>
                <span className="min-w-0 flex-1 text-caption font-bold text-danger-ink">
                  {e.reason}: «{e.raw}»
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button block disabled={!n || saving} onClick={() => void save()}>
        {label}
      </Button>
    </FormSheet>
  )
}
