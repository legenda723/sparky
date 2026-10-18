// Выезд листа снизу (DESIGN.md → «Движение»). Целая строка transform — анимация на видеокарте,
// поэтому плавно, даже пока телефон занят открытием формы.
// Появление: мягкий старт и долгое плавное торможение у верха.
// Уход: трогается сразу (без ощущения задержки) и мягко замедляется внизу.
const IN = { duration: 0.46, ease: [0.2, 0.8, 0.2, 1] as const }
const OUT = { duration: 0.36, ease: [0.3, 0.55, 0.3, 1] as const }

export const SHEET_MOTION = {
  initial: { transform: 'translateY(100%)' },
  animate: { transform: 'translateY(0%)', transition: IN },
  exit: { transform: 'translateY(100%)', transition: OUT },
}

/** Затемнение под листом — в такт выезду. */
export const OVERLAY_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
  exit: { opacity: 0, transition: OUT },
}
