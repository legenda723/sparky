/**
 * Режим «Как на iPhone 16» (DESIGN.md): рисует поверх экрана Dynamic Island и полоску «домой».
 * Отступы подменяются в index.css через :root[data-sim-iphone]. Цвета — как у «железа», не токены.
 */
export function IphoneSim() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="absolute top-[11px] left-1/2 h-[37px] w-[126px] -translate-x-1/2 rounded-full"
        style={{ background: 'rgba(0,0,0,0.85)' }}
      />
      <div
        className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full"
        style={{ background: 'rgba(128,128,128,0.75)' }}
      />
    </div>
  )
}
