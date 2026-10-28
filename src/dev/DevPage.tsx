import { ChevronLeft, Flame, Plus, Trash2, Volume2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { setPref, usePrefs, type ThemePref } from '../app/prefs'
import { navigateSub } from '../app/routes'
import { feedback, type FeedbackEvent } from '../feedback/feedback'
import { setDemoColors, type DemoColors } from '../game/demoColors'
import { getDevClockOffset, now, setDevClockOffset } from '../srs/clock'
import { AnswerBanner } from '../ui/AnswerBanner'
import { Button } from '../ui/Button'
import { ChoiceChips } from '../ui/ChoiceChips'
import type { Celebration } from '../game/celebrate'
import { ACHIEVEMENTS } from '../game/achievements'
import type { Quest } from '../game/quests'
import { CelebrationScreen } from '../lesson/Celebrations'
import { HeaderChip } from '../ui/HeaderChip'
import { ListRow } from '../ui/ListRow'
import { Mascot, type MascotMood } from '../ui/Mascot'
import { OptionCard, type OptionState } from '../ui/OptionCard'
import { Popover } from '../ui/Popover'
import { ProgressBar } from '../ui/ProgressBar'
import { Sheet } from '../ui/Sheet'
import { Switch } from '../ui/Switch'
import { TextField } from '../ui/TextField'
import { useToast } from '../ui/Toast'
import { MotionLab } from './MotionLab'

/** Витрина #/dev: все детали интерфейса, их можно потрогать. */
export default function DevPage() {
  const prefs = usePrefs()
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-2 border-b-2 border-border bg-bg pt-[calc(4px+var(--safe-top))] pr-4 pb-1 pl-2">
        <button
          type="button"
          aria-label="Назад"
          onClick={() => {
            feedback('tap')
            // Витрина открывается из «Настроек» — туда и назад.
            navigateSub('profile', 'settings')
          }}
          className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface"
        >
          <ChevronLeft size={30} strokeWidth={3} />
        </button>
        <h1 className="m-0 text-heading font-black text-text">Витрина</h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(32px+var(--safe-bottom))]">
        <Section title="Проверка">
          <Row>
            <span className="flex-1 text-body font-bold">Как на iPhone 16</span>
            <Switch label="Как на iPhone 16" checked={prefs.simIphone} onChange={(v) => setPref('simIphone', v)} />
          </Row>
          <ChoiceChips<ThemePref>
            label="Тема"
            options={[
              { value: 'system', label: 'Как в системе' },
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
            ]}
            value={prefs.theme}
            onChange={(v) => setPref('theme', v)}
          />
          <PathColorsDemo />
        </Section>

        <MotionLab />
        <PartySection />
        {import.meta.env.DEV && <SeedSection />}
        <MascotSection />
        <ButtonsSection />
        <OptionsSection />
        <Section title="Поле ввода">
          <TextField label="Английское слово" placeholder="apple" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <TextField label="Перевод" defaultValue="яблако" error="Проверь написание" />
        </Section>
        <ProgressSection />
        <Section title="Переключатель и чипы">
          <SwitchDemo />
          <ChipsDemo />
        </Section>
        <Section title="Строки списка">
          <div className="-mx-4 border-t-2 border-border">
            <ListRow icon={<span className="text-title">🍎</span>} title="Еда" subtitle="12 из 40 выучено" right={<Badge>7</Badge>} onClick={() => {}} />
            <ListRow icon={<span className="text-title">✈️</span>} title="Путешествия" subtitle="3 из 25 выучено" onClick={() => {}} />
          </div>
        </Section>
        <PopoverSection />
        <OverlaysSection />
        <FeedbackSection />
        <ColorsSection />
        <TypeSection />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="m-0 text-heading font-black text-text">{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-streak px-2.5 py-0.5 text-caption font-black text-on-color">{children}</span>
  )
}

