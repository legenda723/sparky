// Движение листа снизу (DESIGN.md → «Движение»): Web Animations напрямую, без React и Motion.
// Отсчёт анимации начинаем в начале кадра, когда телефон уже свободен (выезд — ещё через кадр,
// когда новый лист нарисован). Иначе iPhone показывает первый кадр уже на трети пути — рывок.
// Двигаем только transform и opacity — это идёт на видеокарте.

export interface Timing {
  ms: number
  ease: string
}

/** Выезд: кривая листов iOS — уверенный старт и очень долгое мягкое «причаливание» у верха. */
export const SHEET_IN: Timing = { ms: 560, ease: 'cubic-bezier(0.32, 0.72, 0, 1)' }
/** Уход: трогается без толчка, плавно разгоняется и мягко замедляется внизу. */
export const SHEET_OUT: Timing = { ms: 480, ease: 'cubic-bezier(0.4, 0.1, 0.15, 1)' }
/** Возврат на место после свайпа: лист «оседает», а не прыгает. */
export const SHEET_SNAP: Timing = { ms: 480, ease: 'cubic-bezier(0.25, 1, 0.5, 1)' }
/** Уход с места, где отпустили палец: путь короче — быстрее, но не резче этого. */
const MIN_OUT_MS = 300
/** «Уменьшение движения»: только прозрачность. */
const FADE: Timing = { ms: 200, ease: 'ease-out' }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const shift = (px: number) => (px ? `translateY(${px}px)` : 'none')

/** Затемнение бледнеет по мере того, как лист уезжает. */
const dimAt = (px: number, height: number) => 1 - Math.min(1, Math.max(0, px / height))

/** Где лист сейчас (сдвиг вниз, px) — даже посреди анимации. */
function currentShift(el: HTMLElement): number {
  const t = getComputedStyle(el).transform
  return !t || t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42
}

/** Поставить лист на сдвиг px без анимации (палец тянет лист). */
export function place(panel: HTMLElement, dim: HTMLElement | null, px: number): void {
  panel.style.transform = shift(px)
  if (dim) dim.style.opacity = String(dimAt(px, panel.offsetHeight || 1))
}

/** Поставить лист за нижний край — перед выездом. */
export function hide(panel: HTMLElement, dim: HTMLElement | null): void {
  if (reducedMotion()) {
    panel.style.opacity = '0'
    if (dim) dim.style.opacity = '0'
  } else place(panel, dim, panel.offsetHeight)
}

type Target = 'open' | 'closed'

/** Номер последней анимации листа: новая отменяет ту, что ещё ждёт своего кадра. */
const generation = new WeakMap<HTMLElement, number>()

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/**
 * Довести лист из того места, где он сейчас, до открытого или закрытого положения.
 * true — доехал; false — его перебила другая анимация.
 */
export async function slide(panel: HTMLElement, dim: HTMLElement | null, target: Target, timing?: Timing): Promise<boolean> {
  const gen = (generation.get(panel) ?? 0) + 1
  generation.set(panel, gen)
  // Ждём кадр: всё, чем занят телефон после касания, успевает закончиться до старта отсчёта.
  // Новый лист — ещё кадр: сначала он рисуется (под нижним краем), потом едет.
  await nextFrame()
  if (target === 'open' && !panel.getAnimations().length && currentShift(panel) >= panel.offsetHeight - 1) await nextFrame()
  if (generation.get(panel) !== gen) return false

  const height = panel.offsetHeight || 1
  const from = currentShift(panel)
  const to = target === 'open' ? 0 : height
  const panelOpacity = getComputedStyle(panel).opacity
  const dimOpacity = dim ? getComputedStyle(dim).opacity : '0'
  for (const a of [...panel.getAnimations(), ...(dim?.getAnimations() ?? [])]) a.cancel()

  const reduce = reducedMotion()
  let t = timing ?? (target === 'open' ? SHEET_IN : SHEET_OUT)
  if (reduce) t = FADE
  else if (!timing && target === 'closed') {
    t = { ...t, ms: Math.max(MIN_OUT_MS, (t.ms * (to - from)) / height) }
  }
  const opts: KeyframeAnimationOptions = { duration: t.ms, easing: t.ease, fill: 'forwards' }

  const anims: Animation[] = []
  if (reduce) {
    // Без сдвига: лист на месте проявляется или гаснет.
    panel.style.transform = shift(target === 'open' ? 0 : from)
    anims.push(panel.animate([{ opacity: panelOpacity }, { opacity: target === 'open' ? 1 : 0 }], opts))
  } else {
    panel.style.opacity = ''
    anims.push(panel.animate([{ transform: shift(from) }, { transform: shift(to) }], opts))
  }
  if (dim) anims.push(dim.animate([{ opacity: dimOpacity }, { opacity: target === 'open' ? 1 : 0 }], opts))

  return Promise.all(anims.map((a) => a.finished)).then(
    () => {
      // Конечное положение — в стиль элемента, анимацию убираем (иначе она держит лист).
      for (const a of anims) {
        a.commitStyles()
        a.cancel()
      }
      return true
    },
    () => false,
  )
}
