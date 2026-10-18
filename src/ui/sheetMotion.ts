// Выезд листа снизу (DESIGN.md → «Движение»): кривая как у листов iOS, на видеокарте
// (целая строка transform), поэтому плавно, даже пока телефон занят открытием формы.
export const SHEET_MOTION = {
  initial: { transform: 'translateY(100%)' },
  animate: { transform: 'translateY(0%)', transition: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const } },
  // Уезжает мягко: разгон без рывка в начале.
  exit: { transform: 'translateY(100%)', transition: { duration: 0.3, ease: [0.5, 0, 0.75, 0.25] as const } },
}

/** Затемнение под листом — в такт выезду. */
export const OVERLAY_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.32, ease: 'easeOut' as const } },
  exit: { opacity: 0, transition: { duration: 0.26, ease: 'easeIn' as const } },
}
