// «Профиль» (SPEC 7.5, DESIGN.md → «Экран «Профиль»», «Профиль: …», «Экран «Достижения»»).
import { BookOpen, Camera, ChevronRight, Flame, Pencil, Zap } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { setDailyGoal, type ProfileGame } from '../db/game'
import { NAME_MAX, removeAvatar, setAvatar, setProfileName } from '../db/profile'
import { feedback } from '../feedback/feedback'
import { ACHIEVEMENTS, stripBadges, type Achievement } from '../game/achievements'
import { GOAL_OPTIONS, levelInfo } from '../game/progress'
import { compressImage } from '../media/image'
import { JourneySection } from './Journey'
import { Screen } from '../shell/Screen'
import { now } from '../srs/clock'
import { plural } from '../srs/status'
import { Button } from '../ui/Button'
import { ChoiceChips } from '../ui/ChoiceChips'
import { FormSheet } from '../ui/FormSheet'
import { Mascot } from '../ui/Mascot'
import { Popover } from '../ui/Popover'
import { ProgressBar } from '../ui/ProgressBar'
import { Sheet } from '../ui/Sheet'
import type { SheetHandle } from '../ui/SheetFrame'
import { TextField } from '../ui/TextField'
import { useToast } from '../ui/Toast'
import { usePress } from '../ui/usePress'
import { useBlobUrl } from '../words/useMediaUrl'

const fmt = (n: number) => n.toLocaleString('ru-RU')
const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

/** Круг 88: фото, первая буква имени или Спарки; в углу — камера. */
function Avatar({ g }: { g: ProfileGame }) {
  const url = useBlobUrl(g.avatar)
  const letter = g.name.trim().charAt(0).toUpperCase()
  return (
    <span className="relative block size-[88px] shrink-0">
      <span
        className={`flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] border-border ${
          url ? 'bg-surface' : letter ? 'bg-primary' : 'bg-primary-tint'
        }`}
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : letter ? (
          <span className="text-[40px] leading-none font-black text-on-color">{letter}</span>
        ) : (
          <Mascot size={64} />
        )}
      </span>
      <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border-[3px] border-bg bg-info">
        <Camera size={16} strokeWidth={2.5} className="text-on-color" />
      </span>
    </span>
  )
}

/** Касание аватара: без фото — сразу выбор фото (галерея или камера), с фото — «Выбрать другое» / «Убрать». */
function AvatarButton({ g }: { g: ProfileGame }) {
  const input = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)
  const { pressed, pressHandlers } = usePress()
  const toast = useToast()

  const take = async (file: File) => {
    try {
      await setAvatar(db, await compressImage(file))
    } catch {
      toast({ message: 'Не получилось открыть фото' })
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void take(file)
        }}
      />
      <button
        type="button"
        aria-label={g.avatar ? 'Фото профиля' : 'Добавить фото профиля'}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          feedback('tap')
          if (g.avatar) setMenu(true)
          else input.current?.click()
        }}
        className="shrink-0 rounded-full bg-transparent p-0 press-soft"
      >
        <Avatar g={g} />
      </button>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Фото профиля">
        <Button
          block
          onClick={() => {
            setMenu(false)
            input.current?.click()
          }}
        >
          Выбрать другое
        </Button>
        <Button
          variant="secondary"
          block
          className="text-danger-ink!"
          onClick={() => {
            setMenu(false)
            void removeAvatar(db).catch(() => toast({ message: 'Не получилось убрать фото' }))
          }}
        >
          Убрать фото
        </Button>
      </Sheet>
    </>
  )
}

/** «Как тебя зовут?» — полноэкранный лист с полем (как название колоды: клавиатура не закрывает поле). */
function NameSheet({ open, name, onClose }: { open: boolean; name: string; onClose: () => void }) {
  const [value, setValue] = useState(name)
  const sheet = useRef<SheetHandle>(null)
  const toast = useToast()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(name)
  }
  const save = async () => {
    try {
      await setProfileName(db, value)
      void sheet.current?.dismiss()
    } catch {
      toast({ message: 'Не получилось сохранить имя' })
    }
  }
  return (
    <FormSheet ref={sheet} open={open} title="Как тебя зовут?" onCancel={onClose} onDone={() => void save()}>
      <TextField
        label="Имя"
        value={value}
        maxLength={NAME_MAX}
        placeholder="Например, Саша"
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </FormSheet>
  )
}

