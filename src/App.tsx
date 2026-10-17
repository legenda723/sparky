import { MotionConfig } from 'motion/react'
import { lazy, Suspense } from 'react'
import { usePrefs } from './app/prefs'
import { useRoute } from './app/routes'
import { useApplyTheme } from './app/theme'
import { IphoneSim } from './shell/IphoneSim'
import { Shell } from './shell/Shell'
import { ToastProvider } from './ui/Toast'

// Витрина грузится отдельно и не замедляет открытие приложения.
const DevPage = lazy(() => import('./dev/DevPage'))

export default function App() {
  const prefs = usePrefs()
  const route = useRoute()
  useApplyTheme(prefs.theme, prefs.simIphone)

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {route === 'dev' ? (
          <Suspense fallback={null}>
            <DevPage />
          </Suspense>
        ) : (
          <Shell route={route} />
        )}
        {prefs.simIphone && <IphoneSim />}
      </ToastProvider>
    </MotionConfig>
  )
}
