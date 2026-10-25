import { Settings } from 'lucide-react'
import { useState } from 'react'
import { navigateSub, useSubPath } from '../app/routes'
import { db } from '../db/db'
import { loadProfileGame, PROFILE_GAME_KEY } from '../db/game'
import { useCachedLiveQuery } from '../db/liveCache'
import { AchievementsScreen, ProfileGameSection } from '../profile/ProfileGame'
import { PushScreen } from '../shell/PushScreen'
import { Screen } from '../shell/Screen'
import { now } from '../srs/clock'
import { IconButton } from '../ui/IconButton'
import { SettingsScreen, useBackupDue } from './SettingsScreen'

type Sub = 'settings' | 'achievements'

/** Вкладка «Профиль»: профиль владельца; поверх въезжают «Настройки» (#/profile/settings) и «Достижения». */
export function ProfileScreen() {
  const raw = useSubPath().split('/')[0]
  const sub: Sub | null = raw === 'settings' || raw === 'achievements' ? raw : null
  // Пока вложенный экран уезжает, на нём остаётся то же.
  const [shown, setShown] = useState(sub)
  if (sub && sub !== shown) setShown(sub)
  const g = useCachedLiveQuery(PROFILE_GAME_KEY, () => loadProfileGame(db, now()), [])
  const backupDue = useBackupDue()
  const back = () => navigateSub('profile')
  return (
    <>
      <div className="absolute inset-0" inert={sub ? true : undefined}>
        <Screen
          title="Профиль"
          action={
            <IconButton label={backupDue ? 'Настройки — пора сохранить копию' : 'Настройки'} large className="-mr-2.5 text-muted" onClick={() => navigateSub('profile', 'settings')}>
              <span className="relative">
                <Settings size={26} />
                {backupDue && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-bg bg-streak" />}
              </span>
            </IconButton>
          }
        >
          {g && <ProfileGameSection g={g} onAchievements={() => navigateSub('profile', 'achievements')} />}
        </Screen>
      </div>
      <PushScreen open={sub !== null} onClose={back}>
        {shown === 'settings' && <SettingsScreen onBack={back} />}
        {shown === 'achievements' && <AchievementsScreen have={g?.achievements ?? []} onBack={back} />}
      </PushScreen>
    </>
  )
}
