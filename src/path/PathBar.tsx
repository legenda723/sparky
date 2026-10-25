// Полоса «Пути» (DESIGN.md → «Полоса пути», «Чип стрика», «Кольцо цели», всплывашки): стрик и цель дня.
import { Check, Flame, Snowflake, Zap } from 'lucide-react'
import type { Ref } from 'react'
import type { PathHeader } from '../db/path'
import { goalInfo } from '../game/progress'
import { questTitle } from '../game/quests'
import { FREEZE_EVERY, FREEZE_MAX, type WeekDay } from '../game/streak'
import { plural } from '../srs/status'
import { HeaderChip } from '../ui/HeaderChip'
import { ProgressBar } from '../ui/ProgressBar'

export function StreakChip({ header, chipRef, onClick }: { header: PathHeader; chipRef: Ref<HTMLButtonElement>; onClick: () => void }) {
  const n = header.streak.streak
  const motion = n === 0 ? '' : header.alarm ? 'streak-alarm' : 'streak-pulse'
  return (
    <HeaderChip
      ref={chipRef}
      icon={<Flame size={30} strokeWidth={2.25} className={`fill-current ${motion}`} />}
      value={n}
      colorClass={n > 0 ? 'text-streak' : 'text-muted'}
      label={`Стрик: ${n} ${plural(n, 'день', 'дня', 'дней')}`}
      onClick={onClick}
      large
    />
  )
}

const R = 13.5
const C = 2 * Math.PI * R

/** Кольцо цели 31: дорожка и заливка по доле, молния внутри. */
function GoalRing({ ratio, done }: { ratio: number; done: boolean }) {
  return (
    <span className="relative flex size-[31px] items-center justify-center">
      <svg width={31} height={31} viewBox="0 0 31 31" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={15.5} cy={15.5} r={R} fill="none" stroke="var(--c-border)" strokeWidth={4} />
        {ratio > 0 && (
          <circle
            cx={15.5}
            cy={15.5}
            r={R}
            fill="none"
            stroke="var(--c-xp)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${C * ratio} ${C}`}
          />
        )}
      </svg>
      <Zap size={16} strokeWidth={2.75} className={`relative text-xp-ink ${done ? 'fill-current' : ''}`} />
    </span>
  )
}

export function GoalChip({ header, chipRef, onClick }: { header: PathHeader; chipRef: Ref<HTMLButtonElement>; onClick: () => void }) {
  const g = goalInfo(header.dayXp, header.goalXp)
  return (
    <HeaderChip
      ref={chipRef}
      icon={<GoalRing ratio={g.ratio} done={g.done} />}
      value={g.xp}
      colorClass=""
      label={`Цель дня: ${g.xp} из ${g.goal} XP`}
      onClick={onClick}
      large
    />
  )
}

function WeekCircle({ day }: { day: WeekDay }) {
  const base = 'flex size-[34px] items-center justify-center rounded-full'
  switch (day.state) {
    case 'done':
      return (
        <span className={`${base} bg-streak`}>
          <Flame size={18} strokeWidth={2.5} className="fill-current text-on-color" />
        </span>
      )
    case 'frozen':
      return (
        <span className={`${base} bg-info-tint`}>
          <Snowflake size={18} strokeWidth={2.5} className="text-info-ink" />
        </span>
      )
    case 'today':
      return <span className={`${base} border-2 border-streak`} />
    default:
      return <span className={`${base} border-2 border-border bg-surface`} />
  }
}

export function StreakInfo({ header }: { header: PathHeader }) {
  const n = header.streak.streak
  const title = n === 0 ? 'Начни стрик сегодня' : `${n} ${plural(n, 'день', 'дня', 'дней')} подряд!`
  const text = header.dayDone
    ? 'Сегодня засчитан — до завтра!'
    : header.alarm
      ? 'Вечер! Пройди урок, чтобы огонь не погас'
      : 'Пройди урок — огонь разгорится'
  const f = header.streak.freezes
  const today = todayKey(header)
  return (
    <>
      <p className="m-0 text-body font-black text-text">{title}</p>
      <p className="m-0 mt-1 text-small font-semibold text-muted">{text}</p>
      <div className="mt-4 flex justify-between">
        {header.week.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1">
            <WeekCircle day={d} />
            <span className={`text-caption font-extrabold ${d.key === today ? 'text-text' : 'text-muted'}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t-2 border-border pt-3">
        {Array.from({ length: FREEZE_MAX }, (_, i) => (
          <Snowflake key={i} size={20} strokeWidth={2.5} className={i < f ? 'text-info' : 'text-disabled'} />
        ))}
        <span className="flex flex-col">
          <span className="text-caption font-extrabold text-text">{`Заморозки: ${f} из ${FREEZE_MAX}`}</span>
          <span className="text-caption font-bold text-muted">{`+1 за каждые ${FREEZE_EVERY} дней подряд`}</span>
        </span>
      </div>
    </>
  )
}

/** Сегодняшний день недели — последний не будущий. */
function todayKey(header: PathHeader): string | undefined {
  return header.week.filter((d) => d.state !== 'future').at(-1)?.key
}

export function GoalInfo({ header }: { header: PathHeader }) {
  const g = goalInfo(header.dayXp, header.goalXp)
  const all = header.quests.length > 0 && header.quests.every((q) => q.done)
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="m-0 text-body font-black text-text">Цель дня</p>
        <span className="text-small font-extrabold text-xp-ink">{`${g.xp} / ${g.goal} XP`}</span>
      </div>
      <div className="mt-2">
        <ProgressBar value={g.ratio} label="Цель дня" colorClass="bg-xp" />
      </div>
      {header.quests.length > 0 && (
        <>
          <p className="m-0 mt-4 text-caption font-black tracking-wide text-muted uppercase">Задания дня</p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
            {header.quests.map((q) => (
              <li key={q.kind} className="flex items-center gap-3">
                {q.done ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check size={16} strokeWidth={3.5} className="text-on-color" />
                  </span>
                ) : (
                  <span className="size-7 shrink-0 rounded-full border-2 border-border bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-small font-bold text-text">{questTitle(q)}</span>
                    <span className="shrink-0 text-caption font-extrabold text-muted">{`${q.progress}/${q.target}`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(q.progress / q.target) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {all && <p className="m-0 mt-3 text-small font-extrabold text-primary-ink">Все задания выполнены!</p>}
        </>
      )}
    </>
  )
}
