import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react'
import { useId } from 'react'

export type MascotMood = 'happy' | 'cheer' | 'sad'

// Свои цвета маскота (DESIGN.md → «Маскот»), одинаковые в обеих темах.
const C = {
  body: '#B6EF4A',
  bodyShade: '#8FD12E',
  belly: '#E4FBA8',
  glow: '#D9FF7A',
  wing: '#DDF3FF',
  wingStroke: '#9CD3F2',
  eye: '#1E2A33',
  shine: '#FFFFFF',
  cheek: '#FF9CB8',
  mouth: '#5A2A1E',
}

const MOOD_LABEL: Record<MascotMood, string> = {
  happy: 'Спарки радуется',
  cheer: 'Спарки ликует',
  sad: 'Спарки грустит',
}

interface MascotProps {
  mood?: MascotMood
  size?: number
}

/** Маскот Спарки — светлячок-искорка. Первая версия: 3 состояния. */
export function Mascot({ mood = 'happy', size = 120 }: MascotProps) {
  const reduce = useReducedMotion() ?? false
  const glowId = useId()

  const body = bodyMotion(mood, reduce)
  const wing = wingMotion(mood, reduce)

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={MOOD_LABEL[mood]}
      className="overflow-visible"
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor={C.glow} stopOpacity={0.75} />
          <stop offset="60%" stopColor={C.glow} stopOpacity={0.25} />
          <stop offset="100%" stopColor={C.glow} stopOpacity={0} />
        </radialGradient>
      </defs>

      <motion.circle
        cx={60}
        cy={66}
        r={58}
        fill={`url(#${glowId})`}
        animate={reduce ? undefined : { opacity: mood === 'sad' ? 0.45 : [0.75, 1, 0.75] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.g animate={body.animate} transition={body.transition}>
        {/* крылышки */}
        <motion.ellipse
          cx={34}
          cy={36}
          rx={14}
          ry={21}
          fill={C.wing}
          fillOpacity={0.92}
          stroke={C.wingStroke}
          strokeWidth={2.5}
          style={{ transformBox: 'fill-box', transformOrigin: '90% 90%', rotate: -32 }}
          animate={wing.left}
          transition={wing.transition}
        />
        <motion.ellipse
          cx={86}
          cy={36}
          rx={14}
          ry={21}
          fill={C.wing}
          fillOpacity={0.92}
          stroke={C.wingStroke}
          strokeWidth={2.5}
          style={{ transformBox: 'fill-box', transformOrigin: '10% 90%', rotate: 32 }}
          animate={wing.right}
          transition={wing.transition}
        />

        {/* усики с огоньками */}
        <path d="M52 32 Q48 18 40 13" stroke={C.bodyShade} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <path d="M68 32 Q72 18 80 13" stroke={C.bodyShade} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <circle cx={40} cy={12} r={5.5} fill={C.glow} />
        <circle cx={80} cy={12} r={5.5} fill={C.glow} />
        <circle cx={38.5} cy={10.5} r={1.8} fill={C.shine} />
        <circle cx={78.5} cy={10.5} r={1.8} fill={C.shine} />

        {/* тело: тень снизу, основной цвет, живот, блик */}
        <circle cx={60} cy={68} r={38} fill={C.bodyShade} />
        <circle cx={59} cy={65} r={36} fill={C.body} />
        <ellipse cx={60} cy={84} rx={21} ry={14} fill={C.belly} />
        <ellipse cx={40} cy={46} rx={8} ry={5} fill={C.shine} fillOpacity={0.55} transform="rotate(-35 40 46)" />

        <Face mood={mood} />
      </motion.g>
    </svg>
  )
}

function Face({ mood }: { mood: MascotMood }) {
  const stroke = { stroke: C.eye, strokeWidth: 4.5, fill: 'none', strokeLinecap: 'round' as const }
  return (
    <g>
      {/* глаза */}
      {mood === 'cheer' ? (
        <>
          <path d="M38 64 Q46 53 54 64" {...stroke} />
          <path d="M66 64 Q74 53 82 64" {...stroke} />
        </>
      ) : (
        <>
          <ellipse cx={46} cy={62} rx={8.5} ry={10.5} fill={C.eye} />
          <ellipse cx={74} cy={62} rx={8.5} ry={10.5} fill={C.eye} />
          <circle cx={mood === 'sad' ? 48 : 49} cy={mood === 'sad' ? 63 : 58} r={3.4} fill={C.shine} />
          <circle cx={mood === 'sad' ? 76 : 77} cy={mood === 'sad' ? 63 : 58} r={3.4} fill={C.shine} />
          <circle cx={43.5} cy={66} r={1.5} fill={C.shine} />
          <circle cx={71.5} cy={66} r={1.5} fill={C.shine} />
        </>
      )}

      {/* бровки домиком — только когда грустит */}
      {mood === 'sad' && (
        <>
          <path d="M37 49 L51 45" stroke={C.eye} strokeWidth={3.5} strokeLinecap="round" />
          <path d="M69 45 L83 49" stroke={C.eye} strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}

      {/* румянец */}
      <ellipse cx={35} cy={75} rx={6} ry={3.5} fill={C.cheek} fillOpacity={0.85} />
      <ellipse cx={85} cy={75} rx={6} ry={3.5} fill={C.cheek} fillOpacity={0.85} />

      {/* рот */}
      {mood === 'happy' && (
        <path d="M52 76 Q60 85 68 76" stroke={C.mouth} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      )}
      {mood === 'cheer' && (
        <>
          <path d="M48 73 Q60 94 72 73 Z" fill={C.mouth} stroke={C.mouth} strokeWidth={2} strokeLinejoin="round" />
          <path d="M53 84 Q60 80 67 84 Q60 91 53 84 Z" fill={C.cheek} />
        </>
      )}
      {mood === 'sad' && (
        <path d="M53 83 Q60 76 67 83" stroke={C.mouth} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      )}
    </g>
  )
}

function bodyMotion(mood: MascotMood, reduce: boolean): { animate: TargetAndTransition; transition: Transition } {
  if (reduce) return { animate: { y: mood === 'sad' ? 4 : 0, rotate: 0 }, transition: { duration: 0.2 } }
  switch (mood) {
    case 'happy':
      return {
        animate: { y: [0, -5, 0], rotate: 0 },
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      }
    case 'cheer':
      return {
        animate: { y: [0, -22, 0, 0], rotate: [0, -10, 8, 0] },
        transition: { duration: 0.8, times: [0, 0.35, 0.7, 1], repeat: Infinity, repeatDelay: 0.3, ease: 'easeOut' },
      }
    case 'sad':
      return { animate: { y: 5, rotate: 0 }, transition: { type: 'spring', stiffness: 120, damping: 14 } }
  }
}

function wingMotion(
  mood: MascotMood,
  reduce: boolean,
): { left: TargetAndTransition; right: TargetAndTransition; transition: Transition } {
  if (reduce || mood === 'sad') {
    const folded = mood === 'sad' ? 18 : 0
    return { left: { rotate: -32 + folded }, right: { rotate: 32 - folded }, transition: { duration: 0.3 } }
  }
  const amp = mood === 'cheer' ? 22 : 12
  return {
    left: { rotate: [-32, -32 - amp, -32] },
    right: { rotate: [32, 32 + amp, 32] },
    transition: { duration: mood === 'cheer' ? 0.22 : 0.5, repeat: Infinity, ease: 'easeInOut' },
  }
}
