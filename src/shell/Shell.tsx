import { AnimatePresence, motion } from 'motion/react'
import type { TabRoute } from '../app/routes'
import { PathScreen } from '../screens/PathScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { PlaceholderScreen } from './Screen'
import { screenFade } from './screenFade'
import { WordsTab } from '../words/WordsTab'
import { TabBar } from './TabBar'

function TabScreen({ route }: { route: TabRoute }) {
  switch (route) {
    case 'path':
      return <PathScreen />
    case 'words':
      return <WordsTab />
    case 'stats':
      return <PlaceholderScreen title="Статистика" text="Скоро здесь будет видно, как растут твои знания." />
    case 'profile':
      return <ProfileScreen />
  }
}

// Смена вкладки: старый экран быстро гаснет, новый мягко проявляется (DESIGN.md → «Движение»).
// Профиль плотнее остальных экранов — проявляется чуть дольше, иначе смена выглядит резкой.
const enterDuration = (route: TabRoute) => (route === 'profile' ? 0.26 : 0.18)

const SCREEN_VARIANTS = screenFade((route: TabRoute) => enterDuration(route))

/** Оболочка: экран + нижняя панель вкладок. */
export function Shell({ route }: { route: TabRoute }) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={route}
            custom={route}
            variants={SCREEN_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
          >
            <TabScreen route={route} />
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar active={route} />
    </div>
  )
}
