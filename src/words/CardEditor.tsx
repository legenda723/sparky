import { Snowflake, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { addCard, updateCard, type CardText, type MediaInput } from '../db/cards'
import { db } from '../db/db'
import type { Card, Id } from '../db/types'
import { cardStatus, inHuman, recallChance } from '../srs/status'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
import type { SheetHandle } from '../ui/SheetFrame'
import { ListRow } from '../ui/ListRow'
import { Switch } from '../ui/Switch'
import { TextField } from '../ui/TextField'
import { STATUS_LOOK } from './CardRow'
import { AudioField, ImageField } from './MediaFields'
import { normalizeWord } from './parseList'
import { useMediaBlob } from './useMediaUrl'

interface CardEditorProps {
  open: boolean
  deckId: Id
  /** Есть — правим, нет — новое слово */
  card?: Card
  /** Слова колоды — для пометки «уже есть» */
  existing: Card[]
  onClose: () => void
  onAdded?: (card: Card) => void
  onDelete?: (card: Card) => void
  onSuspend?: (card: Card, suspended: boolean) => void
}

const EMPTY: Required<CardText> = { front: '', back: '', transcription: '', example: '', exampleTranslation: '', note: '' }

// Английские поля: без автоисправления и заглавных.
const EN = { lang: 'en', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

export function CardEditor({ open, deckId, card, existing, onClose, onAdded, onDelete, onSuspend }: CardEditorProps) {
  const [text, setText] = useState(EMPTY)
  const [media, setMedia] = useState<{ image?: MediaInput; audio?: MediaInput }>({})
  const [saving, setSaving] = useState(false)
  const [recording, setRecording] = useState(false)
  const sheet = useRef<SheetHandle>(null)

  // Каждое открытие — с актуальными значениями, уже в первом кадре (не после него, иначе
  // окно выезжает пустым и поля «вспыхивают»). Пока лист открыт, правки снаружи не сбивают ввод.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText({ ...EMPTY, ...(card ? pick(card) : {}) })
      setMedia({})
      setSaving(false)
    }
  }

  // Показываем только что выбранное, иначе сохранённое (null — владелец убрал).
  const savedImage = useMediaBlob(card?.imageId)
  const savedAudio = useMediaBlob(card?.audioId)
  const shown = (input: MediaInput, saved: Blob | undefined) => (input === undefined ? saved : (input?.blob ?? undefined))

  const set = (key: keyof CardText) => (e: { target: { value: string } }) => setText((t) => ({ ...t, [key]: e.target.value }))
  const valid = text.front.trim() !== '' && text.back.trim() !== ''
  const dup =
    text.front.trim() !== '' && existing.some((c) => c.id !== card?.id && normalizeWord(c.front) === normalizeWord(text.front))

  const save = async () => {
    // Двойное касание не должно добавить слово дважды.
    if (!valid || saving) return
    setSaving(true)
    // Сохранили — лист уезжает сам и потом закрывается (без паузы перед уходом).
    if (card) {
      await updateCard(db, card.id, text, media)
      void sheet.current?.dismiss()
    } else {
      const added = await addCard(db, deckId, text, media)
      void sheet.current?.dismiss()
      onAdded?.(added)
    }
  }

  return (
    <FormSheet ref={sheet} open={open} title={card ? 'Слово' : 'Новое слово'} onCancel={onClose} onDone={() => void save()} doneDisabled={!valid || saving || recording}>
      {card && <CardInfo card={card} />}
      <TextField
        label="Английский"
        placeholder="apple"
        value={text.front}
        onChange={set('front')}
        {...EN}
        error={dup ? 'Такое слово уже есть в колоде' : undefined}
      />
      <TextField label="Перевод" placeholder="яблоко" value={text.back} onChange={set('back')} />
      <TextField label="Транскрипция (необязательно)" placeholder="[ˈæp.əl]" value={text.transcription} onChange={set('transcription')} {...EN} />
      <ImageField
        blob={shown(media.image, savedImage)}
        pending={media.image === undefined && !!card?.imageId && !savedImage}
        onChange={(image) => setMedia((m) => ({ ...m, image }))} />
      <AudioField
        blob={shown(media.audio, savedAudio)}
        pending={media.audio === undefined && !!card?.audioId && !savedAudio}
        onChange={(audio) => setMedia((m) => ({ ...m, audio }))}
        onRecordingChange={setRecording}
      />
      <TextField label="Пример (необязательно)" value={text.example} onChange={set('example')} lang="en" />
      <TextField label="Перевод примера (необязательно)" value={text.exampleTranslation} onChange={set('exampleTranslation')} />
      <TextField label="Заметка (необязательно)" value={text.note} onChange={set('note')} />

      {card && (
        <>
          <section className="-mx-4 border-t-2 border-border">
            <ListRow
              icon={<Snowflake size={24} className="text-info" />}
              title="Заморозить"
              subtitle="Слово не попадётся в уроках"
              right={<Switch label="Заморозить" checked={card.suspended} onChange={(v) => onSuspend?.(card, v)} />}
            />
          </section>
          <Button variant="secondary" block icon={<Trash2 size={20} />} className="text-danger-ink!" onClick={() => onDelete?.(card)}>
            Удалить слово
          </Button>
        </>
      )}
    </FormSheet>
  )
}

function pick(card: Card): CardText {
  const { front, back, transcription, example, exampleTranslation, note } = card
  return { front, back, transcription, example, exampleTranslation, note }
}

/** Человеческая информация о слове (SPEC 7.3). */
function CardInfo({ card }: { card: Card }) {
  const now = new Date()
  const status = cardStatus(card)
  const chance = recallChance(card, now)
  return (
    <div className="flex flex-col gap-1 rounded-card border-2 border-border bg-surface px-4 py-3">
      <span className="flex items-center gap-2 text-small font-extrabold text-text">
        <span className={`size-2.5 rounded-full ${STATUS_LOOK[status].dot}`} />
        {STATUS_LOOK[status].label}
      </span>
      {status === 'new' ? (
        <span className="text-small font-semibold text-muted">Ещё не учил — появится в уроке.</span>
      ) : (
        <>
          <span className="text-small font-semibold text-muted">Следующий показ: {inHuman(card.due, now)}</span>
          {chance !== null && (
            <span className="text-small font-semibold text-muted">Вспомнишь с вероятностью ~{Math.round(chance * 100)}%</span>
          )}
        </>
      )}
    </div>
  )
}
