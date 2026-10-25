// «Твой путь» внизу «Профиля» (DESIGN.md → «Профиль: «Твой путь»», «Календарь пути»).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { db } from '../db/db'
import type { ProfileGame } from '../db/game'
import { JOURNEY_KEY, loadJourney, type Journey } from '../db/journey'
import { useCachedLiveQuery } from '../db/liveCache'
import { feedback } from '../feedback/feedback'
import { bandSides, dayLabel, intensity, monthCells, monthsFrom, monthTitle, WEEKDAYS, type DayMark } from '../game/calendar'
import { pickPhrase } from '../game/phrases'
import { now } from '../srs/clock'
import { dayKey } from '../srs/day'
import { plural } from '../srs/status'
import { Mascot } from '../ui/Mascot'
import { Popover } from '../ui/Popover'
import { usePress } from '../ui/usePress'

const mix = (percent: number) => `color-mix(in srgb, var(--c-primary) ${percent}%, var(--c-bg))`
const SHADE = { 1: mix(35), 2: mix(65), 3: 'var(--c-primary)' } as const
const BAND: CSSProperties = { background: mix(20) }
const TODAY_RING = '0 0 0 2px var(--c-bg), 0 0 0 4px var(--c-text)'

function PhraseCard({ g, j, today }: { g: ProfileGame; j: Journey; today: string }) {
  const phrase = pickPhrase({ today, firstDay: j.firstDay, streak: g.streak, words: g.knownWords, activeDays: j.activeDays })
  const facts = [
    `${j.activeDays} ${plural(j.activeDays, 'день', 'дня', 'дней')} занятий`,
    g.streak > 0 ? `стрик ${g.streak}` : null,
    `знаю ${g.knownWords} ${plural(g.knownWords, 'слово', 'слова', 'слов')}`,
  ].filter(Boolean)
  return (
    <div className="flex items-center gap-3 rounded-card border-2 border-border bg-surface p-4">
      <span className="shrink-0">
        <Mascot size={48} />
      </span>
      <div className="min-w-0">
        <p className="m-0 line-clamp-3 text-body font-extrabold text-text">{phrase.text}</p>
        <p className="m-0 mt-1.5 text-caption font-bold text-muted">{facts.join(' · ')}</p>
      </div>
    </div>
  )
}

interface DayProps {
  day: string
  today: string
  mark: DayMark | undefined
  goal: number
  band: { left: boolean; right: boolean }
  onOpen: (el: HTMLElement, day: string) => void
}

function DayCell({ day, today, mark, goal, band, onOpen }: DayProps) {
  const { pressed, pressHandlers } = usePress()
  const ref = useRef<HTMLButtonElement>(null)
  const future = day > today
  const n = Number(day.slice(8))
  const lit = mark?.done ? intensity(mark.xp, goal) : null
  const background = lit ? SHADE[lit] : mark?.frozen ? 'var(--c-info)' : undefined
  const onColor = lit === 3 || (!lit && mark?.frozen)
  const style: CSSProperties = { background, boxShadow: day === today ? TODAY_RING : undefined }
  const text = `${onColor ? 'text-on-color' : future ? 'text-muted' : 'text-text'} text-small font-extrabold`
  return (
    <div className="relative flex h-11 items-center justify-center">
      {band.left && <span className="absolute top-1 bottom-1 left-0 right-1/2" style={BAND} />}
      {/* Внахлёст на 1 px с соседом: на дробных пикселях стык половинок не виден. */}
      {band.right && <span className="absolute top-1 bottom-1 left-1/2 -right-px" style={BAND} />}
      {future ? (
        <span className={`relative flex size-9 items-center justify-center rounded-full ${text}`} style={style}>
          {n}
        </span>
      ) : (
        <button
          ref={ref}
          type="button"
          aria-label={dayLabel(day, today, mark)}
          {...pressHandlers}
          data-pressed={pressed || undefined}
          onClick={() => {
            feedback('tap')
            if (ref.current) onOpen(ref.current, day)
          }}
          className={`relative flex size-9 items-center justify-center rounded-full p-0 press-soft ${text}`}
          style={style}
        >
          {n}
        </button>
      )}
    </div>
  )
}

function MonthGrid({ month, j, today, onOpen }: { month: string; j: Journey; today: string; onOpen: DayProps['onOpen'] }) {
  const cells = monthCells(month)
  return (
    <div className="w-full shrink-0 snap-start" aria-label={monthTitle(month)}>
      <div className="grid grid-cols-7">
        {cells.map((day, i) =>
          day ? (
            <DayCell key={day} day={day} today={today} mark={j.marks.get(day)} goal={j.goalXp} band={bandSides(cells, i, j.marks)} onOpen={onOpen} />
          ) : (
            <div key={`x${i}`} className="h-11" />
          ),
        )}
      </div>
    </div>
  )
}

function Arrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Предыдущий месяц' : 'Следующий месяц'}
      disabled={disabled}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        onClick()
      }}
      className={`press-soft flex size-11 items-center justify-center rounded-full data-pressed:bg-surface ${disabled ? 'text-disabled' : 'text-muted'}`}
    >
      {dir === 'prev' ? <ChevronLeft size={24} strokeWidth={2.5} /> : <ChevronRight size={24} strokeWidth={2.5} />}
    </button>
  )
}

/** Месяцы листаются родной прокруткой вбок с остановкой на каждом (DESIGN.md → «Движение → Листание месяцев»). */
function Calendar({ j, today }: { j: Journey; today: string }) {
  const months = monthsFrom(j.firstDay, today)
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(months.length - 1)
  const reduce = useReducedMotion()
  const anchor = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  // Открывается на текущем месяце — сразу, без прокрутки на глазах.
  const count = months.length
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    setIndex(count - 1)
  }, [count])

  const go = (i: number) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="rounded-card border-2 border-border bg-bg p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="m-0 pl-1 text-body font-black text-text">{monthTitle(months[index] ?? months[count - 1])}</h3>
        <div className="flex">
          <Arrow dir="prev" disabled={index <= 0} onClick={() => go(index - 1)} />
          <Arrow dir="next" disabled={index >= count - 1} onClick={() => go(index + 1)} />
        </div>
      </div>
      <div className="grid grid-cols-7 pb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-caption font-extrabold text-muted">
            {w}
          </span>
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          const i = Math.round(el.scrollLeft / el.clientWidth)
          if (i !== index) setIndex(Math.max(0, Math.min(count - 1, i)))
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {months.map((m) => (
          <MonthGrid
            key={m}
            month={m}
            j={j}
            today={today}
            onOpen={(el, day) => {
              anchor.current = el
              setOpen(day)
            }}
          />
        ))}
      </div>
      <Popover open={open !== null} onClose={() => setOpen(null)} anchorRef={anchor} width={260}>
        {open && <p className="m-0 text-center text-small font-extrabold text-text">{dayLabel(open, today, j.marks.get(open))}</p>}
      </Popover>
    </div>
  )
}

/** Блок «Твой путь»: фраза по настоящему результату и календарь по месяцам. */
export function JourneySection({ g }: { g: ProfileGame }) {
  const j = useCachedLiveQuery(JOURNEY_KEY, () => loadJourney(db), [])
  const today = dayKey(now())
  if (!j) return null
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-3 text-heading font-black text-text">Твой путь</h2>
      <PhraseCard g={g} j={j} today={today} />
      <div className="mt-3">
        <Calendar j={j} today={today} />
      </div>
    </section>
  )
}
