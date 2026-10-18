import { Target, Timer, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { markNudged } from '../backup/backup'
import { BackupNudge } from '../backup/BackupNudge'
import { SaveBackupSheet } from '../backup/BackupSheets'
import { backupAgeText, shouldNudgeAfterLesson } from '../backup/reminder'
import { db } from '../db/db'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/Mascot'

function Tile({ icon, value, label, ink, order }: { icon: ReactNode; value: string; label: string; ink: string; order: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: 'scale(0.9)' }}
      animate={{ opacity: 1, transform: 'scale(1)' }}
      transition={{ delay: 0.25 + order * 0.1, duration: 0.35, ease: [0.34, 1.4, 0.64, 1] }}
      className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-card border-2 border-border bg-surface p-3"
    >
      <span className={ink}>{icon}</span>
      <span className="text-title font-black text-text">{value}</span>
      <span className="text-caption font-extrabold text-muted">{label}</span>
    </motion.div>
  )
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface LessonSummaryProps {
  /** XP за урок вместе с бонусом за завершение. */
  xp: number
  bestStreak: number
  accuracy: number
  elapsedMs: number
  onDone: () => void
}

/** Итог урока (DESIGN.md → «Итог урока»): салют, XP, точность, время. */
export function LessonSummary({ xp, bestStreak, accuracy, elapsedMs, onDone }: LessonSummaryProps) {
  useConfetti()
  const nudge = useWeeklyBackupNudge()
  const [saveOpen, setSaveOpen] = useState(false)
  const phrase = accuracy === 100 ? 'Без единой ошибки!' : accuracy >= 80 ? 'Так держать!' : 'Каждый урок — шаг вперёд!'
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-[calc(16px+var(--safe-left))] text-center">
        <Mascot mood="cheer" size={140} />
        <h1 className="m-0 text-display font-black text-text">Урок пройден!</h1>
        <p className="m-0 text-body font-bold text-muted">{phrase}</p>
        <div className="mt-4 flex w-full gap-3">
          <Tile order={0} icon={<Zap size={24} strokeWidth={2.5} className="fill-current" />} value={String(xp)} label="XP" ink="text-xp-ink" />
          <Tile order={1} icon={<Target size={24} strokeWidth={2.5} />} value={`${accuracy}%`} label="Точность" ink="text-primary-ink" />
          <Tile order={2} icon={<Timer size={24} strokeWidth={2.5} />} value={formatDuration(elapsedMs)} label="Время" ink="text-streak-ink" />
        </div>
        {bestStreak >= 5 && <p className="m-0 mt-1 text-small font-bold text-muted">Лучшая серия: {bestStreak} подряд</p>}
        {nudge && (
          <div className="mt-4 w-full">
            <BackupNudge age={nudge.age} never={nudge.never} variant="secondary" onSave={() => setSaveOpen(true)} />
          </div>
        )}
      </div>
      <SaveBackupSheet open={saveOpen} onClose={() => setSaveOpen(false)} />
      <div className="px-[calc(16px+var(--safe-left))] pt-2 pb-[calc(16px+var(--safe-bottom))]">
        <Button block onClick={onDone}>
          Готово
        </Button>
      </div>
    </div>
  )
}

/** Раз в неделю, если копия старая, итог урока напоминает о ней (SPEC → 8.3). Решается один раз при показе итога, по свежим данным базы. */
function useWeeklyBackupNudge() {
  const [nudge, setNudge] = useState<{ age: string; never: boolean } | null>(null)
  useEffect(() => {
    let alive = true
    const now = Date.now()
    void Promise.all([db.profile.get('me'), db.cards.filter((c) => c.deletedAt === undefined).count()])
      .then(async ([profile, cards]) => {
        if (!alive || !shouldNudgeAfterLesson(profile?.lastBackupAt, profile?.backupNudgeAt, cards > 0, now)) return
        await markNudged(db, now)
        if (alive) setNudge({ age: backupAgeText(profile?.lastBackupAt, now), never: profile?.lastBackupAt === undefined })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return nudge
}

/** Салют при показе итога (без него — при «Уменьшении движения»). Библиотека грузится только здесь. */
function useConfetti() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    let reset: (() => void) | undefined
    void import('canvas-confetti').then(({ default: confetti }) => {
      if (!alive) return
      reset = () => confetti.reset()
      const css = getComputedStyle(document.documentElement)
      const colors = ['--c-primary', '--c-info', '--c-xp', '--c-gem', '--c-streak'].map((v) => css.getPropertyValue(v).trim())
      const shot = (x: number, angle: number) =>
        confetti({ particleCount: 60, spread: 70, startVelocity: 45, angle, origin: { x, y: 0.7 }, colors, disableForReducedMotion: true })
      shot(0.15, 60)
      shot(0.85, 120)
    })
    return () => {
      alive = false
      // Ушли с итога раньше, чем салют догорел, — убираем его.
      reset?.()
    }
  }, [])
}
