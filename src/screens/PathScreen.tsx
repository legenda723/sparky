// Временный экран «Путь» (до этапа 7): кнопка «УЧИТЬ» и что ждёт сегодня.
import { navigate } from '../app/routes'
import { Screen } from '../shell/Screen'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import { loadLessonInput } from '../db/review'
import { unlockSpeech } from '../media/speech'
import { now } from '../srs/clock'
import { todayCounts } from '../srs/lesson'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/Mascot'

async function countToday() {
  const at = now()
  const input = await loadLessonInput(db, at)
  return todayCounts(input.cards, input.deckOrder, at, input.limits)
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body font-bold text-text">{label}</span>
      <span className="text-heading font-black text-text">{value}</span>
    </div>
  )
}

export function PathScreen() {
  const counts = useCachedLiveQuery('path:today', countToday, [])
  const hasWork = counts !== undefined && counts.due + counts.newAvailable > 0

  return (
    <Screen title="Путь">
      <div className="flex flex-col items-center gap-5 pt-[6vh]">
        <Mascot size={120} />
        {counts && (
          <>
            <div className="flex w-full flex-col gap-3 rounded-card border-2 border-border bg-surface p-4">
              <Row label="Повторить" value={counts.due} />
              <Row label="Новых слов" value={counts.newAvailable} />
            </div>
            {hasWork ? (
              <Button
                block
                onClick={() => {
                  // iOS разрешает озвучку только из касания — «будим» её здесь на весь урок.
                  unlockSpeech()
                  navigate('lesson')
                }}
              >
                Учить
              </Button>
            ) : (
              <>
                <p className="m-0 text-center text-body font-bold text-muted">На сегодня всё! Добавь новые слова или загляни завтра.</p>
                <Button variant="secondary" block onClick={() => navigate('words')}>
                  Добавить слова
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
