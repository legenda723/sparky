// Полоса «Пути» (DESIGN.md → «Полоса пути», «Чип стрика», «Всплывашка стрика»): только стрик.
import { Flame, Snowflake } from 'lucide-react'
import type { Ref } from 'react'
import type { PathHeader } from '../db/path'
import { FREEZE_EVERY, FREEZE_MAX, type WeekDay } from '../game/streak'
import { plural } from '../srs/status'
import { HeaderChip } from '../ui/HeaderChip'

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
  return (
    <>
      <p className="m-0 text-body font-black text-text">{title}</p>
      <p className="m-0 mt-1 text-small font-semibold text-muted">{text}</p>
      <div className="mt-4">
        <WeekRow week={header.week} />
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

/** Неделя стрика: 7 кругов с понедельника, под ними буквы дня (сегодня — ярче). */
export function WeekRow({ week }: { week: WeekDay[] }) {
  // Сегодня — последний не будущий день.
  const today = week.filter((d) => d.state !== 'future').at(-1)?.key
  return (
    <div className="flex justify-between">
      {week.map((d) => (
        <div key={d.key} className="flex flex-col items-center gap-1">
          <WeekCircle day={d} />
          <span className={`text-caption font-extrabold ${d.key === today ? 'text-text' : 'text-muted'}`}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}
