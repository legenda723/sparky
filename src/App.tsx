import { MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { isStandalone, readContinued, requestPersistentStorage, saveContinued, shouldShowInstall } from './app/install'
import { loadPrefs, usePrefs } from './app/prefs'
import { useRoute, useSubPath } from './app/routes'
import { useApplyTheme } from './app/theme'
import { Updater } from './app/Updater'
import { InstallScreen } from './screens/InstallScreen'
import { IphoneSim } from './shell/IphoneSim'
import { Shell } from './shell/Shell'
import { ToastProvider } from './ui/Toast'
import { prefetchWords } from './words/prefetch'

// Витрина грузится отдельно и не замедляет открытие приложения.
const DevPage = lazy(() => import('./dev/DevPage'))
const LessonScreen = lazy(() => import('./lesson/LessonScreen'))

export default function App() {
  const prefs = usePrefs()
  const route = useRoute()
  // Урок за уроком («+5 новых», «Тренировка» с экрана «План выполнен») — новый экран урока.
  const sub = useSubPath()
  useApplyTheme(prefs.theme, prefs.simIphone)
  const [showInstall, setShowInstall] = useState(() =>
    shouldShowInstall(import.meta.env.PROD, isStandalone(), readContinued()),
  )

  // В веб-приложении просим iPhone не стирать данные при нехватке места (SPEC 8.3).
  useEffect(() => {
    if (isStandalone()) void requestPersistentStorage()
  }, [])

  // Настройки из базы (тема уже стоит из быстрой копии, здесь — сверка).
  useEffect(() => {
    void loadPrefs().catch(() => {})
    void prefetchWords().catch(() => {})
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {showInstall ? (
          <InstallScreen
            onContinue={() => {
              saveContinued()
              setShowInstall(false)
            }}
          />
        ) : route === 'dev' ? (
          <Suspense fallback={null}>
            <DevPage />
          </Suspense>
        ) : route === 'lesson' ? (
          <Suspense fallback={null}>
            <LessonScreen key={sub} />
          </Suspense>
        ) : (
          <Shell route={route} />
        )}
        {prefs.simIphone && <IphoneSim />}
        <Updater />
      </ToastProvider>
    </MotionConfig>
  )
}
