// Экран «Путь» (SPEC 7.1): разделы-колоды, извилистая тропинка узлов, туман впереди, кнопка «ПОВТОРИТЬ · N».
import { useReducedMotion } from 'motion/react'
import { Dumbbell, RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { navigate, navigateSub, openLesson, type LessonTarget } from '../app/routes'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { ensureQuests, moreNewWords, settleDay } from '../db/game'
import { loadPath, PATH_KEY, type PathData } from '../db/path'
import type { PathItem, PathNode, PathSection } from '../game/path'
import { FUTURES_CLEAR, pathView } from '../game/pathView'
import { unlockSpeech } from '../media/speech'
import { CollapsedSection } from '../path/CollapsedSection'
import { Fog } from '../path/Fog'
import { GhostInfo, NodeInfo } from '../path/NodeInfo'
import { StreakChip, StreakInfo } from '../path/PathBar'
import { itemId, PathTrack, ROW } from '../path/PathTrack'
import { SectionBanner } from '../path/SectionBanner'
import { now } from '../srs/clock'
import { dayKey } from '../srs/day'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Popover } from '../ui/Popover'
import { TextButton } from '../ui/TextButton'
import { useToast } from '../ui/Toast'

/** Сплошной дым ниже последнего места: до него можно долистать, дальше — только «резинка». */
const FOG_TAIL = 120
/** Туман начинается ниже первого скрытого места на столько px (просьба владельца: «опусти ниже»). */
const FOG_DROP = 140
/**
 * Путь кончается будущими уроками — туман опущен под FUTURES_CLEAR из них (над хвостом: зазор 24 + FOG_DROP
 * за ещё одним местом): там же, где он стоял, пока в конце раздела был сундук-цель.
 */
const FOG_FUTURE_DROP = 24 + FOG_DROP + (FUTURES_CLEAR - 1) * ROW

type Selected = { id: string }

/** Всплывашка полосы сверху (не место пути). */
const STREAK_ID = 'bar:streak'

/**
 * Новый день (и первое открытие): пропуски закрываются заморозками или стрик сгорает, выбираются задания дня.
 * Запись в базе — путь обновится сам (liveQuery).
 */
