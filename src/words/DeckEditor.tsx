import { Check, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { createDeck, deleteDeck, updateDeck } from '../db/decks'
import type { Deck, DeckColor } from '../db/types'
import { feedback } from '../feedback/feedback'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
import { Sheet } from '../ui/Sheet'
import { TextField } from '../ui/TextField'
import { usePress } from '../ui/usePress'
import { DECK_COLOR_ORDER, DECK_COLORS, DECK_EMOJIS } from './deckLook'

interface DeckEditorProps {
  open: boolean
  /** Есть — правим эту колоду, нет — создаём новую */
  deck?: Deck
  /** Название новой колоды по умолчанию */
  defaultTitle?: string
  onClose: () => void
  onCreated?: (deck: Deck) => void
  onDeleted?: (deck: Deck, stamp: number) => void
}

/** Создание и правка колоды: название, эмодзи, цвет; удаление. */
export function DeckEditor({ open, deck, defaultTitle = '', onClose, onCreated, onDeleted }: DeckEditorProps) {
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState(DECK_EMOJIS[0])
  const [color, setColor] = useState<DeckColor>('green')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Каждое открытие — с актуальными значениями.
  useEffect(() => {
    if (!open) return
    setTitle(deck?.title ?? defaultTitle)
    setEmoji(deck?.emoji ?? DECK_EMOJIS[0])
    setColor(deck?.color ?? 'green')
    // Только при открытии: обновления колоды из базы не сбивают ввод.
  }, [open, deck?.id, defaultTitle])

  const valid = title.trim().length > 0

  const save = async () => {
    if (!valid) return
    if (deck) {
      await updateDeck(db, deck.id, { title, emoji, color })
      onClose()
    } else {
      const created = await createDeck(db, { title, emoji, color })
      onClose()
      onCreated?.(created)
    }
  }

  const remove = async () => {
    if (!deck) return
    const stamp = await deleteDeck(db, deck.id)
    setConfirmDelete(false)
    onClose()
    onDeleted?.(deck, stamp)
  }

  return (
    <>
      <FormSheet
        open={open}
        title={deck ? 'Колода' : 'Новая колода'}
        onCancel={onClose}
        onDone={() => void save()}
        doneDisabled={!valid}
      >
        <TextField
          label="Название"
          value={title}
          maxLength={40}
          placeholder="Например, Еда"
          enterKeyHint="done"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        <section>
          <h3 className="m-0 mb-2 text-small font-bold text-muted">Цвет</h3>
          <div role="radiogroup" aria-label="Цвет" className="flex flex-wrap gap-1">
            {DECK_COLOR_ORDER.map((c) => (
              <ColorDot key={c} color={c} selected={c === color} onSelect={() => setColor(c)} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="m-0 mb-2 text-small font-bold text-muted">Значок</h3>
          <div role="radiogroup" aria-label="Значок" className="grid grid-cols-6 gap-2">
            {DECK_EMOJIS.map((e) => (
              <EmojiCell key={e} emoji={e} selected={e === emoji} onSelect={() => setEmoji(e)} />
            ))}
          </div>
        </section>

        {deck && (
          <Button
            variant="secondary"
            block
            icon={<Trash2 size={20} />}
            className="mt-2 text-danger-ink!"
            onClick={() => setConfirmDelete(true)}
          >
            Удалить колоду
          </Button>
        )}
      </FormSheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Удалить «${deck?.title ?? ''}»?`}
        text="Колода и все её слова пропадут из списка. Пять секунд можно будет отменить."
      >
        <Button variant="danger" block onClick={() => void remove()}>
          Удалить
        </Button>
        <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
          Оставить
        </Button>
      </Sheet>
    </>
  )
}

function ColorDot({ color, selected, onSelect }: { color: DeckColor; selected: boolean; onSelect: () => void }) {
  const { pressed, pressHandlers } = usePress()
  const c = DECK_COLORS[color]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={c.label}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onSelect()
      }}
      className="press-soft flex size-11 items-center justify-center rounded-full"
    >
      <span
        className="flex size-10 items-center justify-center rounded-full text-on-color"
        style={{
          background: c.fill,
          boxShadow: selected ? `0 0 0 3px var(--c-bg), 0 0 0 5px ${c.fill}` : undefined,
          scale: selected ? '0.8' : '1',
          transition: 'scale 340ms cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 200ms ease-out',
        }}
      >
        {selected && <Check size={22} strokeWidth={3} />}
      </span>
    </button>
  )
}

function EmojiCell({ emoji, selected, onSelect }: { emoji: string; selected: boolean; onSelect: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={emoji}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onSelect()
      }}
      className={`press-soft flex h-12 items-center justify-center rounded-[14px] border-2 text-[26px] leading-none ${selected ? 'border-info bg-info-tint' : 'border-transparent'}`}
    >
      {emoji}
    </button>
  )
}
