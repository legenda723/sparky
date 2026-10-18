import { ClipboardList, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigateSub } from '../app/routes'
import { deleteCard, listCards, restoreCard, setSuspended } from '../db/cards'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import type { Card, Id } from '../db/types'
import { cardStatus } from '../srs/status'
import { Screen } from '../shell/Screen'
import { Button } from '../ui/Button'
import { ChoiceChips } from '../ui/ChoiceChips'
import { EmptyState } from '../ui/EmptyState'
import { IconButton } from '../ui/IconButton'
import { SearchField } from '../ui/SearchField'
import { useToast } from '../ui/Toast'
import { CardEditor } from './CardEditor'
import { CardRow } from './CardRow'
import { DeckEditor } from './DeckEditor'
import { useDeckDeletedToast } from './DeckList'
import { filterCards, type StatusFilter } from './filter'
import { PasteList } from './PasteList'
import { KEYS } from './prefetch'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'learning', label: 'Учатся' },
  { value: 'known', label: 'Знаю' },
  { value: 'mastered', label: 'Освоены' },
]

type Editing = { kind: 'new' } | { kind: 'edit'; id: Id } | null

/** Колода: поиск, фильтр, слова (SPEC 7.3). */
export function DeckScreen({ deckId }: { deckId: Id }) {
  // undefined — ещё грузится, null — такой колоды нет.
  const deck = useCachedLiveQuery(KEYS.deck(deckId), async () => (await db.decks.get(deckId)) ?? null, [deckId])
  const cards = useCachedLiveQuery(KEYS.cards(deckId), () => listCards(db, deckId), [deckId])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<Editing>(null)
  const [editingDeck, setEditingDeck] = useState(false)
  const [pasting, setPasting] = useState(false)
  // Пока лист слова уезжает вниз, в нём остаётся то же слово, а не пустая форма.
  const lastCard = useRef<Card | undefined>(undefined)
  const toast = useToast()
  const deckDeleted = useDeckDeletedToast()

  // Колоды нет (удалена или неверный адрес) — назад к списку. Решаем по базе, а не по памяти:
  // в памяти колода могла остаться удалённой, а её уже вернули («Отменить», восстановление из копии).
  const gone = deck === null || (deck !== undefined && deck.deletedAt !== undefined)
  useEffect(() => {
    if (!gone) return
    let alive = true
    void db.decks.get(deckId).then((fresh) => {
      if (alive && (!fresh || fresh.deletedAt !== undefined)) navigateSub('words')
    })
    return () => {
      alive = false
    }
  }, [gone, deckId])

  const openCard = useCallback((id: Id) => setEditing({ kind: 'edit', id }), [])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, new: 0, learning: 0, known: 0, mastered: 0 }
    for (const card of cards ?? []) {
      c.all++
      c[cardStatus(card)]++
    }
    return c
  }, [cards])

  if (!deck || !cards) {
    return (
      <Screen title="" onBack={() => navigateSub('words')}>
        {null}
      </Screen>
    )
  }

  const shown = filterCards(cards, filter, query)
  if (editing?.kind === 'edit') lastCard.current = cards.find((c) => c.id === editing.id) ?? lastCard.current
  else if (editing?.kind === 'new') lastCard.current = undefined
  const editingCard = lastCard.current

  const removeCard = async (card: Card) => {
    await deleteCard(db, card.id)
    setEditing(null)
    toast({ message: `«${card.front}» удалено`, onUndo: () => void restoreCard(db, card.id) })
  }

  return (
    <Screen
      title={`${deck.emoji} ${deck.title}`}
      onBack={() => navigateSub('words')}
      action={
        <IconButton label="Изменить колоду" large className="-mr-2 text-muted" onClick={() => setEditingDeck(true)}>
          <Pencil size={26} />
        </IconButton>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Button icon={<Plus size={22} strokeWidth={3} />} onClick={() => setEditing({ kind: 'new' })}>
          Слово
        </Button>
        <Button variant="secondary" icon={<ClipboardList size={22} />} onClick={() => setPasting(true)}>
          Списком
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState mascotSize={96} title="Пока пусто" text="Добавь слово или вставь сразу много — по строке на слово." />
      ) : (
        <>
          <div className="mb-3">
            <SearchField value={query} onChange={setQuery} placeholder="Найти слово" />
          </div>
          <div className="mb-3">
            <ChoiceChips
              scroll
              label="Показать"
              options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts[f.value]}` }))}
              value={filter}
              onChange={setFilter}
            />
          </div>
          {shown.length === 0 ? (
            <p className="m-0 py-8 text-center text-body font-bold text-muted">Ничего не нашлось</p>
          ) : (
            <section className="-mx-4 border-t-2 border-border">
              {shown.map((card) => (
                <CardRow key={card.id} card={card} onOpen={openCard} />
              ))}
            </section>
          )}
        </>
      )}

      <CardEditor
        open={editing !== null}
        deckId={deckId}
        card={editingCard}
        existing={cards}
        onClose={() => setEditing(null)}
        onAdded={(card) => toast({ message: `«${card.front}» добавлено` })}
        onDelete={(card) => void removeCard(card)}
        onSuspend={(card, v) => void setSuspended(db, card.id, v)}
      />
      <DeckEditor
        open={editingDeck}
        deck={deck}
        onClose={() => setEditingDeck(false)}
        onDeleted={(d, stamp) => deckDeleted(d.title, d.id, stamp)}
      />
      <PasteList open={pasting} deckId={deckId} existing={cards} onClose={() => setPasting(false)} />
    </Screen>
  )
}
