// «Резинка» пути (DESIGN.md → «Туман пути»): своя, а не родная iPhone. Родная двигает путь сама, а продолжение
// тумана под путём узнаёт об этом на кадр позже — при быстром рывке оно отстаёт, «как желе». Здесь путь и
// продолжение тумана сдвигаются одной записью в одном кадре — это одно полотно. Только transform.
import { useLayoutEffect, type RefObject } from 'react'

/** Чем дальше тянешь, тем туже — как у iPhone (h — высота окна прокрутки). */
const rubber = (x: number, h: number) => (1 - 1 / ((x * 0.55) / h + 1)) * h
/** Возврат после отпускания, мс. */
const SETTLE = 450
/** Пружинка, когда путь с разгона долетел до края, мс. */
const BOUNCE = 500

/**
 * scrollRef — прокрутка пути (сдвигается её содержимое), belowRef — продолжение тумана под путём (едет вместе
 * с путём и при прокрутке). Родную «резинку» у прокрутки выключить: overscroll-behavior-y: none.
 */
export function useRubberBand(
  scrollRef: RefObject<HTMLDivElement | null>,
  belowRef: RefObject<HTMLDivElement | null>,
  reduce: boolean,
  belowKey: unknown,
) {
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!box) return
    // Сколько путь оттянут: + — вверх (снизу открылся туман), − — вниз (сверху фон). raw — сколько протянул палец.
    let raw = 0
    let pull = 0
    let lastY: number | null = null
    let frame = 0
    let lastTop = box.scrollTop
    let lastTime = performance.now()
    let speed = 0

    const apply = () => {
      const content = box.firstElementChild as HTMLElement | null
      if (content) content.style.transform = pull ? `translateY(${-pull}px)` : ''
      const below = belowRef.current
      if (below) below.style.transform = `translateY(${-(box.scrollTop + pull)}px)`
    }
    const setRaw = (value: number) => {
      raw = value
      const h = box.clientHeight
      pull = raw > 0 ? rubber(raw, h) : raw < 0 ? -rubber(-raw, h) : 0
      apply()
    }
    const play = (duration: number, at: (t: number) => number) => {
      cancelAnimationFrame(frame)
      if (reduce) {
        raw = 0
        pull = 0
        apply()
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        pull = at(t)
        apply()
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    // Отпустил — путь мягко возвращается (как у iPhone: быстро в начале, плавно в конце).
    const settle = () => {
      const from = pull
      raw = 0
      if (from) play(SETTLE, (t) => from * (1 - t) ** 3)
    }

    const atEnd = () => box.scrollTop >= box.scrollHeight - box.clientHeight - 1
    const atStart = () => box.scrollTop <= 0

    const onStart = (e: TouchEvent) => {
      cancelAnimationFrame(frame)
      lastY = e.touches[0].clientY
      // Поймал путь на возврате — тянется дальше с того же места.
      const h = box.clientHeight
      const p = Math.max(-h * 0.9, Math.min(h * 0.9, pull))
      raw = p === 0 ? 0 : (Math.sign(p) * (1 / (1 - Math.abs(p) / h) - 1) * h) / 0.55
    }
    const onMove = (e: TouchEvent) => {
      if (lastY === null) return
      const y = e.touches[0].clientY
      const delta = lastY - y // + — палец идёт вверх (путь листается вниз)
      lastY = y
      if (raw > 0 || (raw === 0 && delta > 0 && atEnd())) {
        e.preventDefault()
        setRaw(Math.max(0, raw + delta))
      } else if (raw < 0 || (raw === 0 && delta < 0 && atStart())) {
        e.preventDefault()
        setRaw(Math.min(0, raw + delta))
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length) return
      lastY = null
      settle()
    }
    // Прокрутка: продолжение тумана едет за путём; долетел с разгона до края — небольшая пружинка.
    const onScroll = () => {
      const now = performance.now()
      const top = box.scrollTop
      if (now > lastTime) speed = (top - lastTop) / (now - lastTime)
      const hitEnd = lastTop < box.scrollHeight - box.clientHeight - 1 && atEnd()
      const hitStart = lastTop > 0 && atStart()
      lastTop = top
      lastTime = now
      apply()
      if (lastY !== null || pull) return
      if ((hitEnd && speed > 0.3) || (hitStart && speed < -0.3)) {
        const amp = Math.sign(speed) * Math.min(Math.abs(speed) * 30, 64)
        play(BOUNCE, (t) => amp * Math.sin(Math.PI * t) * (1 - t))
      }
    }

    apply()
    box.addEventListener('touchstart', onStart, { passive: true })
    box.addEventListener('touchmove', onMove, { passive: false })
    box.addEventListener('touchend', onEnd)
    box.addEventListener('touchcancel', onEnd)
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      box.removeEventListener('touchstart', onStart)
      box.removeEventListener('touchmove', onMove)
      box.removeEventListener('touchend', onEnd)
      box.removeEventListener('touchcancel', onEnd)
      box.removeEventListener('scroll', onScroll)
      const content = box.firstElementChild as HTMLElement | null
      if (content) content.style.transform = ''
    }
  }, [scrollRef, belowRef, reduce, belowKey])
}
