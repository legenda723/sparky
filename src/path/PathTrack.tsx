// Дорожка пути (DESIGN.md → «Дорожка пути»): одна змейка, места по волне, маскот и искорки по бокам.
import type { DeckColor } from '../db/types'
import type { PathItem } from '../game/path'
import { FUTURES_CLEAR, type ViewEntry } from '../game/pathView'
import { Mascot } from '../ui/Mascot'
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
/** Маскот сидит у 3-го видимого места. */
const MASCOT_AT = 2
/** Высота ряда — у всех мест одинаковая, как в образце (references/путь-duolingo.jpg): путь ровный. */
/** Шаг между местами — одинаковый у всех (просьба владельца). */
export const ROW = 90
/**
 * Закрытые места чуть крупнее (72 вместо 70 — рядом с кольцом текущего они казались меньше),
 * место сразу под текущим — ещё чуть крупнее (73). Центры — на ровном шаге ROW.
 */
const LOCKED_SCALE = 72 / 70
const NEXT_SCALE = 73 / 70

export const itemId = (item: PathItem) => `${item.kind}:${item.key}`


/**
 * Искорки — по одной (просьба владельца: парами смотрелось «не оч»), в пустых местах у змейки, на 8 мест волны
 * повторяются. x, y — от середины ряда, size — размер.
 */
const STARS: Partial<Record<number, { x: number; y: number; size: number }>> = {
  0: { x: 120, y: -22, size: 20 },
  1: { x: -92, y: 6, size: 16 },
  3: { x: 150, y: 14, size: 12 },
  5: { x: 100, y: -8, size: 16 },
  7: { x: -140, y: 10, size: 12 },
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
  /** Цвет узлов — основной (колоды на пути не показываются, решение владельца 2026-10-27). */
  color: DeckColor
  /** Сколько уроков на пути всего (для «Урок 3 из 12»). */
  nodeCount: number
  setRef: (id: string, el: HTMLElement | null) => void
  onSelect: (item: PathItem) => void
  /** Места глубоко в тумане — не нажимаются (deepInFog). */
  deep: ReadonlySet<string>
}

export function PathTrack({ entries, color, nodeCount, setRef, onSelect, deep }: TrackProps) {
  const firstFogged = entries.findIndex((e) => e.fogged)
  // Чистые места — до тумана. Первые FUTURES_CLEAR будущих уроков стоят ещё на чистом месте (туман опущен под них).
  const clear = firstFogged < 0 ? entries.length : firstFogged + (entries[firstFogged].item.kind === 'future' ? FUTURES_CLEAR : 0)
  // Маскот — у 3-го видимого места, но не под туманом.
  const mascotAt = clear > 1 ? Math.min(MASCOT_AT, clear - 1) : -1
  const curAt = entries.findIndex((e) => e.item.kind === 'node' && e.item.state === 'current')
  return (
    <div className="relative flex flex-col">
      {entries.map(({ item, index, fogged }, i) => {
        const id = itemId(item)
        const current = item.kind === 'node' && item.state === 'current'
        const locked = (item.kind === 'node' && item.state === 'locked') || item.kind === 'ghost' || item.kind === 'future'
        const scale = locked && curAt >= 0 && i === curAt + 1 ? NEXT_SCALE : locked ? LOCKED_SCALE : 1
        const x = waveX(index)
        const star = STARS[index % 8]
        // Свободная сторона волны — для маскота.
        const side = x > 0 ? -1 : x < 0 ? 1 : index % 2 === 0 ? -1 : 1
        return (
          <div
            key={id}
            data-fog-start={i === firstFogged || undefined}
            data-fogged={fogged || undefined}
            data-future={item.kind === 'future' || undefined}
            // Глубоко в тумане не нажимается; место в лёгкой дымке — нажимается (deepInFog).
            inert={deep.has(item.key) || undefined}
            className="relative flex items-center justify-center"
            style={{ height: ROW }}
          >
            {i === mascotAt && (
              <div className="pointer-events-none absolute -bottom-6" style={{ left: `calc(50% + ${side * 112}px - 48px)` }}>
                <Mascot size={96} />
              </div>
            )}
            {/* Искорки — по одной, в пустых местах у змейки (только на чистом месте: под туманом их нет). */}
            {star && i < clear && i !== mascotAt && (
              <div
                className="pointer-events-none absolute"
                style={{ left: `calc(50% + ${star.x - star.size / 2}px)`, top: `calc(50% + ${star.y - star.size / 2}px)` }}
              >
                <Sparkle size={star.size} delay={-(index % 3) * 0.9} />
              </div>
            )}
            <div style={{ transform: `translateX(${x}px)${scale !== 1 ? ` scale(${scale})` : ''}` }}>
              <div className={`relative ${current ? 'path-bounce' : ''}`} data-current={current || undefined}>
                {item.kind === 'node' ? (
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={item}
                    color={color}
                    label={`Урок ${item.index + 1} из ${nodeCount}`}
                    onSelect={() => onSelect(item)}
                  />
                ) : (
                  // Место следующего урока и будущие уроки: выглядят как закрытый узел, касание — «добавь слова».
                  <PathNodeButton
                    ref={(el) => setRef(id, el)}
                    node={{ kind: 'node', key: item.key, index, cardIds: [], introduced: 0, state: 'locked' }}
                    color={color}
                    label={item.kind === 'ghost' ? 'Новый урок: добавь слова' : 'Будущий урок'}
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
