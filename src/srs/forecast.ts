// Сколько повторений добавят новые слова (SPEC 6.5, «Выучить ещё 5 новых слов»). Чистая функция.
// Оценка: каждое слово проходит урок и потом отвечается «Хорошо» в срок; считаются показы с завтрашнего дня
// в пределах недели (шаги обучения сегодня — внутри урока, их не считаем). Без разброса (fuzz) — число стабильное.
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'
import { nextDayStart } from './day'

const DAY = 86_400_000

/** Повторений в ближайшие days дней от n новых слов. */
export function extraReviewsEstimate(n: number, at: Date, retention: number, days = 7): number {
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
  let reviews = 0
  for (let i = 0; i < 50; i++) {
    card = s.next(card, t, Rating.Good).card
    t = card.due
    if (t.getTime() >= end) break
    // Повторение, назначенное на завтра и позже, приходит с 04:00 своего дня — это и есть новый показ.
    if (t.getTime() >= tomorrow) reviews++
  }
  return reviews * n
}