function useSettleDay(tick: number) {
  const toast = useToast()
  const today = dayKey(now())
  useEffect(() => {
    void (async () => {
      try {
        const s = await settleDay(db, now())
        // Тост — по факту записи: заморозка тратится один раз, и повторный запуск её уже не найдёт.
        if (s.frozen.length > 0) toast({ message: 'Заморозка сохранила стрик ❄️' })
        await ensureQuests(db, now())
      } catch {
        // Не вышло — попробуем при следующем открытии; путь показывается и без этого.
      }
    })()
    // Раз в минуту и при возврате в приложение (tick): наступил новый день (после 04:00) — сверка и задания.
    // Если день тот же, это одно короткое чтение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, tick])
}

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

const toggle = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function PathScreen() {
  const tick = useMinuteTick()
  useSettleDay(tick)
  const data = useCachedLiveQuery(PATH_KEY, () => loadPath(db, now()), [tick])
  const reduce = useReducedMotion() ?? false
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const anchor = useRef<HTMLElement | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(new Set())

  const view = useMemo(() => (data ? pathView(data.path, expanded, showAll) : null), [data, expanded, showAll])

  // Туман: плотный дым начинается у первого места под туманом (или сразу под последним видимым).
  // Путь открылся дальше → край плавно отступает вниз (Fog).
  const tailRef = useRef<HTMLDivElement>(null)
  // Путь кончается будущим уроком — место под туман уже занято им, отдельный хвост не нужен.
  const endsWithFuture = view?.sections.at(-1)?.entries.at(-1)?.item.kind === 'future'
  const [fogTop, setFogTop] = useState<number | null>(null)
  // Где дым густеет: у последнего места под туманом (просьба владельца).
  const [fogThick, setFogThick] = useState<number | null>(null)
  // Разделы, которые начинаются под туманом: их плашка — под дымом, как закрытые уроки (не поверх него).
  const [fogSections, setFogSections] = useState<ReadonlySet<string>>(new Set())
  const [fogFade, setFogFade] = useState<{ from: number; to: number } | null>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !view?.fog) return
    const start = list.querySelector('[data-fog-start]') ?? tailRef.current
    if (!start) return
    const listTop = list.getBoundingClientRect().top
    const top = start.getBoundingClientRect().top - listTop
    const startTop = start.getBoundingClientRect().top
    const underEls = [...list.querySelectorAll<HTMLElement>('[data-section]')].filter((s) => s.getBoundingClientRect().top >= startTop)
    const under = underEls.map((s) => s.dataset.section!)
    setFogSections((prev) => (prev.size === under.length && under.every((id) => prev.has(id)) ? prev : new Set(under)))
    // Плашка первого раздела под туманом гаснет в фон, как уроки под дымом: растворение — от низа первого места
    // под туманом (между ним и плашкой пусто — само место не меняется) до низа плашки.
    const banner = underEls[0]?.querySelector('[data-banner]')
    setFogFade(
      banner
        ? { from: Math.round(start.getBoundingClientRect().bottom - listTop), to: Math.round(banner.getBoundingClientRect().bottom - listTop) }
        : null,
    )
    // Будущие уроки стоят на обычном шаге сразу за последним местом, а туман — на прежнем месте.
    const drop = start.hasAttribute('data-future') ? FOG_FUTURE_DROP : FOG_DROP
    setFogTop(Math.round(top + drop))
    const last = [...list.querySelectorAll('[data-fogged]')].at(-1)
    setFogThick(last ? Math.round(last.getBoundingClientRect().top - listTop) : null)
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

  const setRef = (id: string, el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }

  /** anchorId — над чем открыть всплывашку, если не над самим местом (будущий урок показывает подсказку «+»). */
  const show = (s: Selected, anchorId = s.id) => {
    anchor.current = refs.current.get(anchorId) ?? null
    setSelected(s)
  }

  const select = (item: PathItem) => {
    const id = itemId(item)
    if (item.kind === 'future') {
      // Будущий урок — как «+» своей колоды: «добавь слова».
      show({ id: `ghost:${item.deckId}:+` }, id)
      return
    }
    show({ id })
  }

  const found = data && selected ? findItem(data, selected.id) : null
  const barOpen = selected?.id === STREAK_ID ? selected.id : null
  const close = () => setSelected(null)
  const hasDue = !!data && data.today.due > 0

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {/* Шапка не прокручивается, плашка раздела прилипает под ней. Высота строки — 44, как у чипов полосы этапа 8. */}
      <header className="flex min-h-11 shrink-0 items-center gap-1 bg-bg pt-[calc(12px+var(--safe-top))] pr-[calc(16px+var(--safe-right))] pb-2 pl-[calc(16px+var(--safe-left))]">
        <h1 className="m-0 min-w-0 flex-1 truncate text-title leading-11 font-black text-text">Путь</h1>
        {data && <StreakChip header={data.header} chipRef={(el) => setRef(STREAK_ID, el)} onClick={() => show({ id: STREAK_ID })} />}
      </header>

      {/* Родная «резинка» iPhone: оттянешь путь за конец — снизу тянется тот же туман (Fog рисует его за краем). */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain">
        {/* Всегда на 2 px длиннее экрана: iPhone прокручивает и пружинит, только если есть что листать (короткий путь). */}
        <div className="flex min-h-[calc(100%+2px)] flex-col bg-bg pt-2 pr-[calc(16px+var(--safe-right))] pl-[calc(16px+var(--safe-left))]">
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
                <section key={section.deck.id} data-section={section.deck.id}>
                  {/* Плашка прилипает к верху, пока виден её раздел. Раздел под туманом — плашка под дымом, без подложки и z-10. */}
                  <div
                    data-banner
                    inert={fogSections.has(section.deck.id) || undefined}
                    className={`sticky -top-2 pt-2 pb-2 ${fogSections.has(section.deck.id) ? '' : 'z-10 bg-bg'}`}
                  >
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
                      setRef={setRef}
                      onSelect={select}
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
            {view.fog && !endsWithFuture && <div ref={tailRef} aria-hidden className="shrink-0" style={{ height: FOG_TAIL }} />}
            {view.fog && fogTop !== null && <Fog top={fogTop} thickAt={fogThick} fade={fogFade} />}
          </div>
        )}
        </div>
      </div>

      {/* Поверх прилипающих плашек разделов (у них z-10): плашка, проезжая внизу, не закрывает кнопку. */}
      {!hasDue && data?.plan.done && data.plan.known > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Button variant="info" icon={<Dumbbell size={22} strokeWidth={2.5} />} onClick={() => startLesson({ kind: 'training' })}>
              Тренировка
            </Button>
          </div>
        </div>
      )}
      {hasDue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center">
          <div className="path-pulse pointer-events-auto">
            <Button variant="info" icon={<RotateCcw size={22} strokeWidth={2.75} />} onClick={() => startLesson({ kind: 'review' })}>
              Повторить · {data.today.due}
            </Button>
          </div>
        </div>
      )}

      <Popover open={!!found || barOpen !== null} onClose={close} anchorRef={anchor} width={300} gap={barOpen ? 8 : 22}>
        {barOpen === STREAK_ID && data && <StreakInfo header={data.header} />}
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
            onMore={() => {
              close()
              // Касание «будит» озвучку сразу, урок открывается, когда лимит уже поднят.
              unlockSpeech()
              void moreNewWords(db, now())
                .then((target) => target && openLesson(target))
                .catch(() => toast({ message: 'Не получилось добавить новые слова' }))
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
        ) : null}
      </Popover>
    </div>
  )
}
