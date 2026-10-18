import { AnimatePresence, motion } from 'motion/react'
import { useSubPath } from '../app/routes'
import { screenFade } from '../shell/screenFade'
import { DeckList } from './DeckList'
import { DeckScreen } from './DeckScreen'

// Чуть дольше, чем у вкладок: экран колоды плотный, быстрое проявление выглядит резко.
const FADE = screenFade(() => 0.26)

/** Вкладка «Слова»: список колод ↔ колода (адрес #/words/<id>). */
export function WordsTab() {
  const deckId = useSubPath().split('/')[0] || null
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={deckId ?? 'list'}
        variants={FADE}
        initial="enter"
        animate="center"
        exit="exit"
        className="absolute inset-0"
      >
        {deckId ? <DeckScreen deckId={deckId} /> : <DeckList />}
      </motion.div>
    </AnimatePresence>
  )
}
