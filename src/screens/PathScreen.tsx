// Экран «Путь» (SPEC 7.1): разделы-колоды, извилистая дорожка узлов, сундуки, кнопка «ПОВТОРИТЬ · N».
import { useReducedMotion } from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { navigate, openLesson, type LessonTarget } from '../app/routes'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { loadPath, openChest, PATH_KEY, type PathData } from '../db/path'
import { feedback } from '../feedback/feedback'
import { chestGems, type PathChest, type PathNode, type PathSection } from '../game/path'
import { unlockSpeech } from '../media/speech'
import { ChestButton } from '../path/ChestButton'
import { ChestInfo, NodeInfo } from '../path/NodeInfo'
import { PathNodeButton } from '../path/PathNodeButton'
import { SectionBanner } from '../path/SectionBanner'
import { Screen } from '../shell/Screen'
import { now } from '../srs/clock'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Mascot } from '../ui/Mascot'
import { Popover } from '../ui/Popover'

/** Сдвиг вбок по волне (DESIGN.md → «Дорожка пути»). */
const WAVE = [0, 44, 70, 44, 0, -44, -70, -44]
/** Маскот сидит у 3-го места раздела. */
const MASCOT_AT = 2

type Item = PathNode | PathChest
const itemId = (item: Item) => `${item.kind}:${item.key}`

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
  setRef: (id: string, el: HTMLElement | null) => void
  onSelect: (item: Item) => void
}

function Track({ section, burst, setRef, onSelect }: TrackProps) {
  // В чётных разделах волна зеркальная — дорожка не выглядит одинаково.
  const sign = section.number % 2 === 0 ? -1 : 1
  const nodeCount = section.items.filter((x) => x.kind === 'node').length
  if (section.items.length === 0) {
    return <p className="m-0 mt-4 text-center text-small font-semibold text-muted">В колоде пока нет слов</p>
  }
  return (
    <div className="mt-6 flex flex-col">
      {section.items.map((item, i) => {
        const id = itemId(item)
        const current = item.kind === 'node' && item.state === 'current'
        return (
          <div key={id} className={`relative flex items-end justify-center pb-3 ${current ? 'h-[148px]' : 'h-24'}`}>
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
                ) : (
                  <ChestButton
                    ref={(el) => setRef(id, el)}
                    state={burst?.id === id ? 'opened' : item.state}
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const anchor = useRef<HTMLElement | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [burst, setBurst] = useState<{ id: string; gems: number } | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // Плавно к текущему узлу: при открытии и когда текущий сменился (вернулись из урока — память показала прошлый).
  const currentKey = data?.path.current?.key
  const scrolledTo = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!currentKey || currentKey === scrolledTo.current || !box) return
    scrolledTo.current = currentKey
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
    anchor.current = refs.current.get(s.id) ?? null
    setSelected(s)
  }

  const select = async (item: Item) => {
    const id = itemId(item)
    if (item.kind === 'chest' && item.state === 'ready') {
      if (burst?.id === id) return
      // Отклик сразу при касании (крышка, «+N 💎», звук), запись в базу — следом.
      const gems = chestGems()
      feedback('reward')
      setBurst({ id, gems })
      const total = await openChest(db, item.key, gems)
      if (total === null) return
      // Сначала крышка и «+N 💎», потом всплывашка — чтобы она их не закрыла.
      timers.current.push(
        window.setTimeout(() => show({ id, opened: { gems, total } }), 700),
        window.setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1500),
      )
      return
    }
    show({ id })
  }

  const found = data && selected ? findItem(data, selected.id) : null
  const close = () => setSelected(null)
  const hasDue = !!data && data.today.due > 0

  return (
    <div className="relative h-full">
      <Screen title="Путь" scrollRef={scrollRef}>
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
                  <Track section={section} burst={burst} setRef={setRef} onSelect={(item) => void select(item)} />
                </section>
              ))}
              {!data.path.current && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Mascot size={96} />
                  <p className="m-0 max-w-[280px] text-small font-semibold text-muted">Новые уроки появятся, когда добавишь слова</p>
                  <Button variant="secondary" block onClick={() => navigate('words')}>
                    Добавить слова
                  </Button>
                </div>
              )}
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

      <Popover open={!!found} onClose={close} anchorRef={anchor} width={300} gap={22}>
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
        ) : found ? (
          <ChestInfo state={found.item.state as PathChest['state']} opened={selected?.opened} />
        ) : null}
      </Popover>
    </div>
  )
}
