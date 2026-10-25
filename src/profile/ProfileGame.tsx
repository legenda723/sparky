// Игровая часть «Профиля» (SPEC 7.5, DESIGN.md → «Профиль: уровень / достижения / дневная цель»).
import { Crown, Flame, Trophy } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { loadProfileGame, PROFILE_GAME_KEY, setDailyGoal, type ProfileGame } from '../db/game'
import { useCachedLiveQuery } from '../db/liveCache'
import { useToast } from '../ui/Toast'
import { feedback } from '../feedback/feedback'
import { ACHIEVEMENTS, type Achievement } from '../game/achievements'
import { GOAL_OPTIONS, levelInfo } from '../game/progress'
import { now } from '../srs/clock'
import { ChoiceChips } from '../ui/ChoiceChips'
import { Popover } from '../ui/Popover'
import { ProgressBar } from '../ui/ProgressBar'
import { usePress } from '../ui/usePress'

const fmt = (n: number) => n.toLocaleString('ru-RU')

function StatTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-card border-2 border-border bg-surface p-3">
      {icon}
      <div className="min-w-0">
        <div className="text-title leading-none font-black text-text">{value}</div>
        <div className="text-caption font-extrabold text-muted">{label}</div>
      </div>
    </div>
  )
}

function LevelCard({ g }: { g: ProfileGame }) {
  const lv = levelInfo(g.totalXp)
  return (
    <section className="mb-6">
      <div className="rounded-card border-2 border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-xp shadow-[0_4px_0_var(--c-xp-shadow)]">
            <span className="text-title font-black text-on-xp">{lv.level}</span>
          </div>
          <div className="min-w-0">
            <div className="text-body font-extrabold text-text">{`Уровень ${lv.level}`}</div>
            <div className="text-caption font-bold text-muted">{`${fmt(g.totalXp)} XP всего`}</div>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={lv.into / lv.need} label="До следующего уровня" colorClass="bg-xp" />
        </div>
        <p className="m-0 mt-2 text-caption font-bold text-muted">{`Ещё ${fmt(lv.need - lv.into)} XP до уровня ${lv.level + 1}`}</p>
      </div>
      <div className="mt-3 flex gap-3">
        <StatTile icon={<Flame size={28} strokeWidth={2.25} className="shrink-0 fill-current text-streak" />} value={g.streak} label="стрик" />
        <StatTile icon={<Crown size={28} strokeWidth={2.25} className="shrink-0 text-xp-ink" />} value={g.bestStreak} label="лучший стрик" />
      </div>
    </section>
  )
}

function Badge({ a, got, onOpen }: { a: Achievement; got: boolean; onOpen: (el: HTMLElement) => void }) {
  const { pressed, pressHandlers } = usePress()
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${a.title}${got ? ', получено' : ''}`}
      {...pressHandlers}
      data-pressed={pressed || undefined}
      onClick={() => {
        feedback('tap')
        if (ref.current) onOpen(ref.current)
      }}
      className="flex flex-col items-center gap-2 bg-transparent p-0 press-soft"
    >
      <span
        className={`flex size-16 items-center justify-center rounded-full text-[32px] ${
          got ? 'border-[3px] border-xp bg-bg' : 'border-2 border-border bg-surface'
        }`}
      >
        <span className={got ? '' : 'opacity-35 grayscale'}>{a.emoji}</span>
      </span>
      <span className={`line-clamp-2 text-center text-caption font-extrabold ${got ? 'text-text' : 'text-muted'}`}>{a.title}</span>
    </button>
  )
}

function Achievements({ have }: { have: string[] }) {
  const anchor = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState<Achievement | null>(null)
  const got = (a: Achievement) => have.includes(a.id)
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="m-0 flex items-center gap-2 text-heading font-black text-text">
          <Trophy size={22} className="text-xp-ink" /> Достижения
        </h2>
        <span className="text-small font-extrabold text-muted">{`${ACHIEVEMENTS.filter(got).length} из ${ACHIEVEMENTS.length}`}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => (
          <Badge
            key={a.id}
            a={a}
            got={got(a)}
            onOpen={(el) => {
              anchor.current = el
              setOpen(a)
            }}
          />
        ))}
      </div>
      <Popover open={open !== null} onClose={() => setOpen(null)} anchorRef={anchor} width={280}>
        {open && (
          <>
            <p className="m-0 text-body font-black text-text">{`${open.emoji} ${open.title}`}</p>
            <p className="m-0 mt-1 text-small font-semibold text-muted">{open.text}</p>
            <p className={`m-0 mt-2 text-caption font-extrabold ${got(open) ? 'text-primary-ink' : 'text-muted'}`}>
              {got(open) ? 'Получено ✓' : 'Ещё впереди'}
            </p>
          </>
        )}
      </Popover>
    </section>
  )
}

const GOALS = GOAL_OPTIONS.map((v) => ({ value: v as number, label: `${v} XP` }))

/** Уровень, стрик, достижения и дневная цель — вверху «Профиля». */
export function ProfileGameSection() {
  const g = useCachedLiveQuery(PROFILE_GAME_KEY, () => loadProfileGame(db, now()), [])
  const toast = useToast()
  if (!g) return null
  return (
    <>
      <LevelCard g={g} />
      <Achievements have={g.achievements} />
      <section className="mb-6">
        <h2 className="m-0 mb-3 text-heading font-black text-text">Дневная цель</h2>
        <ChoiceChips label="Дневная цель" options={GOALS} value={g.goalXp} onChange={(v) => void setDailyGoal(db, now(), v).catch(() => toast({ message: 'Не получилось сохранить цель' }))}
        />
      </section>
    </>
  )
}
