// Дорожка раздела (DESIGN.md → «Дорожка пути»): места по волне, маскот и искорки по бокам.
import type { DeckColor } from '../db/types'
import type { PathItem } from '../game/path'
import type { ViewEntry } from '../game/pathView'
import { Mascot } from '../ui/Mascot'
import { ChestButton } from './ChestButton'
import { PathNodeButton } from './PathNodeButton'

/**
 * Змейка — ритм как в образце references/путь-duolingo.jpg (выбор владельца): плавная волна на 8 мест,
 * сначала вправо. Центр волны сдвинут вправо на 18 px (просьба владельца — нижние места уходили слишком
 * влево; заодно уравновешивает маскота слева): вправо до 84, влево до −48. Волна начинается на четверть
 * места раньше — первое место левее центра волны (просьба владельца сдвинуть зелёный круг левее).
 */
const SNAKE_CENTER = 18
const SNAKE_SWING = 66
const SNAKE_PHASE = -0.25

/** Сдвиг места вбок: все места строго на одной волне (без отдельных сдвигов — иначе змейка ломается). */
export function waveX(index: number): number {
  return Math.round(SNAKE_CENTER + SNAKE_SWING * Math.sin(((index + SNAKE_PHASE) * Math.PI) / 4))
}
/** Маскот сидит у 3-го места раздела. */
const MASCOT_AT = 2
/** Высота ряда — у всех мест одинаковая, как в образце (references/путь-duolingo.jpg): путь ровный. */
/** Шаг между местами — одинаковый у всех, включая сундук (просьба владельца): у сундука хватает места. */
export const ROW = 90
/** Увеличение места сразу под текущим; центры мест остаются на ровном шаге ROW. */
const NEXT_SCALE = 72 / 70

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
  // Место сразу под текущим — чуть крупнее (просьба владельца: рядом с кольцом текущего оно казалось меньше).
  const curAt = entries.findIndex((e) => e.item.kind === 'node' && e.item.state === 'current')
  return (
    <div className="relative flex flex-col">
      {entries.map(({ item, index, fogged }, i) => {
        const id = itemId(item)
        const current = item.kind === 'node' && item.state === 'current'
        const x = waveX(index) * sign
        // Свободная сторона волны — для маскота и искорок.
        const side = x > 0 ? -1 : x < 0 ? 1 : index % 2 === 0 ? -1 : 1
        return (
          <div
            key={id}
            data-fog-start={i === firstFogged || undefined}
            data-future={item.kind === 'future' || undefined}
            className="relative flex items-center justify-center"
            style={{ height: ROW }}
          >
            {i === mascotAt && (
              <div className="pointer-events-none absolute -bottom-6" style={{ left: `calc(50% + ${side * 112}px - 48px)` }}>
                <Mascot size={96} />
              </div>
            )}
            {/* Искорки — на стороне, противоположной маскоту, и только на чистом месте (под туманом их нет). */}
            {index % 4 === 0 && i !== MASCOT_AT && !fogged && (
              <div className="pointer-events-none absolute bottom-7" style={{ left: `calc(50% + ${-side * 120}px - 10px)` }}>
                <Sparkle size={20} delay={-(index % 3) * 0.8} />
              </div>
            )}
            {index % 4 === 0 && !fogged && (
              <div className="pointer-events-none absolute bottom-[68px]" style={{ left: `calc(50% + ${-side * 150}px - 6px)` }}>
                <Sparkle size={12} delay={-1.3 - (index % 3) * 0.5} />
              </div>
            )}
            <div style={{ transform: `translateX(${x}px)${curAt >= 0 && i === curAt + 1 && item.kind !== 'chest' ? ` scale(${NEXT_SCALE})` : ''}` }}>
              <div className={`relative ${current ? 'path-bounce' : ''}`} data-current={current || undefined}>
                {item.kind === 'node' ? (
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={item}
                    color={color}
                    label={`Урок ${item.index + 1} из ${nodeCount}`}
                    onSelect={() => onSelect(item)}
                  />
                ) : item.kind === 'ghost' || item.kind === 'future' ? (
                  // Место следующего урока и будущие уроки: выглядят как закрытый узел, касание — «добавь слова».
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={{ kind: 'node', key: item.key, deckId: item.deckId, index, cardIds: [], introduced: 0, state: 'locked' }}
                    color={color}
                    label={item.kind === 'ghost' ? 'Новый урок: добавь слова' : 'Будущий урок'}
                    onSelect={() => onSelect(item)}
                  />
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
