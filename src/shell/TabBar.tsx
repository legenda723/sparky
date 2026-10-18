import { BarChart3, BookOpen, Route as RouteIcon, User, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { feedback } from '../feedback/feedback'
import { navigate, type TabRoute } from '../app/routes'
import { springCurve } from '../ui/motion/spring'
import { usePress } from '../ui/usePress'

const ITEMS: { route: TabRoute; label: string; Icon: LucideIcon }[] = [
  { route: 'path', label: 'Путь', Icon: RouteIcon },
  { route: 'words', label: 'Слова', Icon: BookOpen },
  { route: 'stats', label: 'Статистика', Icon: BarChart3 },
  { route: 'profile', label: 'Профиль', Icon: User },
]

// Мягкие пружины без долгого дрожания, на видеокарте (DESIGN.md → «Движение»).
const PILL = springCurve({ response: 0.3, damping: 0.9 }, 100)
const ICON_UP = springCurve({ response: 0.28, damping: 0.6 }, 10)

/** Нижняя панель вкладок (DESIGN.md → «Нижняя панель вкладок»). */
export function TabBar({ active }: { active: TabRoute }) {
  const list = useRef<HTMLUListElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  // Подложка-пилюля одна на всю панель и переезжает сдвигом (transform) под активную вкладку.
  const place = useCallback((animate: boolean) => {
    const btn = list.current?.querySelector<HTMLElement>('[aria-current="page"]')
    const p = pill.current
    if (!btn || !p) return
    p.style.transition = animate && placed.current ? `transform ${PILL.ms}ms ${PILL.easing}` : 'none'
    p.style.width = `${btn.offsetWidth}px`
    p.style.height = `${btn.offsetHeight}px`
    p.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`
    placed.current = true
  }, [])
  useLayoutEffect(() => place(true), [active, place])
  useEffect(() => {
    const onResize = () => place(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [place])

  return (
    <nav
      aria-label="Разделы"
      className="shrink-0 border-t-2 border-border bg-bg pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)]"
    >
      <ul ref={list} className="relative m-0 flex h-[var(--tabbar-h)] list-none items-center justify-around gap-1 p-0 px-2">
        <span ref={pill} aria-hidden className="absolute top-0 left-0 rounded-card bg-surface" />
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
  // Вкладка переключается сразу при касании (не ждём отпускания); звук — по отпусканию пальца.
  // Не по click: экран под пальцем уже сменился, и iPhone иногда не присылает click (звука не было
  // на «Пути», «Словах» и «Профиле»). Отпускание пальца iOS тоже засчитывает как касание для звука.
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      {...pressHandlers}
      onPointerDown={(e) => {
        pressHandlers.onPointerDown(e)
        if (e.button === 0 && !isActive) navigate(route)
      }}
      onPointerUp={(e) => {
        pressHandlers.onPointerUp()
        if (e.button === 0) feedback('tap')
      }}
      onClick={(e) => {
        // Клавиатура/VoiceOver: касания не было — звук и переключение по нажатию.
        if (e.detail !== 0) return
        feedback('tap')
        if (!isActive) navigate(route)
      }}
      className={`relative flex h-14 w-full max-w-[88px] flex-col items-center justify-center gap-0.5 rounded-card transition-colors duration-200 ${isActive ? 'text-info-ink' : 'text-muted'}`}
    >
      <span
        className="relative"
        style={{
          transform: pressed ? 'scale(0.84)' : 'scale(1)',
          transition: pressed ? 'transform 80ms ease-out' : `transform ${ICON_UP.ms}ms ${ICON_UP.easing}`,
        }}
      >
        <Icon size={28} strokeWidth={isActive ? 2.75 : 2.25} />
      </span>
      <span className="relative text-caption font-extrabold">{label}</span>
    </button>
  )
}
