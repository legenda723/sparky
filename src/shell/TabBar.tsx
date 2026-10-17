import { BarChart3, BookOpen, Route as RouteIcon, User, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { feedback } from '../feedback/feedback'
import { navigate, type TabRoute } from '../app/routes'
import { usePress } from '../ui/usePress'

const ITEMS: { route: TabRoute; label: string; Icon: LucideIcon }[] = [
  { route: 'path', label: 'Путь', Icon: RouteIcon },
  { route: 'words', label: 'Слова', Icon: BookOpen },
  { route: 'stats', label: 'Статистика', Icon: BarChart3 },
  { route: 'profile', label: 'Профиль', Icon: User },
]

// Мягкие пружины без долгого дрожания (DESIGN.md → «Движение»).
const PILL_SPRING = { type: 'spring', bounce: 0.15, duration: 0.45 } as const
const ICON_SPRING = { type: 'spring', stiffness: 420, damping: 18, mass: 0.6 } as const

/** Нижняя панель вкладок (DESIGN.md → «Нижняя панель вкладок»). */
export function TabBar({ active }: { active: TabRoute }) {
  return (
    <nav
      aria-label="Разделы"
      className="shrink-0 border-t-2 border-border bg-bg pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)]"
    >
      <ul className="m-0 flex h-[var(--tabbar-h)] list-none items-center justify-around gap-1 p-0 px-2">
        {ITEMS.map((item) => (
          <li key={item.route} className="flex flex-1 justify-center">
            <TabButton {...item} isActive={item.route === active} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TabButton({ route, label, Icon, isActive }: { route: TabRoute; label: string; Icon: LucideIcon; isActive: boolean }) {
  // Иконка сжимается сразу при касании, после отпускания пружинит обратно.
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      {...pressHandlers}
      onClick={() => {
        feedback('tap')
        if (!isActive) navigate(route)
      }}
      className={`relative flex h-14 w-full max-w-[88px] flex-col items-center justify-center gap-0.5 rounded-card transition-colors duration-200 ${isActive ? 'text-info-ink' : 'text-muted'}`}
    >
      {isActive && (
        <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-card bg-surface" transition={PILL_SPRING} />
      )}
      <motion.span className="relative" animate={{ scale: pressed ? 0.84 : 1 }} transition={ICON_SPRING}>
        <Icon size={28} strokeWidth={isActive ? 2.75 : 2.25} />
      </motion.span>
      <span className="relative text-caption font-extrabold">{label}</span>
    </button>
  )
}
