import { BarChart3, BookOpen, Route as RouteIcon, User, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { feedback } from '../feedback/feedback'
import { navigate, type TabRoute } from '../app/routes'

const ITEMS: { route: TabRoute; label: string; Icon: LucideIcon }[] = [
  { route: 'path', label: 'Путь', Icon: RouteIcon },
  { route: 'words', label: 'Слова', Icon: BookOpen },
  { route: 'stats', label: 'Статистика', Icon: BarChart3 },
  { route: 'profile', label: 'Профиль', Icon: User },
]

/** Нижняя панель вкладок (DESIGN.md → «Нижняя панель вкладок»). */
export function TabBar({ active }: { active: TabRoute }) {
  return (
    <nav
      aria-label="Разделы"
      className="shrink-0 border-t-2 border-border bg-bg pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)]"
    >
      <ul className="m-0 flex h-[var(--tabbar-h)] list-none items-center justify-around gap-1 p-0 px-2">
        {ITEMS.map(({ route, label, Icon }) => {
          const isActive = route === active
          return (
            <li key={route} className="flex flex-1 justify-center">
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  feedback('tap')
                  if (!isActive) navigate(route)
                }}
                className={`relative flex h-14 w-full max-w-[88px] flex-col items-center justify-center gap-0.5 rounded-card ${isActive ? 'text-info-ink' : 'text-muted'}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-card bg-surface"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                <motion.span
                  className="relative"
                  animate={isActive ? { scale: [1, 1.25, 0.95, 1], y: [0, -3, 0, 0] } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <Icon size={28} strokeWidth={isActive ? 2.75 : 2.25} />
                </motion.span>
                <span className="relative text-caption font-extrabold">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
