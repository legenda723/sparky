// ВРЕМЕННО (задача «Анимации как в iOS»): замер кадров во время каждой анимации.
// Считает кадры страницы (requestAnimationFrame) — это то, с какой частотой телефон
// перерисовывает страницу из JavaScript: следование за пальцем, анимации Motion по x/y/scale.
// Анимации листов (Web Animations) идут мимо этого счёта на видеокарте — их плавность
// видна глазом, а здесь видно, не была ли страница занята и с какой частотой она живёт.

export interface Episode {
  label: string
  /** длительность движения, мс */
  ms: number
  frames: number
  /** кадров в секунду в среднем */
  fps: number
  /** пропущено кадров против частоты страницы в покое */
  dropped: number
  /** самый долгий кадр, мс */
  worst: number
  /** от касания до первого кадра анимации, мс (если была анимация) */
  lag: number | null
  /** событий касания в секунду, пока тянули (если тянули) */
  touchRate: number | null
}

/** Обычный промежуток между кадрами в покое: медиана. */
export function baseInterval(intervals: number[]): number {
  if (!intervals.length) return 1000 / 60
  const s = [...intervals].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Итог по промежуткам между кадрами одного движения. */
export function summarize(intervals: number[], base: number): Pick<Episode, 'ms' | 'frames' | 'fps' | 'dropped' | 'worst'> {
  const ms = intervals.reduce((a, b) => a + b, 0)
  let dropped = 0
  for (const dt of intervals) dropped += Math.max(0, Math.round(dt / base) - 1)
  return {
    ms,
    frames: intervals.length,
    fps: ms > 0 ? (intervals.length * 1000) / ms : 0,
    dropped,
    worst: intervals.length ? Math.max(...intervals) : 0,
  }
}

export function formatEpisode(e: Episode): string {
  const parts = [
    `${(e.ms / 1000).toFixed(2)} с`,
    `${Math.round(e.fps)} к/с`,
    `пропущено ${e.dropped}`,
    `худший ${Math.round(e.worst)} мс`,
  ]
  if (e.lag !== null) parts.push(`отклик ${Math.round(e.lag)} мс`)
  if (e.touchRate !== null) parts.push(`касаний ${Math.round(e.touchRate)}/с`)
  return `${e.label}: ${parts.join(', ')}`
}

// ——— Сам замер (только в браузере) ———

/** После отпускания ещё столько ждём анимаций Motion (их не видно в getAnimations). */
const TAIL_MS = 700
/** Столько тишины — и движение закончилось. */
const QUIET_MS = 250

interface Live {
  label: string
  intervals: number[]
  times: number[]
  lastActive: number
  releasedAt: number
  pointerAt: number
  lag: number | null
  sawAnim: boolean
  moves: number
  dragStart: number
  dragEnd: number
}

let enabled = false
let raf = 0
let prev = 0
let live: Live | null = null
let touching = false
const idle: number[] = []
const episodes: Episode[] = []
const listeners = new Set<() => void>()
let badge: HTMLDivElement | null = null
let snapshot: { enabled: boolean; episodes: Episode[]; hz: number } = { enabled: false, episodes: [], hz: 60 }

function emit() {
  snapshot = { enabled, episodes: [...episodes], hz: Math.round(1000 / baseInterval(idle)) }
  for (const l of listeners) l()
}

export function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getSnapshot = () => snapshot

function labelOf(target: EventTarget | null): string {
  const el = target instanceof Element ? target.closest('[data-probe], button, a, [role="button"], [role="dialog"]') : null
  if (!el) return 'Касание'
  const text = el.getAttribute('data-probe') ?? el.getAttribute('aria-label') ?? el.textContent ?? ''
  return text.trim().replace(/\s+/g, ' ').slice(0, 28) || 'Касание'
}

/** Идёт ли сейчас конечная анимация (вечные — маскот и т.п. — не в счёт). */
const animRunning = () =>
  document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)

