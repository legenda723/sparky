// «Шторка» — основа листов снизу и экрана колоды (DESIGN.md → «Движение»).
//
// Шторка — это прокрутка с двумя положениями («закрыто» и «открыто», scroll-snap).
// Тянет её палец силами самого iPhone, как обычный список: 120 кадров (в энергосбережении 60),
// и отпущенная шторка доезжает по инерции с той скоростью, с какой её бросили.
// Наш код двигает шторку, только когда она открывается или закрывается кнопкой:
// пружиной на видеокарте (Web Animations), сдвигом всей прокрутки. Эту анимацию можно
// поймать пальцем — шторка останавливается там, где она сейчас, и дальше её тянет прокрутка.
import { sheetSpring, springCurve, type Spring } from './spring'

export type Axis = 'x' | 'y'

export interface Drawer {
  /** прокрутка: «пустое место» (закрыто) + сама шторка (открыто) */
  scroller: HTMLElement
  /** затемнение под шторкой (прозрачность 0…1 — насколько шторка открыта) */
  dim: HTMLElement | null
  axis: Axis
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

const pos = (d: Drawer) => (d.axis === 'y' ? d.scroller.scrollTop : d.scroller.scrollLeft)
const setPos = (d: Drawer, v: number) => {
  if (d.axis === 'y') d.scroller.scrollTop = v
  else d.scroller.scrollLeft = v
}
/** Насколько можно прокрутить = размер шторки. */
const span = (d: Drawer) =>
  d.axis === 'y' ? d.scroller.scrollHeight - d.scroller.clientHeight : d.scroller.scrollWidth - d.scroller.clientWidth
const shift = (d: Drawer, px: number) => (px ? `translate${d.axis === 'y' ? 'Y' : 'X'}(${px}px)` : 'none')

/** Текущий сдвиг прокрутки (px) — даже посреди анимации. */
function currentShift(d: Drawer): number {
  const t = getComputedStyle(d.scroller).transform
  if (!t || t === 'none') return 0
  const m = new DOMMatrixReadOnly(t)
  return d.axis === 'y' ? m.m42 : m.m41
}

const animations = (d: Drawer) => [...d.scroller.getAnimations(), ...(d.dim?.getAnimations() ?? [])]
export const isAnimating = (d: Drawer) => animations(d).length > 0

/** Насколько шторка открыта сейчас: 0…1. */
function openness(d: Drawer): number {
  const s = span(d) || 1
  return Math.min(1, Math.max(0, (pos(d) - currentShift(d)) / s))
}

/**
 * Safari 26+: затемнение само следует за прокруткой на видеокарте (CSS scroll-timeline,
 * классы drawer-* в index.css) — ровно и в энергосбережении. Иначе — из JavaScript.
 */
const dimFollowsScroll =
  typeof CSS !== 'undefined' && CSS.supports('animation-timeline: --a') && CSS.supports('timeline-scope: --a')

/** Затемнение следует за прокруткой (палец тянет шторку) — только когда шторка не едет сама. */
function follow(d: Drawer, on: boolean): void {
  if (!d.dim || !dimFollowsScroll) return
  if (on) d.dim.setAttribute('data-follow', '')
  else d.dim.removeAttribute('data-follow')
}

/** Затемнение — в такт прокрутке (палец тянет шторку). */
export function syncDim(d: Drawer): void {
  if (d.dim && !dimFollowsScroll && !isAnimating(d)) d.dim.style.opacity = String(openness(d))
}

/** Закрыта ли шторка пальцем (доехала до «пустого места»). */
export const closedByScroll = (d: Drawer) => !isAnimating(d) && pos(d) <= 0.5

/** До первого кадра: прокрутка на «открыто», но вся сдвинута за край — оттуда и выезжаем. */
export function placeClosed(d: Drawer): void {
  setPos(d, span(d))
  if (reducedMotion()) d.scroller.style.opacity = '0'
  else d.scroller.style.transform = shift(d, span(d))
  if (d.dim) d.dim.style.opacity = '0'
}

/** Номер последней анимации: новая отменяет ту, что ещё ждёт своего кадра. */
const generation = new WeakMap<HTMLElement, number>()

async function run(d: Drawer, target: 'open' | 'closed', spring?: Spring): Promise<boolean> {
  const gen = (generation.get(d.scroller) ?? 0) + 1
  generation.set(d.scroller, gen)
  // Отсчёт — с кадра, когда телефон уже свободен после касания (новая шторка — ещё через кадр,
  // когда она нарисована за краем). Иначе первый показанный кадр — уже на трети пути.
  await nextFrame()
  if (target === 'open' && !isAnimating(d) && currentShift(d) >= span(d) - 1) await nextFrame()
  if (generation.get(d.scroller) !== gen) return false

  const reduce = reducedMotion()
  const from = currentShift(d)
  // Закрытие: сдвигаем прокрутку на то, что ещё видно, — шторка уходит за край.
  const to = target === 'open' ? 0 : pos(d)
  const scrollerOpacity = getComputedStyle(d.scroller).opacity
  const dimFrom = d.dim ? getComputedStyle(d.dim).opacity : '0'
  for (const a of animations(d)) a.cancel()
  follow(d, false)
  if (d.dim) d.dim.style.opacity = dimFrom

  const curve = reduce ? { ms: 200, easing: 'ease-out' } : springCurve(spring ?? sheetSpring(span(d)), to - from)
  const opts: KeyframeAnimationOptions = { duration: curve.ms, easing: curve.easing, fill: 'forwards' }
  const anims: Animation[] = []
  if (reduce) {
    anims.push(d.scroller.animate([{ opacity: scrollerOpacity }, { opacity: target === 'open' ? 1 : 0 }], opts))
  } else {
    d.scroller.style.opacity = ''
    anims.push(d.scroller.animate([{ transform: shift(d, from) }, { transform: shift(d, to) }], opts))
  }
  if (d.dim) anims.push(d.dim.animate([{ opacity: dimFrom }, { opacity: target === 'open' ? 1 : 0 }], opts))

  return Promise.all(anims.map((a) => a.finished)).then(
    () => {
      // Конечное положение — в стиль, анимацию убираем (иначе она держит шторку).
      for (const a of anims) {
        a.commitStyles()
        a.cancel()
      }
      if (target === 'open') follow(d, true)
      return true
    },
    () => false,
  )
}

/** Выехать из того места, где шторка сейчас. true — доехала, false — перебили или поймали. */
export const openDrawer = (d: Drawer, spring?: Spring) => run(d, 'open', spring)
/** Уехать за край. true — уехала, false — перебили или поймали пальцем. */
export const closeDrawer = (d: Drawer, spring?: Spring) => run(d, 'closed', spring)

/**
 * Палец коснулся шторки, пока она едет: остановить её там, где она сейчас, и отдать прокрутке —
 * дальше её тянет палец, а отпущенная она сама доедет до «открыто» или «закрыто».
 */
export function catchDrawer(d: Drawer): void {
  if (!isAnimating(d) || reducedMotion()) return
  generation.set(d.scroller, (generation.get(d.scroller) ?? 0) + 1)
  const s = currentShift(d)
  const dimNow = d.dim ? getComputedStyle(d.dim).opacity : '0'
  for (const a of animations(d)) a.cancel()
  d.scroller.style.transform = ''
  setPos(d, Math.max(0, pos(d) - s))
  if (d.dim) d.dim.style.opacity = dimNow
  follow(d, true)
}
