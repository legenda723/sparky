// ВРЕМЕННО (задача «Анимации как в iOS»): стенд движения в витрине.
// Замер кадров, все окна на одной странице и два опыта: «видеокарта против JavaScript»
// и лист на встроенной прокрутке браузера.
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { FormSheet } from '../ui/FormSheet'
import { Sheet } from '../ui/Sheet'
import { Switch } from '../ui/Switch'
import { TextField } from '../ui/TextField'
import { useToast } from '../ui/Toast'
import { clearEpisodes, formatEpisode, getSnapshot, report, setEnabled, subscribe } from './frameProbe'

export function MotionLab() {
  const probe = useSyncExternalStore(subscribe, getSnapshot)
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState(false)
  const [scrollSheet, setScrollSheet] = useState(false)
  const toast = useToast()

  return (
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="m-0 text-heading font-black text-text">Движение (временно)</h2>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-body font-bold">Замер кадров</span>
        <Switch label="Замер кадров" checked={probe.enabled} onChange={setEnabled} />
      </div>
      {probe.enabled && (
        <p className="m-0 text-small font-semibold text-muted">
          Частота страницы в покое: {probe.hz} Гц. Замер работает во всём приложении, пока не выключишь.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" data-probe="Окно подтверждения" onClick={() => setSheet(true)}>
          Окно
        </Button>
        <Button variant="secondary" data-probe="Полноэкранный лист" onClick={() => setForm(true)}>
          Лист
        </Button>
        <Button variant="secondary" data-probe="Тост" onClick={() => toast({ message: 'Слово сохранено' })}>
          Тост
        </Button>
        <Button variant="info" data-probe="Лист на прокрутке" onClick={() => setScrollSheet(true)}>
          Опыт: лист
        </Button>
      </div>

      <RaceTest />

      {probe.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard.writeText(report()).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >
              {copied ? 'Готово' : 'Скопировать'}
            </Button>
            <Button variant="secondary" onClick={clearEpisodes}>
              Очистить
            </Button>
          </div>
          <ol className="m-0 flex flex-col gap-1 p-0 pl-5 text-caption font-bold text-text">
            {probe.episodes.map((e, i) => (
              <li key={probe.episodes.length - i}>{formatEpisode(e)}</li>
            ))}
          </ol>
        </>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Удалить колоду «Еда»?" text="40 слов спрячутся. Отменить можно в течение 5 секунд.">
        <Button block variant="danger" onClick={() => setSheet(false)}>
          Удалить
        </Button>
        <Button block variant="secondary" onClick={() => setSheet(false)}>
          Отмена
        </Button>
      </Sheet>
      <FormSheet open={form} title="Новое слово" onCancel={() => setForm(false)} onDone={() => setForm(false)}>
        <TextField label="Слово" defaultValue="apple" />
        <TextField label="Перевод" defaultValue="яблоко" />
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="m-0 text-body font-semibold text-muted">
            Строка {i + 1}: прокрути вниз и обратно вверх, потом потяни лист вниз.
          </p>
        ))}
      </FormSheet>
      {scrollSheet && <ScrollSheet onClosed={() => setScrollSheet(false)} />}
    </section>
  )
}

/** Опыт 1: один квадрат едет на видеокарте (Web Animations), другой — из JavaScript (каждый кадр). */
function RaceTest() {
  const gpu = useRef<HTMLDivElement>(null)
  const js = useRef<HTMLDivElement>(null)
  const [load, setLoad] = useState(false)

  const run = () => {
    const a = gpu.current
    const b = js.current
    if (!a || !b) return
    const track = (a.parentElement?.clientWidth ?? 300) - a.offsetWidth
    const ms = 1200
    const cycles = 3
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) // как ease-in-out
    a.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${track}px)` }], {
      duration: ms,
      iterations: cycles * 2,
      direction: 'alternate',
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
    })
    const start = performance.now()
    const step = (now: number) => {
      const t = (now - start) / ms
      if (t >= cycles * 2) return void (b.style.transform = 'translateX(0)')
      const k = Math.floor(t)
      const p = ease(t - k)
      b.style.transform = `translateX(${(k % 2 ? 1 - p : p) * track}px)`
      if (load) {
        // Нагрузка: страница «занята» 40 мс — как при открытии тяжёлого экрана.
        const busy = performance.now() + 40
        while (performance.now() < busy) {
          /* ждём */
        }
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border-2 border-border p-3">
      <p className="m-0 text-small font-bold text-muted">Опыт: верхний квадрат — видеокарта, нижний — JavaScript. Какой ровнее?</p>
      <Lane>
        <div ref={gpu} className="size-8 rounded-[10px] bg-primary" />
      </Lane>
      <Lane>
        <div ref={js} className="size-8 rounded-[10px] bg-info" />
      </Lane>
      <div className="flex items-center gap-3">
        <Button variant="secondary" data-probe="Опыт: квадраты" onClick={run} className="flex-1">
          Пуск
        </Button>
        <span className="text-small font-bold">С нагрузкой</span>
        <Switch label="С нагрузкой" checked={load} onChange={setLoad} />
      </div>
    </div>
  )
}

function Lane({ children }: { children: ReactNode }) {
  return <div className="rounded-[12px] bg-surface p-1">{children}</div>
}

/**
 * Опыт 2: лист на встроенной прокрутке браузера (scroll-snap). Тянется за пальцем силами
 * самого iPhone (как прокрутка списка), затемнение привязано к прокрутке без JavaScript.
 */
function ScrollSheet({ onClosed }: { onClosed: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const opened = useRef(false)

  const close = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })

  return createPortal(
    <div
      ref={(el) => {
        scroller.current = el
        if (!el || opened.current) return
        opened.current = true
        requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
      }}
      className="probe-scroll-sheet fixed inset-0 z-40 overflow-y-scroll overscroll-contain no-scrollbar"
      onScroll={(e) => {
        const el = e.currentTarget
        if (opened.current && el.scrollTop <= 1 && el.dataset.shown) onClosed()
        if (el.scrollTop > 40) el.dataset.shown = '1'
      }}
    >
      <style>{`
        .probe-scroll-sheet { scroll-snap-type: y mandatory; scroll-timeline: --probe-sheet y; }
        .probe-scroll-dim { animation: probe-dim linear both; animation-timeline: --probe-sheet; }
        @keyframes probe-dim { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
      <div className="probe-scroll-dim pointer-events-none fixed inset-0 bg-overlay" />
      <div className="h-full snap-start" onClick={close} />
      <div className="relative snap-end rounded-t-panel bg-bg px-4 pt-6 pb-[calc(16px+var(--safe-bottom))]">
        <h2 className="m-0 text-center text-heading font-black text-text">Лист на прокрутке</h2>
        <p className="m-0 mt-3 text-center text-small font-semibold text-muted">
          Потяни вниз и отпусти — быстро или медленно. Сравни с обычным «Окном».
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Button block variant="secondary" onClick={close}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