function onDown(e: PointerEvent) {
  const now = performance.now()
  touching = true
  if (!live) {
    live = {
      label: labelOf(e.target),
      intervals: [],
      times: [],
      lastActive: now,
      releasedAt: 0,
      pointerAt: now,
      lag: null,
      sawAnim: animRunning(),
      moves: 0,
      dragStart: 0,
      dragEnd: 0,
    }
  } else live.pointerAt = now
}
function onUp(e: Event) {
  // Палец: конец касания — по touchend (pointercancel приходит, когда начинается прокрутка).
  if (e instanceof PointerEvent && e.pointerType !== 'mouse') return
  touching = false
  if (live) {
    live.releasedAt = performance.now()
    live.pointerAt = live.releasedAt
  }
}
function onMove(e: Event) {
  if (e instanceof PointerEvent && e.pointerType !== 'mouse') return
  if (!live || !touching) return
  const now = performance.now()
  if (!live.moves) live.dragStart = now
  live.moves++
  live.dragEnd = now
  live.lastActive = now
}

function finish(l: Live) {
  // Хвост тишины не считаем.
  let n = l.times.length
  while (n > 0 && l.times[n - 1] > l.lastActive + 20) n--
  const intervals = l.intervals.slice(0, Math.max(1, n))
  const s = summarize(intervals, baseInterval(idle))
  const dragMs = l.dragEnd - l.dragStart
  const dragged = l.moves > 5 && dragMs > 50
  episodes.unshift({
    label: dragged ? `Свайп · ${l.label}` : l.label,
    ...s,
    lag: l.lag,
    touchRate: dragged ? (l.moves * 1000) / dragMs : null,
  })
  if (episodes.length > 40) episodes.length = 40
  if (badge) badge.textContent = `${Math.round(s.fps)} к/с · пропущено ${s.dropped} · худший ${Math.round(s.worst)} мс`
  emit()
}

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const dt = prev ? now - prev : 0
  prev = now
  if (!dt) return
  const l = live
  if (!l) {
    idle.push(dt)
    if (idle.length > 120) idle.shift()
    return
  }
  l.intervals.push(dt)
  l.times.push(now)
  const anim = animRunning()
  if (anim && !l.sawAnim) {
    l.sawAnim = true
    l.lag ??= now - l.pointerAt
  }
  if (!anim) l.sawAnim = false
  if (anim || touching) l.lastActive = now
  const sinceRelease = l.releasedAt ? now - l.releasedAt : 0
  if (!touching && now - l.lastActive > QUIET_MS && sinceRelease > TAIL_MS) {
    // Motion по x/y/scale — без getAnimations: считаем, что движение шло до TAIL_MS.
    if (l.lastActive < l.releasedAt + TAIL_MS && !l.lag) l.lastActive = Math.max(l.lastActive, l.releasedAt + TAIL_MS)
    live = null
    finish(l)
  }
}

export function setEnabled(on: boolean): void {
  if (on === enabled) return
  enabled = on
  if (on) {
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    window.addEventListener('pointerup', onUp, { capture: true, passive: true })
    window.addEventListener('touchend', onUp, { capture: true, passive: true })
    window.addEventListener('touchcancel', onUp, { capture: true, passive: true })
    window.addEventListener('touchmove', onMove, { capture: true, passive: true })
    window.addEventListener('pointermove', onMove, { capture: true, passive: true })
    badge = document.createElement('div')
    badge.style.cssText =
      'position:fixed;left:50%;top:calc(var(--safe-top) + 4px);transform:translateX(-50%);z-index:60;pointer-events:none;' +
      'font:800 12px Nunito,sans-serif;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;white-space:nowrap'
    badge.textContent = 'Замер включён'
    document.body.append(badge)
    prev = 0
    raf = requestAnimationFrame(tick)
  } else {
    window.removeEventListener('pointerdown', onDown, { capture: true })
    window.removeEventListener('pointerup', onUp, { capture: true })
    window.removeEventListener('touchend', onUp, { capture: true })
    window.removeEventListener('touchcancel', onUp, { capture: true })
    window.removeEventListener('touchmove', onMove, { capture: true })
    window.removeEventListener('pointermove', onMove, { capture: true })
    cancelAnimationFrame(raf)
    badge?.remove()
    badge = null
    live = null
  }
  emit()
}

export function clearEpisodes(): void {
  episodes.length = 0
  emit()
}

export function report(): string {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const head = `Частота страницы в покое: ${snapshot.hz} Гц · ${standalone ? 'с экрана Домой' : 'в Safari'} · ${navigator.userAgent.match(/OS [\d_]+/)?.[0] ?? ''}`
  return [head, ...[...episodes].reverse().map(formatEpisode)].join('\n')
}