/** Шапка: аватар, имя (касание — изменить), уровень с полоской XP, стрик. */
function ProfileHeader({ g }: { g: ProfileGame }) {
  const lv = levelInfo(g.totalXp)
  const [editing, setEditing] = useState(false)
  const { pressed, pressHandlers } = usePress()
  const streak = g.streak > 0 ? `🔥 ${days(g.streak)}` : '🔥 Стрик начнётся с урока'
  return (
    <section className="mb-6 flex items-center gap-4">
      <AvatarButton g={g} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-label={g.name ? `Имя: ${g.name}. Изменить` : 'Добавить имя'}
          {...pressHandlers}
          data-pressed={pressed || undefined}
          onClick={() => {
            feedback('tap')
            setEditing(true)
          }}
          className="-ml-1 flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-transparent px-1 press-soft"
        >
          <span className={`truncate text-title font-black ${g.name ? 'text-text' : 'text-muted'}`}>{g.name || 'Добавь имя'}</span>
          <Pencil size={18} strokeWidth={2.5} className="shrink-0 text-muted" />
        </button>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-small font-extrabold text-xp-ink">{`Уровень ${lv.level}`}</span>
          <span className="text-caption font-bold text-muted">{`${fmt(lv.into)} / ${fmt(lv.need)} XP`}</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar small value={lv.into / lv.need} label={`До уровня ${lv.level + 1}`} colorClass="bg-xp" />
        </div>
        <p className="m-0 mt-1.5 truncate text-caption font-bold text-muted">
          {streak}
          {g.bestStreak > 0 && ` · лучший ${g.bestStreak}`}
        </p>
      </div>
      <NameSheet open={editing} name={g.name} onClose={() => setEditing(false)} />
    </section>
  )
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-card border-2 border-border bg-surface p-3">
      {icon}
      <span className="text-title leading-tight font-black text-text">{value}</span>
      <span className="max-w-full truncate text-caption font-extrabold text-muted">{label}</span>
    </div>
  )
}

function ProfileTiles({ g }: { g: ProfileGame }) {
  return (
    <section className="mb-6 flex gap-2">
      <StatTile icon={<Flame size={24} strokeWidth={2.25} className="fill-current text-streak" />} value={fmt(g.streak)} label="дней подряд" />
      <StatTile icon={<Zap size={24} strokeWidth={2.25} className="fill-current text-xp-ink" />} value={fmt(g.totalXp)} label="всего XP" />
      <StatTile icon={<BookOpen size={24} strokeWidth={2.25} className="text-primary-ink" />} value={fmt(g.knownWords)} label="знаю слов" />
    </section>
  )
}

const GOALS = GOAL_OPTIONS.map((v) => ({ value: v as number, label: `${v} XP` }))

function DailyGoal({ goal }: { goal: number }) {
  const toast = useToast()
  return (
    <section className="mb-6">
      <h2 className="m-0 mb-3 text-heading font-black text-text">Дневная цель</h2>
      <ChoiceChips
        label="Дневная цель"
        options={GOALS}
        value={goal}
        onChange={(v) => void setDailyGoal(db, now(), v).catch(() => toast({ message: 'Не получилось сохранить цель' }))}
      />
    </section>
  )
}

function BadgeCircle({ a, got, small }: { a: Achievement; got: boolean; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${small ? 'size-[52px] text-[26px]' : 'size-16 text-[32px]'} ${
        got ? 'border-[3px] border-xp bg-bg' : 'border-2 border-border bg-surface'
      }`}
    >
      <span className={got ? '' : 'opacity-35 grayscale'}>{a.emoji}</span>
    </span>
  )
}

const countText = (have: string[]) => `${ACHIEVEMENTS.filter((a) => have.includes(a.id)).length} из ${ACHIEVEMENTS.length}`

function AchievementStrip({ have, onOpen }: { have: string[]; onOpen: () => void }) {
  const { pressed, pressHandlers } = usePress()
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-heading font-black text-text">Достижения</h2>
        <span className="text-small font-extrabold text-muted">{countText(have)}</span>
      </div>
      <button
        type="button"
        aria-label={`Все достижения, ${countText(have)}`}
        {...pressHandlers}
        data-pressed={pressed || undefined}
        onClick={() => {
          feedback('tap')
          onOpen()
        }}
        className="press-3d flex w-full items-center justify-between gap-2 rounded-card border-2 border-border bg-bg p-3 [--press-shadow:var(--c-border)]"
      >
        <span className="flex gap-2">
          {stripBadges(have).map((a) => (
            <BadgeCircle key={a.id} a={a} got={have.includes(a.id)} small />
          ))}
        </span>
        <ChevronRight size={24} strokeWidth={2.5} className="shrink-0 text-muted" />
      </button>
    </section>
  )
}

/** Верх «Профиля»: шапка, плитки, цель, ряд значков. */
export function ProfileGameSection({ g, onAchievements }: { g: ProfileGame; onAchievements: () => void }) {
  return (
    <>
      <ProfileHeader g={g} />
      <ProfileTiles g={g} />
      <DailyGoal goal={g.goalXp} />
      <AchievementStrip have={g.achievements} onOpen={onAchievements} />
      <JourneySection g={g} />
    </>
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
      <BadgeCircle a={a} got={got} />
      <span className={`line-clamp-2 text-center text-caption font-extrabold ${got ? 'text-text' : 'text-muted'}`}>{a.title}</span>
    </button>
  )
}

/** Экран «Достижения» (вложенный): все значки сеткой, касание — за что. */
export function AchievementsScreen({ have, onBack }: { have: string[]; onBack: () => void }) {
  const anchor = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState<Achievement | null>(null)
  const got = (a: Achievement) => have.includes(a.id)
  return (
    <Screen title="Достижения" onBack={onBack} action={<span className="text-small font-extrabold text-muted">{countText(have)}</span>}>
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
    </Screen>
  )
}
