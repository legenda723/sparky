// Мягкая смена экрана без сдвига (DESIGN.md → «Движение»): старый гаснет за 80 мс,
// новый проявляется с лёгким приближением. Одинаково для вкладок и «список ↔ колода».
export function screenFade<T>(enterSeconds: (key: T) => number) {
  return {
    // Целая строка transform (а не scale) — анимация идёт на видеокарте и не тормозит,
    // даже пока телефон занят открытием экрана.
    enter: { opacity: 0, transform: 'scale(0.985)' },
    center: (key: T) => ({
      opacity: 1,
      transform: 'scale(1)',
      transition: { duration: enterSeconds(key), ease: [0.22, 1, 0.36, 1] as const },
    }),
    exit: { opacity: 0, transition: { duration: 0.08, ease: 'easeOut' as const } },
  }
}
