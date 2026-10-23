// Дорожка раздела (DESIGN.md → «Дорожка пути»): места по волне, тропинка под ними, маскот и искорки по бокам.
import type { DeckColor } from '../db/types'
import type { PathItem } from '../game/path'
import type { ViewEntry } from '../game/pathView'
import { Mascot } from '../ui/Mascot'
import { DECK_COLORS } from '../words/deckLook'
import { ChestButton } from './ChestButton'
import { GhostButton } from './GhostButton'
import { PathNodeButton } from './PathNodeButton'
import { Road, type RoadPoint } from './Road'

/** Сдвиг вбок по волне. */
export const WAVE = [0, 44, 70, 44, 0, -44, -70, -44]
/** Маскот сидит у 3-го места раздела. */
const MASCOT_AT = 2
/** Высота ряда: у текущего узла сверху место под «НАЧАТЬ». Центр кружка — на 48 выше низа ряда. */
export const ROW = 136
const ROW_CURRENT = 196
const CENTER_FROM_BOTTOM = 48

export const itemId = (item: PathItem) => `${item.kind}:${item.key}`

function StartBubble({ color }: { color: DeckColor }) {
  const { fill, shadow } = DECK_COLORS[color]
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+28px)] left-1/2 -translate-x-1/2">
      <div
        className="relative rounded-card px-4 py-2 text-small font-black tracking-[0.04em] whitespace-nowrap text-on-color uppercase"
        style={{ background: fill, boxShadow: `0 4px 0 ${shadow}` }}
      >
        Начать
        <span aria-hidden className="absolute -bottom-[6px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px]" style={{ background: fill }} />
      </div>
    </div>
  )
}

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
  let bottom = 0
  const points: RoadPoint[] = entries.map(({ item, index }) => {
    const current = item.kind === 'node' && item.state === 'current'
    bottom += current ? ROW_CURRENT : ROW
    // Занятое место вокруг центра: кружок 72 с тенью; у текущего — кольцо и пузырь «НАЧАТЬ» над ним.
    return {
      x: WAVE[index % WAVE.length] * sign,
      y: bottom - CENTER_FROM_BOTTOM,
      clearTop: current ? 112 : 42,
      clearBottom: current ? 52 : 46,
    }
  })
  const firstFogged = entries.findIndex((e) => e.fogged)
  // Маскот — у 3-го видимого места, но не под туманом.
  const clear = firstFogged < 0 ? entries.length : firstFogged
  const mascotAt = clear > 1 ? Math.min(MASCOT_AT, clear - 1) : -1
  return (
    <div className="relative flex flex-col">
      <Road points={points} />
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
            className="relative flex items-end justify-center pb-3"
            style={{ height: current ? ROW_CURRENT : ROW }}
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
                {current && <StartBubble color={color} />}
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
