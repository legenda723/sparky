// Экран «Путь» (SPEC 7.1): разделы-колоды, извилистая дорожка узлов, сундуки, кнопка «ПОВТОРИТЬ · N».
import { useReducedMotion } from 'motion/react'
import { Gem, RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { navigate, navigateSub, openLesson, type LessonTarget } from '../app/routes'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { loadPath, openChest, PATH_KEY, type PathData } from '../db/path'
import { feedback } from '../feedback/feedback'
import { chestGems, type PathItem, type PathNode, type PathSection } from '../game/path'
import { unlockSpeech } from '../media/speech'
import { ChestButton } from '../path/ChestButton'
import { ChestInfo, GemsInfo, GhostInfo, NodeInfo } from '../path/NodeInfo'
import { GhostButton } from '../path/GhostButton'
import { Road, type RoadPoint } from '../path/Road'
import { PathNodeButton } from '../path/PathNodeButton'
import { SectionBanner } from '../path/SectionBanner'
import { Screen } from '../shell/Screen'
import { now } from '../srs/clock'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Mascot } from '../ui/Mascot'
import { HeaderChip } from '../ui/HeaderChip'
import { Popover } from '../ui/Popover'
import { useToast } from '../ui/Toast'
import { DECK_COLORS } from '../words/deckLook'

/** Сдвиг вбок по волне (DESIGN.md → «Дорожка пути»). */
const WAVE = [0, 44, 70, 44, 0, -44, -70, -44]
/** Маскот сидит у 3-го места раздела. */
const MASCOT_AT = 2

type Item = PathItem
const itemId = (item: Item) => `${item.kind}:${item.key}`
/** Всплывашка счётчика кристаллов. */
const GEMS_ID = 'gems'

/** Высота ряда дорожки: у текущего узла сверху место под «НАЧАТЬ». Центр кружка — на 48 выше низа ряда. */
const ROW = 108
const ROW_CURRENT = 160
const CENTER_FROM_BOTTOM = 48

/** Дошёл ли путь до этого места: участок дорожки к нему — сплошной. */
function reached(item: Item, openedHere: ReadonlySet<string>): boolean {
  if (item.kind === 'node') return item.state !== 'locked'
  if (item.kind === 'chest') return item.state !== 'locked' || openedHere.has(itemId(item))
  return false
}

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

function StartBubble() {
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+18px)] left-1/2 -translate-x-1/2">
      <div className="relative rounded-card border-2 border-border bg-bg px-3 py-2 text-small font-black tracking-[0.04em] whitespace-nowrap text-text uppercase">
        Начать
        <span
          aria-hidden
          className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-br-[4px] border-r-2 border-b-2 border-border bg-bg"
        />
      </div>
    </div>
  )
}

interface TrackProps {
  section: PathSection
  burst: { id: string; gems: number } | null
  openedHere: ReadonlySet<string>
  setRef: (id: string, el: HTMLElement | null) => void
  onSelect: (item: Item) => void
}

