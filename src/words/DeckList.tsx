import { ArrowUpDown, Plus } from 'lucide-react'
import { Reorder } from 'motion/react'
import { useState } from 'react'
import { navigateSub } from '../app/routes'
import { db } from '../db/db'
import { listDecks, reorderDecks, restoreDeck } from '../db/decks'
import { useCachedLiveQuery } from '../db/liveCache'
import { Screen } from '../shell/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { IconButton } from '../ui/IconButton'
import { TextButton } from '../ui/TextButton'
import { useToast } from '../ui/Toast'
import { DeckEditor } from './DeckEditor'
import { loadDeckStats } from './deckStats'
import { DeckTile, DeckTileDraggable } from './DeckTile'
import { KEYS } from './prefetch'

/** Список колод (SPEC 7.3). */
export function DeckList() {
  const decks = useCachedLiveQuery(KEYS.decks, () => listDecks(db), [])
  const stats = useCachedLiveQuery(KEYS.stats, () => loadDeckStats(db), [])
  const [creating, setCreating] = useState(false)
  const [order, setOrder] = useState<string[] | null>(null)
  const toast = useToast()

  if (!decks) return <Screen title="Слова">{null}</Screen>

  const first = decks.length === 0
  const finishOrder = async () => {
    if (order) await reorderDecks(db, order)
    setOrder(null)
  }

  const action =
    order !== null ? (
      <TextButton onClick={() => void finishOrder()}>Готово</TextButton>
    ) : decks.length > 1 ? (
      <IconButton label="Порядок колод" onClick={() => setOrder(decks.map((d) => d.id))}>
        <ArrowUpDown size={24} />
      </IconButton>
    ) : null

  return (
    <Screen title="Слова" action={action}>
      {first ? (
        <EmptyState
          title="Здесь будут твои слова"
          text="Добавляй слова, которые встречаешь, — Спарки поможет их запомнить."
        >
          <Button block icon={<Plus size={22} strokeWidth={3} />} onClick={() => setCreating(true)}>
            Добавить первые слова
          </Button>
        </EmptyState>
      ) : order !== null ? (
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="m-0 flex flex-col gap-3 p-0 pb-1">
          {order.map((id) => {
            const deck = decks.find((d) => d.id === id)
            return deck ? <DeckTileDraggable key={id} deck={deck} stats={stats?.get(id)} /> : null
          })}
        </Reorder.Group>
      ) : (
        <div className="flex flex-col gap-3 pb-1">
          {decks.map((deck) => (
            <DeckTile key={deck.id} deck={deck} stats={stats?.get(deck.id)} onOpen={() => navigateSub('words', deck.id)} />
          ))}
          <Button variant="secondary" block className="mt-2" icon={<Plus size={22} strokeWidth={3} />} onClick={() => setCreating(true)}>
            Новая колода
          </Button>
        </div>
      )}

      <DeckEditor
        open={creating}
        defaultTitle={first ? 'Мои слова' : ''}
        onClose={() => setCreating(false)}
        onCreated={(deck) => {
          // В первый раз сразу ведём в колоду — добавлять слова.
          if (first) navigateSub('words', deck.id)
          else toast({ message: `Колода «${deck.title}» создана` })
        }}
      />
    </Screen>
  )
}

/** Тост «Колода удалена · ОТМЕНИТЬ» — общий для списка и экрана колоды. */
export function useDeckDeletedToast() {
  const toast = useToast()
  return (title: string, id: string, stamp: number) =>
    toast({
      message: `Колода «${title}» удалена`,
      onUndo: () => void restoreDeck(db, id, stamp),
    })
}
