// Экран «Путь» (SPEC 7.1): разделы-колоды, извилистая тропинка узлов, сундуки, туман впереди, кнопка «ПОВТОРИТЬ · N».
import { useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUp, Gem, RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { navigate, navigateSub, openLesson, type LessonTarget } from '../app/routes'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { loadPath, openChest, PATH_KEY, type PathData } from '../db/path'
import { feedback } from '../feedback/feedback'
import { chestGems, type PathItem, type PathNode, type PathSection } from '../game/path'
import { pathView } from '../game/pathView'
import { unlockSpeech } from '../media/speech'
import { CollapsedSection } from '../path/CollapsedSection'
import { Fog } from '../path/Fog'
import { ChestInfo, GemsInfo, GhostInfo, NodeInfo } from '../path/NodeInfo'
import { itemId, PathTrack } from '../path/PathTrack'
import { SectionBanner } from '../path/SectionBanner'
import { now } from '../srs/clock'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { HeaderChip } from '../ui/HeaderChip'
import { Popover } from '../ui/Popover'
import { TextButton } from '../ui/TextButton'
import { useToast } from '../ui/Toast'
import { usePress } from '../ui/usePress'

/** Всплывашка счётчика кристаллов. */
const GEMS_ID = 'gems'
/** Сплошной дым ниже последнего места: до него можно долистать (~треть экрана), дальше — нет. */
const FOG_TAIL = 260

type Selected = { id: string; opened?: { gems: number; total: number } }

/** Раз в минуту и при возврате в приложение — свежий счёт: слова в обучении подходят по времени. */
function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const timer = window.setInterval(bump, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && bump()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return tick
}

function startLesson(target: LessonTarget) {
  // iOS разрешает озвучку только из касания — «будим» её здесь на весь урок.
  unlockSpeech()
  openLesson(target)
}

function findItem(data: PathData, id: string): { item: PathItem; section: PathSection } | null {
  for (const section of data.path.sections) {
    const item = section.items.find((x) => itemId(x) === id)
    if (item) return { item, section }
  }
  return null
}

/** «К текущему уроку» (DESIGN.md → «Кнопка «к текущему»»): круглая объёмная второстепенная 48. */
function ToCurrentButton({ up, onClick }: { up: boolean; onClick: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-label="К текущему уроку"
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className="press-3d flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-bg text-info-ink [--press-shadow:var(--c-border)]"
    >
      {up ? <ArrowUp size={24} strokeWidth={3} /> : <ArrowDown size={24} strokeWidth={3} />}
    </button>
  )
}

const toggle = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function PathScreen() {
  const tick = useMinuteTick()
  const data = useCachedLiveQuery(PATH_KEY, () => loadPath(db, now()), [tick])
  const reduce = useReducedMotion() ?? false
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const anchor = useRef<HTMLElement | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [burst, setBurst] = useState<{ id: string; gems: number } | null>(null)
  // Сундуки, открытые на этом экране: показываем открытыми, пока база не ответила свежим путём.
  const [openedHere, setOpenedHere] = useState<ReadonlySet<string>>(new Set())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(new Set())
  const popTimer = useRef<number | undefined>(undefined)
  const burstTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(popTimer.current)
      window.clearTimeout(burstTimer.current)
    },
    [],
  )

  const view = useMemo(() => (data ? pathView(data.path, expanded, showAll) : null), [data, expanded, showAll])

  // Туман: плотный дым начинается у первого места под туманом (или сразу под последним видимым).
  // Путь открылся дальше → край плавно отступает вниз (Fog).
  const tailRef = useRef<HTMLDivElement>(null)
  const [fogTop, setFogTop] = useState<number | null>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !view?.fog) return
    const start = list.querySelector('[data-fog-start]') ?? tailRef.current
    if (!start) return
    setFogTop(Math.round(start.getBoundingClientRect().top - list.getBoundingClientRect().top))
  }, [view])

  // Плавно к текущему узлу: при открытии и когда текущий сменился (вернулись из урока — память показала прошлый).
  const currentKey = data?.path.current?.key
  const scrolledTo = useRef<string | undefined>(undefined)
  const scrollToCurrent = (smooth: boolean) => {
    const box = scrollRef.current
    const el = box?.querySelector('[data-current]')
    if (!box || !el) return
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const top = Math.max(0, box.scrollTop + r.top - b.top + r.height / 2 - box.clientHeight * 0.4)
    if (!smooth || reduce) box.scrollTop = top
    else box.scrollTo({ top, behavior: 'smooth' })
  }
  useLayoutEffect(() => {
    if (!currentKey || currentKey === scrolledTo.current) return
    scrolledTo.current = currentKey
    // Путь едет — всплывашка осталась бы висеть над прежним местом.
    setSelected(null)
    requestAnimationFrame(() => scrollToCurrent(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey])

  // Кнопка «к текущему уроку»: когда он ушёл за край экрана.
  const [away, setAway] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    const box = scrollRef.current
    const el = box?.querySelector('[data-current]')
    if (!box || !el) {
      setAway(null)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => setAway(e.isIntersecting ? null : e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'up' : 'down'),
      { root: box },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [currentKey, view])

  const setRef = (id: string, el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }

  const show = (s: Selected) => {
    window.clearTimeout(popTimer.current)
    anchor.current = refs.current.get(s.id) ?? null
    setSelected(s)
  }

  const select = async (item: PathItem) => {
    const id = itemId(item)
    if (item.kind === 'chest' && item.state === 'ready' && !openedHere.has(id)) {
      // Отклик сразу при касании (крышка, «+N 💎», звук), запись в базу — следом.
      const gems = chestGems()
      feedback('reward')
      setOpenedHere((set) => new Set(set).add(id))
      setBurst({ id, gems })
      window.clearTimeout(burstTimer.current)
      burstTimer.current = window.setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1500)
      let total: number | null = null
      try {
        total = await openChest(db, item.key, gems)
      } catch {
        // Не записалось — награды не было: сундук снова закрыт.
        setBurst(null)
        setOpenedHere((set) => toggle(set, id))
        toast({ message: 'Не получилось открыть сундук' })
        return
      }
      if (total === null) {
        // Уже был открыт раньше — второй награды нет.
        setBurst(null)
        show({ id })
        return
      }
      const saved = total
      // Сначала крышка и «+N 💎», потом всплывашка — чтобы она их не закрыла.
      window.clearTimeout(popTimer.current)
      popTimer.current = window.setTimeout(() => show({ id, opened: { gems, total: saved } }), 700)
      return
    }
    show({ id })
  }

  const found = data && selected && selected.id !== GEMS_ID ? findItem(data, selected.id) : null
  const gemsOpen = selected?.id === GEMS_ID
  const close = () => {
    window.clearTimeout(popTimer.current)
    setSelected(null)
  }
  const hasDue = !!data && data.today.due > 0

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {/* Шапка не прокручивается: заголовок и кристаллы всегда на виду, плашка раздела прилипает под ней. */}
      <header className="flex min-h-11 shrink-0 items-center gap-1 bg-bg pt-[calc(12px+var(--safe-top))] pr-[calc(16px+var(--safe-right))] pb-2 pl-[calc(16px+var(--safe-left))]">
        <h1 className="m-0 min-w-0 flex-1 truncate text-title font-black text-text">Путь</h1>
        {data && (
          <HeaderChip
            ref={(el) => setRef(GEMS_ID, el)}
            icon={<Gem size={24} strokeWidth={2.5} className="fill-current" />}
            value={data.gems}
            colorClass="text-gem"
            label={`Кристаллы: ${data.gems}`}
            onClick={() => show({ id: GEMS_ID })}
          />
        )}
      </header>

      {/* Фон самой прокрутки виден только за её концом, когда iPhone оттягивает экран «резинкой»:
          сверху — обычный фон, снизу — ровный цвет дыма, которым кончается туман (одно полотно, без шва). */}
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain"
        style={view?.fog ? { background: 'linear-gradient(to bottom, var(--c-bg) 50%, var(--c-fog-floor) 50%)' } : undefined}
      >
        {/* Содержимое непрозрачное: фон прокрутки под ним не просвечивает. У самого низа (под туманом) фон —
            цвет дыма: на дробном пикселе края белый не проступает светлой полоской при оттягивании. */}
        <div
          className="flex min-h-full flex-col bg-bg pt-2 pr-[calc(16px+var(--safe-right))] pl-[calc(16px+var(--safe-left))]"
          style={view?.fog ? { background: 'linear-gradient(to bottom, var(--c-bg) calc(100% - 100px), var(--c-fog-floor) 0)' } : undefined}
        >
        {data && view && data.path.sections.length === 0 && (
          <EmptyState title="Добавь первые слова" text="Каждые 5 слов — новый урок на пути. Слова добавляешь ты сам — те, что встречаешь.">
            <Button block onClick={() => navigate('words')}>
              Добавить первые слова
            </Button>
          </EmptyState>
        )}
        {data && view && view.sections.length > 0 && (
          <div ref={listRef} className="relative flex flex-1 flex-col gap-6">
            {view.sections.map(({ section, collapsed, hiddenBefore, entries }) =>
              collapsed ? (
                <CollapsedSection key={section.deck.id} section={section} onOpen={() => setExpanded((s) => toggle(s, section.deck.id))} />
              ) : (
                <section key={section.deck.id}>
                  {/* Плашка прилипает к верху, пока виден её раздел. */}
                  <div className="sticky -top-2 z-10 bg-bg pt-2 pb-2">
                    <SectionBanner deck={section.deck} number={section.number} />
                  </div>
                  {hiddenBefore > 0 && (
                    <div className="mt-2 flex justify-center">
                      <TextButton onClick={() => setShowAll((s) => toggle(s, section.deck.id))}>
                        {`Показать ещё ${hiddenBefore} ${plural(hiddenBefore, 'пройденный урок', 'пройденных урока', 'пройденных уроков')}`}
                      </TextButton>
                    </div>
                  )}
                  <div className="mt-4">
                    <PathTrack
                      entries={entries}
                      color={section.deck.color}
                      number={section.number}
                      nodeCount={section.items.filter((x) => x.kind === 'node').length}
                      burst={burst}
                      openedHere={openedHere}
                      setRef={setRef}
                      onSelect={(item) => void select(item)}
                    />
                  </div>
                  {expanded.has(section.deck.id) && (
                    <div className="mt-2 flex justify-center">
                      <TextButton onClick={() => setExpanded((s) => toggle(s, section.deck.id))}>Свернуть раздел</TextButton>
                    </div>
                  )}
                </section>
              ),
            )}
            {/* Место под сплошной дым: долистать до него можно, дальше — только «резинка». */}
            {view.fog && <div ref={tailRef} aria-hidden className="shrink-0" style={{ height: FOG_TAIL }} />}
            {view.fog && fogTop !== null && <Fog top={fogTop} />}
          </div>
        )}
        </div>
      </div>

      {(hasDue || away) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center">
          {hasDue && (
            <div className="path-pulse pointer-events-auto">
              <Button variant="info" icon={<RotateCcw size={22} strokeWidth={2.75} />} onClick={() => startLesson({ kind: 'review' })}>
                Повторить · {data.today.due}
              </Button>
            </div>
          )}
          {away && (
            <div className="pointer-events-auto absolute right-[calc(16px+var(--safe-right))]">
              <ToCurrentButton up={away === 'up'} onClick={() => scrollToCurrent(true)} />
            </div>
          )}
        </div>
      )}

      <Popover open={!!found || gemsOpen} onClose={close} anchorRef={anchor} width={300} gap={gemsOpen ? 8 : 22}>
        {gemsOpen && data && <GemsInfo gems={data.gems} />}
        {found && data && found.item.kind === 'node' ? (
          <NodeInfo
            node={found.item}
            total={found.section.items.filter((x) => x.kind === 'node').length}
            data={data}
            onStart={() => {
              const node = found.item as PathNode
              close()
              startLesson({ kind: 'node', deckId: node.deckId, index: node.index })
            }}
            onReview={() => {
              close()
              startLesson({ kind: 'review' })
            }}
          />
        ) : found && found.item.kind === 'ghost' ? (
          <GhostInfo
            deckTitle={found.section.deck.title}
            onAdd={() => {
              close()
              navigateSub('words', found.section.deck.id)
            }}
          />
        ) : found && found.item.kind === 'chest' ? (
          <ChestInfo
            state={openedHere.has(itemId(found.item)) ? 'opened' : found.item.state}
            afterLesson={found.item.afterLesson}
            opened={selected?.opened}
          />
        ) : null}
      </Popover>
    </div>
  )
}
