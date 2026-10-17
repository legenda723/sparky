import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { TABS, type TabRoute } from '../app/routes'
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

/** Оболочка: экран + нижняя панель вкладок. Переход — короткий сдвиг + прозрачность. */
export function Shell({ route }: { route: TabRoute }) {
  // Направление сдвига: вправо по списку вкладок — экран приезжает справа.
  const [last, setLast] = useState({ route, direction: 1 })
  if (last.route !== route) {
    setLast({ route, direction: TABS.indexOf(route) > TABS.indexOf(last.route) ? 1 : -1 })
  }
  const direction = last.route === route ? last.direction : 1

  return (
    <div className="flex h-full flex-col bg-bg">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={route}
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: 24 * d }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: -24 * d }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
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
