// Движение листа снизу (DESIGN.md → «Движение»): Web Animations напрямую, без React и Motion.
// Анимацию запускаем прямо в обработчике касания, а браузер сам ставит ей старт на первый
// показанный кадр. Поэтому, пока телефон занят (перерисовка экрана), лист не «догоняет»
// пропущенное время рывком. Двигаем только transform и opacity — это идёт на видеокарте.

export interface Timing {
  ms: number
  ease: string
}

/** Выезд: мягкий старт и долгое плавное торможение у верха. */
export const SHEET_IN: Timing = { ms: 460, ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
/** Уход: трогается сразу и мягко замедляется внизу. */
export const SHEET_OUT: Timing = { ms: 360, ease: 'cubic-bezier(0.3, 0.55, 0.3, 1)' }
/** Возврат на место после свайпа: лист «оседает», а не прыгает. */
export const SHEET_SNAP: Timing = { ms: 480, ease: 'cubic-bezier(0.25, 1, 0.5, 1)' }
/** Уход с места, где отпустили палец: путь короче — быстрее, но не резче этого. */
const MIN_OUT_MS = 200
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

/**
 * Довести лист из того места, где он сейчас, до открытого или закрытого положения.
 * true — доехал; false — его перебила другая анимация.
 */
export function slide(panel: HTMLElement, dim: HTMLElement | null, target: Target, timing?: Timing): Promise<boolean> {
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
