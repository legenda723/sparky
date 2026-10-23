// Дорожка раздела (DESIGN.md → «Дорожка пути»): места по волне, маскот и искорки по бокам.
import type { DeckColor } from '../db/types'
import type { PathItem } from '../game/path'
import type { ViewEntry } from '../game/pathView'
import { Mascot } from '../ui/Mascot'
import { ChestButton } from './ChestButton'
import { GhostButton } from './GhostButton'
import { PathNodeButton } from './PathNodeButton'

/** Сдвиг вбок по волне. */
export const WAVE = [0, 44, 70, 44, 0, -44, -70, -44]
/** Маскот сидит у 3-го места раздела. */
const MASCOT_AT = 2
/** Высота ряда — у всех мест одинаковая, как в образце (references/путь-duolingo.jpg): путь ровный. */
export const ROW = 84

export const itemId = (item: PathItem) => `${item.kind}:${item.key}`

/** Искорка у дорожки: четырёхлучевая звёздочка. */
function Sparkle({ size, delay }: { size: number; delay: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="path-twinkle" style={{ animationDelay: `${delay}s` }}>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="var(--c-xp)" />
    </svg>
  )
}

interface TrackProps {
  entries: ViewEntry[]
  color: DeckColor
  /** Номер раздела: в чётных волна зеркальная. */
  number: number
  /** Сколько уроков в разделе всего (для «Урок 3 из 5»). */
  nodeCount: number
  burst: { id: string; gems: number } | null
  openedHere: ReadonlySet<string>
  setRef: (id: string, el: HTMLElement | null) => void
  onSelect: (item: PathItem) => void
}

export function PathTrack({ entries, color, number, nodeCount, burst, openedHere, setRef, onSelect }: TrackProps) {
  const sign = number % 2 === 0 ? -1 : 1
  const firstFogged = entries.findIndex((e) => e.fogged)
  // Маскот — у 3-го видимого места, но не под туманом.
  const clear = firstFogged < 0 ? entries.length : firstFogged
  const mascotAt = clear > 1 ? Math.min(MASCOT_AT, clear - 1) : -1
  return (
    <div className="relative flex flex-col">
      {entries.map(({ item, index }, i) => {
        const id = itemId(item)
        const current = item.kind === 'node' && item.state === 'current'
        const x = WAVE[index % WAVE.length] * sign
        // Свободная сторона волны — для маскота и искорок.
        const side = x > 0 ? -1 : x < 0 ? 1 : index % 2 === 0 ? -1 : 1
        return (
          <div
            key={id}
            data-fog-start={i === firstFogged || undefined}
            className="relative flex items-center justify-center"
            style={{ height: ROW }}
          >
            {i === mascotAt && (
              <div className="pointer-events-none absolute bottom-0" style={{ left: `calc(50% + ${side * 112}px - 48px)` }}>
                <Mascot size={96} />
              </div>
            )}
            {index % 4 === 0 && i !== MASCOT_AT && (
              <div className="pointer-events-none absolute bottom-10" style={{ left: `calc(50% + ${side * 120}px - 10px)` }}>
                <Sparkle size={20} delay={-(index % 3) * 0.8} />
              </div>
            )}
            {index % 4 === 0 && (
              <div className="pointer-events-none absolute bottom-20" style={{ left: `calc(50% + ${side * 150}px - 6px)` }}>
                <Sparkle size={12} delay={-1.3 - (index % 3) * 0.5} />
              </div>
            )}
            <div style={{ transform: `translateX(${x}px)` }}>
              <div className={`relative ${current ? 'path-bounce' : ''}`} data-current={current || undefined}>
                {item.kind === 'node' ? (
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={item}
                    color={color}
                    label={`Урок ${item.index + 1} из ${nodeCount}`}
                    onSelect={() => onSelect(item)}
                  />
                ) : item.kind === 'ghost' ? (
                  <GhostButton ref={(el) => setRef(id, el)} onSelect={() => onSelect(item)} />
                ) : (
                  <ChestButton
                    ref={(el) => setRef(id, el)}
                    state={openedHere.has(id) ? 'opened' : item.state}
                    burst={burst?.id === id ? burst.gems : undefined}
                    onSelect={() => onSelect(item)}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