function Track({ section, burst, openedHere, setRef, onSelect }: TrackProps) {
  // В чётных разделах волна зеркальная — дорожка не выглядит одинаково.
  const sign = section.number % 2 === 0 ? -1 : 1
  const nodeCount = section.items.filter((x) => x.kind === 'node').length
  let bottom = 0
  const points: RoadPoint[] = section.items.map((item, i) => {
    const current = item.kind === 'node' && item.state === 'current'
    bottom += current ? ROW_CURRENT : ROW
    return { x: WAVE[i % WAVE.length] * sign, y: bottom - CENTER_FROM_BOTTOM, reached: reached(item, openedHere) }
  })
  return (
    <div className="relative mt-6 flex flex-col">
      <Road points={points} color={DECK_COLORS[section.deck.color].fill} />
      {section.items.map((item, i) => {
        const id = itemId(item)
        const current = item.kind === 'node' && item.state === 'current'
        return (
          <div key={id} className="relative flex items-end justify-center pb-3" style={{ height: current ? ROW_CURRENT : ROW }}>
            {i === MASCOT_AT && (
              <div className="pointer-events-none absolute bottom-0" style={{ left: `calc(50% + ${-sign * 110}px - 48px)` }}>
                <Mascot size={96} />
              </div>
            )}
            <div style={{ transform: `translateX(${WAVE[i % WAVE.length] * sign}px)` }}>
              <div className={`relative ${current ? 'path-bounce' : ''}`} data-current={current || undefined}>
                {current && <StartBubble />}
                {item.kind === 'node' ? (
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={item}
                    color={section.deck.color}
                    label={`Урок ${item.index + 1} из ${nodeCount}`}
                    onSelect={() => onSelect(item)}
                  />
                ) : item.kind === 'ghost' ? (
                  <GhostButton ref={(el) => setRef(id, el)} onSelect={() => onSelect(item)} />
                ) : (
                  <ChestButton
                    ref={(el) => setRef(id, el)}
                    state={openedHere.has(id) ? 'opened' : item.state}
                    burst={burst?.id === id ? burst.gems : undefined}
                    onSelect={() => onSelect(item)}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function findItem(data: PathData, id: string): { item: Item; section: PathSection } | null {
  for (const section of data.path.sections) {
    const item = section.items.find((x) => itemId(x) === id)
    if (item) return { item, section }
  }
  return null
}

export function PathScreen() {
  const tick = useMinuteTick()
  const data = useCachedLiveQuery(PATH_KEY, () => loadPath(db, now()), [tick])
  const reduce = useReducedMotion() ?? false
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const anchor = useRef<HTMLElement | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [burst, setBurst] = useState<{ id: string; gems: number } | null>(null)
  // Сундуки, открытые на этом экране: показываем открытыми, пока база не ответила свежим путём.
  const [openedHere, setOpenedHere] = useState<ReadonlySet<string>>(new Set())
  const popTimer = useRef<number | undefined>(undefined)
  const burstTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(popTimer.current)
      window.clearTimeout(burstTimer.current)
    },
    [],
  )

  // Плавно к текущему узлу: при открытии и когда текущий сменился (вернулись из урока — память показала прошлый).
  const currentKey = data?.path.current?.key
  const scrolledTo = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!currentKey || currentKey === scrolledTo.current || !box) return
    scrolledTo.current = currentKey
    // Путь едет — всплывашка осталась бы висеть над прежним местом.
    setSelected(null)
    const el = box.querySelector('[data-current]')
    if (!el) return
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const top = Math.max(0, box.scrollTop + r.top - b.top + r.height / 2 - box.clientHeight * 0.4)
    if (reduce) box.scrollTop = top
    else requestAnimationFrame(() => box.scrollTo({ top, behavior: 'smooth' }))
  }, [currentKey, reduce])

  const setRef = (id: string, el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }

  const show = (s: Selected) => {
    window.clearTimeout(popTimer.current)
    anchor.current = refs.current.get(s.id) ?? null
    setSelected(s)
  }

  const select = async (item: Item) => {
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
        setOpenedHere((set) => {
          const next = new Set(set)
          next.delete(id)
          return next
        })
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
    <div className="relative h-full">
      <Screen
        title="Путь"
        scrollRef={scrollRef}
        action={
          data && (
            <HeaderChip
              ref={(el) => setRef(GEMS_ID, el)}
              icon={<Gem size={24} strokeWidth={2.5} className="fill-current" />}
              value={data.gems}
              colorClass="text-gem"
              label={`Кристаллы: ${data.gems}`}
              onClick={() => show({ id: GEMS_ID })}
            />
          )
        }
      >
        {data &&
          (data.path.sections.length === 0 ? (
            <EmptyState title="Добавь первые слова" text="Каждые 5 слов — новый урок на пути. Слова добавляешь ты сам — те, что встречаешь.">
              <Button block onClick={() => navigate('words')}>
                Добавить первые слова
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-8">
              {data.path.sections.map((section) => (
                <section key={section.deck.id}>
                  <SectionBanner deck={section.deck} number={section.number} />
                  <Track section={section} burst={burst} openedHere={openedHere} setRef={setRef} onSelect={(item) => void select(item)} />
                </section>
              ))}
            </div>
          ))}
        {hasDue && <div aria-hidden className="h-20" />}
      </Screen>

      {hasDue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="path-pulse pointer-events-auto">
            <Button variant="info" icon={<RotateCcw size={22} strokeWidth={2.75} />} onClick={() => startLesson({ kind: 'review' })}>
              Повторить · {data.today.due}
            </Button>
          </div>
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
          <ChestInfo state={openedHere.has(itemId(found.item)) ? 'opened' : found.item.state} opened={selected?.opened} />
        ) : null}
      </Popover>
    </div>
  )
}
