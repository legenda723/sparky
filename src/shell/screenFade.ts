// Мягкая смена экрана без сдвига (DESIGN.md → «Движение»): старый гаснет за 80 мс,
// новый проявляется с лёгким приближением. Одинаково для вкладок и «список ↔ колода».
export function screenFade<T>(enterSeconds: (key: T) => number) {
  return {
    enter: { opacity: 0, scale: 0.985 },
    center: (key: T) => ({
      opacity: 1,
      scale: 1,
      transition: { duration: enterSeconds(key), ease: [0.22, 1, 0.36, 1] as const },
    }),
    exit: { opacity: 0, transition: { duration: 0.08, ease: 'easeOut' as const } },
  }
}
