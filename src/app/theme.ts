import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { setPref, type ThemePref } from './prefs'

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

// Совпадает с --c-bg: цвет полосы статус-бара в Safari.
const BG = { light: '#ffffff', dark: '#121a21' } as const

/** Ставит тему на <html> и цвет полосы статус-бара. */
function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[resolveTheme(pref, systemDark)])
}

// Сколько держим класс плавной смены темы (чуть дольше самого перехода в index.css).
const THEME_ANIM_MS = 260
let themeAnimTimer: number | undefined

/**
 * Смена темы владельцем: на время перехода все цвета на экране перетекают одновременно
 * и одинаково (класс theme-anim в index.css), без «снимков» экрана — поэтому без двоения.
 * При «Уменьшении движения» — сразу.
 */
export function changeTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-anim')
    window.clearTimeout(themeAnimTimer)
    themeAnimTimer = window.setTimeout(() => root.classList.remove('theme-anim'), THEME_ANIM_MS)
  }
  flushSync(() => setPref('theme', pref))
  applyTheme(pref)
}

/** Держит тему на <html> по настройке; следит за сменой темы системы. */
export function useApplyTheme(pref: ThemePref, simIphone: boolean): void {
  useEffect(() => {
    applyTheme(pref)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(pref)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [pref])

  useEffect(() => {
    const root = document.documentElement
    if (simIphone) root.dataset.simIphone = ''
    else delete root.dataset.simIphone
  }, [simIphone])
}
