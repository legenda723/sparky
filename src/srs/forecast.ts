// Сколько повторений добавят новые слова (SPEC 6.5, «Выучить ещё 5 новых слов»). Чистая функция.
// Оценка с запасом (просьба владельца): часть слов на первом повторении получит «Снова» — такое слово
// придёт ещё несколько раз (шаг переобучения, потом короткие интервалы). Считаются показы с завтрашнего дня
// в пределах недели (шаги обучения сегодня — внутри урока). Без разброса (fuzz) — число стабильное.
import { createEmptyCard, fsrs, Rating, type Grade } from 'ts-fsrs'
import { nextDayStart } from './day'

const DAY = 86_400_000

/** С запасом: столько новых слов из каждых 10 забудутся на первом повторении. */
export const FORGET_SHARE = 0.3

/** Показы одного слова с завтрашнего дня до конца окна; forgetFirst — на первом повторении «Снова». */
function showings(at: Date, retention: number, days: number, forgetFirst: boolean): number {
  const s = fsrs({
    request_retention: Math.min(0.95, Math.max(0.85, retention)),
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  })
  const tomorrow = nextDayStart(at).getTime()
  const end = tomorrow + days * DAY
  let card = createEmptyCard(at)
  let t = at
  let count = 0
  for (let i = 0; i < 50 && t.getTime() < end; i++) {
    // Повторение, назначенное на завтра и позже, приходит с 04:00 своего дня — это и есть новый показ.
    const future = t.getTime() >= tomorrow
    const grade: Grade = forgetFirst && future && count === 0 ? Rating.Again : Rating.Good
    if (future) count++
    card = s.next(card, t, grade).card
    t = card.due
  }
  return count
}

/** Повторений в ближайшие days дней от n новых слов — с запасом на «Снова», округлено вверх. */
export function extraReviewsEstimate(n: number, at: Date, retention: number, days = 7): number {
  const good = showings(at, retention, days, false)
  const forgot = showings(at, retention, days, true)
  return Math.ceil(n * ((1 - FORGET_SHARE) * good + FORGET_SHARE * forgot))
}
