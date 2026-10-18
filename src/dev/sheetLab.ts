// ВРЕМЕННО (витрина #/dev): замер листов на iPhone и переключатель «Старые листы» для сравнения.
// Замер: от отпускания пальца записываем каждый кадр и положение листа ([data-sheet-panel]),
// пока он не встанет. Только в памяти и на экране — никуда не отправляется.
import { useSyncExternalStore } from 'react'

export interface ProbeResult {
  kind: 'открытие' | 'закрытие' | 'возврат'
  impl: 'новые' | 'старые'
  /** От отпускания пальца до первого кадра, где лист сдвинулся, мс */
  delay: number
  /** Какую часть пути лист уже прошёл в этом первом кадре, % */
  firstStep: number
  /** Самый большой шаг за один кадр, % пути */
  maxStep: number
  /** Самый долгий кадр, пока лист едет, мс */
  maxFrame: number
  /** От отпускания пальца до остановки, мс */
  total: number
  frames: number
}

interface LabState {
  probe: boolean
  legacy: boolean
  results: ProbeResult[]
}

const KEY = { probe: 'sparky.dev.probe', legacy: 'sparky.dev.legacySheets' }

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

let state: LabState = { probe: readFlag(KEY.probe), legacy: readFlag(KEY.legacy), results: [] }
const listeners = new Set<() => void>()
const emit = (next: Partial<LabState>) => {
  state = { ...state, ...next }
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useLab = () => useSyncExternalStore(subscribe, () => state)
export const useLegacySheets = () => useSyncExternalStore(subscribe, () => state.legacy)

export function setLabFlag(flag: 'probe' | 'legacy', on: boolean): void {
  try {
    localStorage.setItem(KEY[flag], on ? '1' : '0')
  } catch {
    // без сохранения — до перезапуска
  }
  emit({ [flag]: on })
  if (flag === 'probe') listen(on)
}

export const clearResults = () => emit({ results: [] })

/** Разбор записи: t0 — отпускание пальца, start/end — откуда и куда ехал лист, samples — кадры. */
export function analyze(t0: number, start: number, end: number, samples: { t: number; y: number }[]) {
  const dist = Math.abs(end - start)
  const moved = samples.findIndex((s) => Math.abs(s.y - start) > 1)
  if (dist < 20 || moved < 0) return null
  let last = start
  let lastT = samples[moved].t
  let maxStep = 0
  let maxFrame = 0
  let stopT = lastT
  for (let i = moved; i < samples.length; i++) {
    const { t, y } = samples[i]
    maxStep = Math.max(maxStep, Math.abs(y - last))
    if (i > moved) maxFrame = Math.max(maxFrame, t - lastT)
    if (y !== last) stopT = t
    last = y
    lastT = t
  }
  const pct = (px: number) => Math.round((px / dist) * 100)
  return {
    delay: Math.round(samples[moved].t - t0),
    firstStep: pct(Math.abs(samples[moved].y - start)),
    maxStep: pct(maxStep),
    maxFrame: Math.round(maxFrame),
    total: Math.round(stopT - t0),
    frames: samples.length - moved,
  }
}

const PANEL = '[data-sheet-panel]'
const panels = () => [...document.querySelectorAll<HTMLElement>(PANEL)]
const topOf = (el: HTMLElement) => el.getBoundingClientRect().top

let session = 0
let lastTapAt = -Infinity

function track(t0: number) {
  const id = ++session
  const impl: ProbeResult['impl'] = state.legacy ? 'старые' : 'новые'
  const initial = new Map(panels().map((p) => [p, topOf(p)]))
  let target: HTMLElement | null = null
  let start = 0
  let floor = 0 // нижний край слоя листа: отсюда выезжает и сюда уезжает
  let fresh = false
  let still = 0
  const samples: { t: number; y: number }[] = []

  const finish = (gone: boolean) => {
    const end = gone ? floor : (samples.at(-1)?.y ?? start)
    const r = analyze(t0, start, end, samples)
    if (!r) return
    const kind: ProbeResult['kind'] = fresh ? 'открытие' : gone || end > start ? 'закрытие' : 'возврат'
    emit({ results: [{ kind, impl, ...r }, ...state.results].slice(0, 6) })
  }

  const tick = (now: number) => {
    if (id !== session) return
    if (now - t0 > 3000) return target && finish(false)
    const list = panels()
    if (!target) {
      target = list.find((p) => !initial.has(p)) ?? null
      fresh = !!target
      if (!target) target = list.find((p) => Math.abs(topOf(p) - (initial.get(p) ?? 0)) > 1) ?? null
      if (target) {
        floor = target.parentElement?.getBoundingClientRect().bottom ?? window.innerHeight
        // Новый лист выезжает из-за нижнего края — даже если в первом кадре он уже на полпути.
        start = fresh ? floor : (initial.get(target) ?? 0)
      }
    }
    if (target) {
      if (!target.isConnected) return finish(true)
      const y = topOf(target)
      const prev = samples.at(-1)?.y
      samples.push({ t: now, y })
      // Встал: 8 кадров на месте после того, как сдвинулся.
      still = prev !== undefined && Math.abs(y - prev) < 0.5 && Math.abs(y - start) > 1 ? still + 1 : 0
      if (still >= 8) return finish(false)
    } else if (now - t0 > 2000) return // касание без листа
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// Отпускание пальца (pointerup и touchend приходят оба — берём первое).
function onTap(e: Event) {
  if (e.timeStamp - lastTapAt < 100) return
  lastTapAt = e.timeStamp
  track(e.timeStamp)
}

let listening = false
function listen(on: boolean) {
  if (on === listening || typeof document === 'undefined') return
  listening = on
  for (const type of ['pointerup', 'touchend'] as const) {
    if (on) document.addEventListener(type, onTap, { capture: true, passive: true })
    else document.removeEventListener(type, onTap, { capture: true })
  }
}
listen(state.probe)
