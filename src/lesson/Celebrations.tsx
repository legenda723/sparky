// Праздники после урока (DESIGN.md → «Праздники после урока»): задания дня, стрик, уровень, достижения.
import { Check, Flame, Snowflake } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { loadHeader } from '../db/path'
import { feedback } from '../feedback/feedback'
import type { Celebration } from '../game/celebrate'
import { questTitle, type Quest } from '../game/quests'
import { FREEZE_MAX, type WeekDay } from '../game/streak'
import { WeekRow } from '../path/PathBar'
import { now } from '../srs/clock'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/Mascot'
import { useConfetti } from './LessonSummary'

const POP = { duration: 0.35, ease: [0.34, 1.4, 0.64, 1] as const }

function Frame({ art, title, text, children, last, onNext }: {
  art: ReactNode
  title: string
  text?: string
  children?: ReactNode
  last: boolean
  onNext: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-[calc(16px+var(--safe-left))] pt-[calc(16px+var(--safe-top))] text-center">
        {art}
        <h1 className="m-0 text-display font-black text-text">{title}</h1>
        {text && <p className="m-0 text-body font-bold text-muted">{text}</p>}
        {children && <div className="mt-3 w-full">{children}</div>}
      </div>
      <div className="px-[calc(16px+var(--safe-left))] pt-2 pb-[calc(16px+var(--safe-bottom))]">
        <Button block onClick={onNext}>
          {last ? 'Готово' : 'Далее'}
        </Button>
      </div>
    </div>
  )
}

function QuestRows({ quests, fresh }: { quests: Quest[]; fresh: Quest[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 rounded-card border-2 border-border bg-surface p-4 text-left">
      {quests.map((q) => {
        const isNew = fresh.some((f) => f.kind === q.kind)
        return (
          <li key={q.kind} className="flex items-center gap-3">
            {q.done ? (
              <motion.span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary"
                initial={isNew ? { opacity: 0, transform: 'scale(0.6)' } : false}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                transition={{ ...POP, delay: 0.3 }}
              >
                <Check size={16} strokeWidth={3.5} className="text-on-color" />
              </motion.span>
            ) : (
              <span className="size-7 shrink-0 rounded-full border-2 border-border bg-bg" />
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
        )
      })}
    </ul>
  )
}

/** Неделя стрика — из базы (день уже засчитан). */
function useWeek(): WeekDay[] | null {
  const [week, setWeek] = useState<WeekDay[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadHeader(db, now(), 0)
      .then((h) => alive && setWeek(h.week))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return week
}

function StreakScreen({ c, last, onNext }: { c: Extract<Celebration, { kind: 'streak' }>; last: boolean; onNext: () => void }) {
  const week = useWeek()
  const days = plural(c.streak, 'день', 'дня', 'дней')
  return (
    <Frame
      art={
        <div className="flex flex-col items-center">
          <Flame size={96} strokeWidth={2} className="streak-pulse fill-current text-streak" />
          <span className="text-[48px] leading-none font-black text-streak-ink">{c.streak}</span>
        </div>
      }
      title={c.milestone ? `${c.milestone} ${days} подряд!` : 'Стрик +1!'}
      text="Возвращайся завтра — огонь разгорится"
      last={last}
      onNext={onNext}
    >
      {week && <WeekRow week={week} />}
      {c.freezeEarned && (
        <p className="m-0 mt-4 flex items-center justify-center gap-2 text-small font-extrabold text-info-ink">
          <Snowflake size={20} strokeWidth={2.5} />
          {`+1 заморозка · в запасе ${c.freezes} из ${FREEZE_MAX}`}
        </p>
      )}
    </Frame>
  )
}

export function CelebrationScreen({ c, last, onNext }: { c: Celebration; last: boolean; onNext: () => void }) {
  const confetti =
    (c.kind === 'streak' && c.milestone !== undefined) ||
    c.kind === 'level' ||
    c.kind === 'achievements' ||
    (c.kind === 'quests' && c.news.all)
  useConfetti(confetti)
  useEffect(() => {
    feedback('reward')
  }, [])

  switch (c.kind) {
    case 'quests': {
      const n = c.news.done.length
      return (
        <Frame
          art={<Mascot mood="cheer" size={120} />}
          title={c.news.all ? 'Все задания дня!' : n > 1 ? 'Задания выполнены!' : 'Задание выполнено!'}
          text={c.news.all ? 'Отличный день — так держать!' : 'Ещё немного — и все задания дня закрыты'}
          last={last}
          onNext={onNext}
        >
          <QuestRows quests={c.news.after} fresh={c.news.done} />
        </Frame>
      )
    }
    case 'streak':
      return <StreakScreen c={c} last={last} onNext={onNext} />
    case 'level':
      return (
        <Frame
          art={
            <div className="flex size-[120px] items-center justify-center rounded-full bg-xp shadow-[0_6px_0_var(--c-xp-shadow)]">
              <span className="text-[48px] leading-none font-black text-on-xp">{c.level}</span>
            </div>
          }
          title="Новый уровень!"
          text={`Уровень ${c.level} — так держать!`}
          last={last}
          onNext={onNext}
        />
      )
    case 'achievements':
      return (
        <Frame
          art={<Mascot mood="cheer" size={120} />}
          title={c.list.length > 1 ? 'Новые достижения!' : 'Новое достижение!'}
          last={last}
          onNext={onNext}
        >
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-left">
            {c.list.map((a, i) => (
              <motion.li
                key={a.id}
                className="flex items-center gap-3 rounded-card border-2 border-border bg-surface px-4 py-3"
                initial={{ opacity: 0, transform: 'scale(0.9)' }}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                transition={{ ...POP, delay: 0.2 + i * 0.1 }}
              >
                <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-bg text-[32px]">{a.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-body font-extrabold text-text">{a.title}</span>
                  <span className="block text-small font-semibold text-muted">{a.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </Frame>
      )
  }
}