function MascotSection() {
  const [mood, setMood] = useState<MascotMood>('happy')
  return (
    <Section title="Маскот Спарки">
      <div className="flex justify-around rounded-panel bg-surface py-4">
        {(['happy', 'cheer', 'sad'] as const).map((m) => (
          <Mascot key={m} mood={m} size={96} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <Mascot mood={mood} size={160} />
        <ChoiceChips<MascotMood>
          label="Состояние маскота"
          options={[
            { value: 'happy', label: 'Радуется' },
            { value: 'cheer', label: 'Ликует' },
            { value: 'sad', label: 'Грустит' },
          ]}
          value={mood}
          onChange={setMood}
        />
      </div>
    </Section>
  )
}

function ButtonsSection() {
  return (
    <Section title="Кнопки">
      <Button block>Начать</Button>
      <Button block variant="secondary">
        Пропустить
      </Button>
      <Button block variant="info" icon={<Volume2 size={22} strokeWidth={3} />}>
        Послушать
      </Button>
      <Button block variant="danger" icon={<Trash2 size={20} strokeWidth={3} />}>
        Удалить
      </Button>
      <Button block disabled>
        Проверить
      </Button>
    </Section>
  )
}

const WORDS = ['яблоко', 'груша', 'вишня', 'слива']
const RIGHT = 0

function OptionsSection() {
  const [picked, setPicked] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const [progress, setProgress] = useState(0.2)

  const stateOf = (i: number): OptionState => {
    if (!checked) return picked === i ? 'selected' : 'idle'
    if (i === RIGHT) return 'correct'
    return picked === i ? 'wrong' : 'idle'
  }
  const correct = picked === RIGHT

  return (
    <Section title="Вариант ответа и плашка">
      <ProgressBar value={progress} label="Прогресс урока" />
      <p className="m-0 text-center text-display font-black text-text">apple</p>
      <div className="grid grid-cols-2 gap-3">
        {WORDS.map((w, i) => (
          <OptionCard key={w} state={stateOf(i)} disabled={checked} onSelect={() => setPicked(i)}>
            {w}
          </OptionCard>
        ))}
      </div>
      <Button
        block
        silent
        disabled={picked === null || checked}
        onClick={() => {
          setChecked(true)
          feedback(correct ? 'correct' : 'wrong')
          if (correct) setProgress((p) => Math.min(1, p + 0.2))
        }}
      >
        Проверить
      </Button>
      <AnswerBanner
        open={checked}
        kind={correct ? 'correct' : 'wrong'}
        title={correct ? 'Отлично!' : 'Почти!'}
        onNext={() => {
          setChecked(false)
          setPicked(null)
        }}
      >
        {correct ? undefined : 'Правильно: яблоко'}
      </AnswerBanner>
    </Section>
  )
}

function ProgressSection() {
  const [v, setV] = useState(0.35)
  return (
    <Section title="Прогресс-бар">
      <ProgressBar value={v} />
      <Row>
        <Button variant="secondary" onClick={() => setV((x) => Math.max(0, x - 0.2))}>
          −
        </Button>
        <Button variant="secondary" icon={<Plus size={20} strokeWidth={3} />} onClick={() => setV((x) => Math.min(1, x + 0.2))}>
          Ещё
        </Button>
      </Row>
    </Section>
  )
}

function SwitchDemo() {
  const [on, setOn] = useState(true)
  return (
    <Row>
      <span className="flex-1 text-body font-bold">Автоозвучка</span>
      <Switch label="Автоозвучка" checked={on} onChange={setOn} />
    </Row>
  )
}

function ChipsDemo() {
  const [size, setSize] = useState(15)
  return (
    <ChoiceChips
      label="Размер урока"
      options={[10, 15, 20].map((n) => ({ value: n, label: `${n} заданий` }))}
      value={size}
      onChange={setSize}
    />
  )
}

function PopoverSection() {
  const streakRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <Section title="Чипы шапки и всплывашка">
      <div className="flex items-center gap-4 rounded-panel border-2 border-border px-2">
        <HeaderChip
          ref={streakRef}
          icon={<Flame size={26} fill="currentColor" />}
          value={12}
          colorClass="text-streak"
          label="Стрик: 12 дней"
          onClick={() => setOpen(true)}
        />
      </div>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={streakRef}>
        <p className="m-0 flex items-center gap-2 text-heading font-black text-text">
          <Flame size={24} fill="currentColor" className="text-streak" /> 12 дней подряд!
        </p>
        <p className="m-0 mt-1 text-small font-semibold text-muted">Позанимайся сегодня, чтобы огонь не погас.</p>
      </Popover>
    </Section>
  )
}

function OverlaysSection() {
  const [sheet, setSheet] = useState(false)
  const toast = useToast()
  return (
    <Section title="Окно подтверждения и тост">
      <Button block variant="secondary" onClick={() => setSheet(true)}>
        Окно подтверждения
      </Button>
      <Row>
        <Button variant="secondary" onClick={() => toast({ message: 'Слово сохранено' })}>
          Тост
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast({ message: 'Карточка удалена', onUndo: () => toast({ message: 'Карточка вернулась' }) })}
        >
          С отменой
        </Button>
      </Row>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Удалить колоду «Еда»?"
        text="40 слов спрячутся. Отменить можно в течение 5 секунд."
      >
        <Button block variant="danger" onClick={() => setSheet(false)}>
          Удалить
        </Button>
        <Button block variant="secondary" onClick={() => setSheet(false)}>
          Отмена
        </Button>
      </Sheet>
    </Section>
  )
}

const EVENTS: { event: FeedbackEvent; label: string }[] = [
  { event: 'tap', label: 'Тик' },
  { event: 'correct', label: 'Верно' },
  { event: 'wrong', label: 'Неверно' },
  { event: 'streak', label: 'Серия' },
  { event: 'finish', label: 'Конец урока' },
  { event: 'reward', label: 'Награда' },
]

function FeedbackSection() {
  return (
    <Section title="Звуки и вибрация">
      <div className="grid grid-cols-2 gap-3">
        {EVENTS.map(({ event, label }) => (
          <Button key={event} variant="secondary" silent onClick={() => feedback(event)}>
            {label}
          </Button>
        ))}
      </div>
    </Section>
  )
}

const COLORS = [
  'primary',
  'info',
  'danger',
  'streak',
  'xp',
  'gem',
  'text',
  'text-muted',
  'border',
  'surface',
  'bg',
  'disabled',
  'primary-tint',
  'danger-tint',
  'info-tint',
  'primary-ink',
  'danger-ink',
  'info-ink',
  'deck-pink',
  'deck-teal',
]

function ColorsSection() {
  return (
    <Section title="Цвета">
      <div className="grid grid-cols-4 gap-2">
        {COLORS.map((c) => (
          <div key={c} className="flex flex-col items-center gap-1">
            <span
              className="h-12 w-full rounded-card border-2 border-border"
              style={{ background: `var(--c-${c})` }}
            />
            <span className="text-center text-[11px] leading-tight font-bold text-muted">{c}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function TypeSection() {
  return (
    <Section title="Шрифт Nunito">
      <p className="m-0 text-display font-black">32 · Заголовок</p>
      <p className="m-0 text-title font-black">24 · Экран</p>
      <p className="m-0 text-heading font-extrabold">20 · Подзаголовок</p>
      <p className="m-0 text-body font-bold">17 · Основной текст, пример: I like apples.</p>
      <p className="m-0 text-small font-semibold">15 · Пояснение и подписи</p>
      <p className="m-0 text-caption font-semibold text-muted">13 · Мелкая подпись</p>
    </Section>
  )
}

const COLOR_DEMOS: { value: DemoColors; label: string }[] = [
  { value: 'green-blue', label: 'Зелёная + синяя' },
  { value: 'blue-green', label: 'Синяя + зелёная' },
  { value: 'blue-blue', label: 'Обе синие' },
]

/** Пример цветов кнопок «Пути» (просьба владельца 2026-10-28): открывает «Путь» с выбранными цветами. */
function PathColorsDemo() {
  return (
    <>
      <span className="text-small font-extrabold text-muted">Путь: цвета кнопок</span>
      {COLOR_DEMOS.map((d) => (
        <Button
          key={d.value}
          variant="secondary"
          block
          onClick={() => {
            setDemoColors(d.value)
            navigateSub('path')
          }}
        >
          {d.label}
        </Button>
      ))}
      <p className="m-0 text-caption font-bold text-muted">
        Первый цвет — «ТРЕНИРОВКА», второй — «ПОВТОРИТЬ». Перекрашивает только эти две кнопки на «Пути». Твои слова не меняются; выключить — кнопкой на «Пути».
      </p>
    </>
  )
}

/** Кнопка тестовых данных — только в режиме разработки (SPEC → «Решения»). */
function SeedSection() {
  const toast = useToast()
  return (
    <Section title="Тестовые данные">
      <Button
        variant="secondary"
        block
        icon={<Plus size={22} strokeWidth={3} />}
        onClick={async () => {
          const { seedTestData } = await import('./seed')
          await seedTestData()
          toast({ message: 'Добавлено 3 колоды' })
        }}
      >
        Добавить 3 колоды
      </Button>
      <Button
        variant="secondary"
        block
        icon={<Plus size={22} strokeWidth={3} />}
        onClick={async () => {
          const { seedPathData } = await import('./seed')
          await seedPathData()
          toast({ message: 'Добавлен путь со всеми состояниями' })
        }}
      >
        Путь: все состояния
      </Button>
      <ClockDemo />
    </Section>
  )
}

/** Перемотка времени: проверить, какие слова придут завтра. Только в режиме разработки. */
function ClockDemo() {
  const [offset, setOffset] = useState(getDevClockOffset)
  const shift = (ms: number) => {
    setDevClockOffset(ms)
    setOffset(ms)
  }
  const days = Math.round(offset / 86_400_000)
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="m-0 text-small font-semibold text-muted">
        Время приложения: {days ? `+${days} дн. — ${now().toLocaleString('ru-RU')}` : 'настоящее'}
      </p>
      <Row>
        <Button variant="secondary" onClick={() => shift(offset + 86_400_000)}>
          +1 день
        </Button>
        <Button variant="secondary" disabled={!offset} onClick={() => shift(0)}>
          Сбросить
        </Button>
      </Row>
    </div>
  )
}

/** Праздники после урока (этап 8) — каждый можно открыть отдельно. Только показ: база не меняется. */
function PartySection() {
  const [open, setOpen] = useState<Celebration | null>(null)
  const quests: Quest[] = [
    { kind: 'minutes', target: 10, progress: 10, done: true },
    { kind: 'combo', target: 10, progress: 10, done: true },
    { kind: 'newWords', target: 5, progress: 3, done: false },
  ]
  const samples: { label: string; c: Celebration }[] = [
    { label: 'Задания дня', c: { kind: 'quests', news: { done: quests.slice(1, 2), all: false, after: quests } } },
    {
      label: 'Все задания',
      c: { kind: 'quests', news: { done: [quests[2]], all: true, after: quests.map((q) => ({ ...q, progress: q.target, done: true })) } },
    },
    { label: 'Стрик +1', c: { kind: 'streak', streak: 4, freezeEarned: false, freezes: 0 } },
    { label: 'Отметка 7 дней', c: { kind: 'streak', streak: 7, milestone: 7, freezeEarned: true, freezes: 1 } },
    { label: 'Новый уровень', c: { kind: 'level', level: 5 } },
    { label: 'Достижения', c: { kind: 'achievements', list: ACHIEVEMENTS.slice(0, 3) } },
    { label: 'План выполнен', c: { kind: 'plan', freshLeft: 12, extraEstimate: 10 } },
    { label: 'План: слов нет', c: { kind: 'plan', freshLeft: 0, extraEstimate: 0 } },
  ]
  return (
    <Section title="Праздники после урока">
      <div className="flex flex-wrap gap-2">
        {samples.map((x) => (
          <Button key={x.label} variant="secondary" onClick={() => setOpen(x.c)}>
            {x.label}
          </Button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-bg">
          <CelebrationScreen c={open} last onNext={() => setOpen(null)} />
        </div>
      )}
    </Section>
  )
}
