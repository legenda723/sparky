import { useLab } from './sheetLab'

/** ВРЕМЕННО: цифры замера листов поверх всех экранов (включается в витрине #/dev).
 *  Посередине: сверху шапка листа с «Отменой», снизу кнопки окна подтверждения. Касания проходят насквозь. */
export function ProbeOverlay() {
  const { probe, results } = useLab()
  if (!probe) return null
  return (
    <div className="pointer-events-none fixed inset-x-2 top-[40%] z-50 rounded-card border-2 border-border bg-bg px-3 py-2 text-caption font-bold text-text opacity-95">
      {results.length === 0 ? (
        <p className="m-0 text-muted">Замер: открой или закрой лист</p>
      ) : (
        results.slice(0, 3).map((r, i) => (
          <p key={i} className={`m-0 ${i ? 'text-muted' : ''}`}>
            {r.kind} ({r.impl}): пауза {r.delay} мс · 1-й шаг {r.firstStep}% · макс. шаг {r.maxStep}% · кадр до {r.maxFrame} мс · всего{' '}
            {r.total} мс
          </p>
        ))
      )}
    </div>
  )
}
