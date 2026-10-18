import { useState } from 'react'
import { navigateSub, useSubPath } from '../app/routes'
import { PushScreen } from '../shell/PushScreen'
import { DeckList } from './DeckList'
import { DeckScreen } from './DeckScreen'

/** Вкладка «Слова»: список колод, поверх него въезжает колода (адрес #/words/<id>). */
export function WordsTab() {
  const deckId = useSubPath().split('/')[0] || null
  // Пока колода уезжает, на ней остаётся та же колода.
  const [shownId, setShownId] = useState(deckId)
  if (deckId && deckId !== shownId) setShownId(deckId)
  return (
    <>
      <div className="absolute inset-0" inert={deckId ? true : undefined}>
        <DeckList />
      </div>
      <PushScreen open={!!deckId} onClose={() => navigateSub('words')}>
        {shownId && <DeckScreen deckId={shownId} />}
      </PushScreen>
    </>
  )
}
