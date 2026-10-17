import { AnimatePresence, motion } from 'motion/react'
import type { TabRoute } from '../app/routes'
import { ProfileScreen } from '../screens/ProfileScreen'
import { PlaceholderScreen } from './Screen'
import { TabBar } from './TabBar'

function TabScreen({ route }: { route: TabRoute }) {
  switch (route) {
    case 'path':
      return <PlaceholderScreen title="Путь" text="Скоро здесь будет дорожка уроков. Шаг за шагом!" />
    case 'words':
      return <PlaceholderScreen title="Слова" text="Скоро здесь будут твои колоды и слова." />
    case 'stats':
      return <PlaceholderScreen title="Статистика" text="Скоро здесь будет видно, как растут твои знания." />
    case 'profile':
      return <ProfileScreen />
  }
}

// Смена вкладки: старый экран быстро гаснет, новый мягко проявляется (DESIGN.md → «Движение»).
const SCREEN_VARIANTS = {
  enter: { opacity: 0, scale: 0.985 },
  center: { opacity: 1, scale: 1, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } },
} as const

/** Оболочка: экран + нижняя панель вкладок. */
export function Shell({ route }: { route: TabRoute }) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={route}
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
