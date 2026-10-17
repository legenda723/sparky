import { usePrefs } from './app/prefs'
import { useApplyTheme } from './app/theme'
import { greeting } from './greeting'

export default function App() {
  const prefs = usePrefs()
  useApplyTheme(prefs.theme, prefs.simIphone)
  return (
    <main className="grid h-full place-items-center px-4 text-center">
      <h1 className="text-display font-black text-primary">{greeting()}</h1>
    </main>
  )
}
