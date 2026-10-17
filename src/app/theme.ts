import { useEffect } from 'react'
import type { ThemePref } from './prefs'

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

// Совпадает с --c-bg: цвет полосы статус-бара в Safari.
const BG = { light: '#ffffff', dark: '#121a21' } as const

/** Ставит тему на <html> и цвет статус-бара; следит за сменой темы системы. */
export function useApplyTheme(pref: ThemePref, simIphone: boolean): void {
  useEffect(() => {
    const root = document.documentElement
    if (pref === 'system') delete root.dataset.theme
    else root.dataset.theme = pref

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const meta = document.querySelector('meta[name="theme-color"]')
      meta?.setAttribute('content', BG[resolveTheme(pref, media.matches)])
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [pref])

  useEffect(() => {
    const root = document.documentElement
    if (simIphone) root.dataset.simIphone = ''
    else delete root.dataset.simIphone
  }, [simIphone])
}
