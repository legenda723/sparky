import { Snowflake, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addCard, updateCard, type CardText, type MediaInput } from '../db/cards'
import { db } from '../db/db'
import type { Card, Id } from '../db/types'
import { cardStatus, inHuman, recallChance } from '../srs/status'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
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

  // Каждое открытие — с актуальными значениями. Пока лист открыт, правки карточки снаружи не сбивают ввод.
  const cardId = card?.id
  useEffect(() => {
    if (!open) return
    setText({ ...EMPTY, ...(card ? pick(card) : {}) })
    setMedia({})
  }, [open, cardId])

  // Показываем только что выбранное, иначе сохранённое (null — владелец убрал).
  const savedImage = useMediaBlob(card?.imageId)
  const savedAudio = useMediaBlob(card?.audioId)
  const shown = (input: MediaInput, saved: Blob | undefined) => (input === undefined ? saved : (input?.blob ?? undefined))

  const set = (key: keyof CardText) => (e: { target: { value: string } }) => setText((t) => ({ ...t, [key]: e.target.value }))
  const valid = text.front.trim() !== '' && text.back.trim() !== ''
  const dup =
    text.front.trim() !== '' && existing.some((c) => c.id !== card?.id && normalizeWord(c.front) === normalizeWord(text.front))

  const save = async () => {
    if (!valid) return
    if (card) {
      await updateCard(db, card.id, text, media)
      onClose()
    } else {
      const added = await addCard(db, deckId, text, media)
      onClose()
      onAdded?.(added)
    }
  }

  return (
    <FormSheet open={open} title={card ? 'Слово' : 'Новое слово'} onCancel={onClose} onDone={() => void save()} doneDisabled={!valid}>
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
      <ImageField blob={shown(media.image, savedImage)} onChange={(image) => setMedia((m) => ({ ...m, image }))} />
      <AudioField blob={shown(media.audio, savedAudio)} onChange={(audio) => setMedia((m) => ({ ...m, audio }))} />
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
