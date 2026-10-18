// Выезд листа снизу (DESIGN.md → «Движение»): кривая как у листов iOS, на видеокарте
// (целая строка transform), поэтому плавно, даже пока телефон занят открытием формы.
export const SHEET_MOTION = {
  initial: { transform: 'translateY(100%)' },
  animate: { transform: 'translateY(0%)', transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const } },
  exit: { transform: 'translateY(100%)', transition: { duration: 0.24, ease: [0.4, 0, 1, 1] as const } },
}
