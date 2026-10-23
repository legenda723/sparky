// Текстуры тумана пути (DESIGN.md → «Туман пути»): клубящийся дым как в образце references/туман-PvZ.jpg.
// Рисуется один раз заранее и кладётся готовыми WebP в src/path/fog/ — в приложении нет живых фильтров
// и размытия (на iPhone это тормозит). Запуск: npm run fog
//
// Дым = крупные мягкие клубы (форма) + дымчатые разводы из шума (фактура). Свет мягкий: объём —
// плавными переходами, без бликов на каждом клубе (иначе «пупырышки»). Поле периодично по X (плитки
// стыкуются без шва и могут медленно ехать вбок) и по Y на участке сплошного дыма. Край — строки поля
// прямо над первой строкой сплошного дыма: край и сплошной дым продолжают друг друга.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const W = 512 // ширина плитки, px (= css px в приложении)
const H = 512 // высота плитки сплошного дыма
const EH = 256 // высота края
const WH = 220 // высота слоя завитков
const TALL = H + EH

const OUT = new URL('../src/path/fog/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const outPath = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const smooth = (a, b, t) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v) => Math.min(1, Math.max(0, v))

/** Предсказуемая случайность — картинки одинаковые при каждом запуске. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- периодичный градиентный шум (период W по X и H по Y) ---
function hash(i, j, seed) {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
function noise(x, y, px, py, seed) {
  const i0 = Math.floor(x)
  const j0 = Math.floor(y)
  const dot = (i, j) => {
    const a = hash(((i % px) + px) % px, ((j % py) + py) % py, seed) * Math.PI * 2
    return Math.cos(a) * (x - i) + Math.sin(a) * (y - j)
  }
  const u = fade(x - i0)
  const v = fade(y - j0)
  return lerp(lerp(dot(i0, j0), dot(i0 + 1, j0), u), lerp(dot(i0, j0 + 1), dot(i0 + 1, j0 + 1), u), v)
}
/** Дымчатые разводы −0.5..0.5: несколько октав с лёгким завихрением. y — в координатах сплошного дыма. */
function smoke(x, y, seed) {
  const wy = ((y % H) + H) % H
  const warp = 20 * noise(x / 128, wy / 128, W / 128, H / 128, seed + 9)
  let sum = 0
  let amp = 1
  let norm = 0
  for (const cell of [128, 64, 32]) {
    sum += amp * noise((x + warp) / cell, (wy + warp * 0.6) / cell, W / cell, H / cell, seed + cell)
    norm += amp
    amp *= 0.6
  }
  return sum / norm
}

/** Поле клубов W×h: сумма мягких крупных шаров, периодично по X. */
function puffField(h, count, rMin, rMax, seed) {
  const rand = rng(seed)
  const field = new Float32Array(W * h)
  for (let n = 0; n < count; n++) {
    const cx = rand() * W
    const cy = rand() * h
    const r = rMin * (rMax / rMin) ** rand()
    const s2 = 2 * (r * 0.55) ** 2
    const amp = 0.7 + rand() * 0.5
    const reach = Math.ceil(r * 1.7)
    for (let dy = -reach; dy <= reach; dy++) {
      const y = Math.floor(cy) + dy
      if (y < 0 || y >= h) continue
      for (let dx = -reach; dx <= reach; dx++) {
        const x = (((Math.floor(cx) + dx) % W) + W) % W
        const ex = Math.floor(cx) + dx - cx
        const ey = y - cy
        field[y * W + x] += amp * Math.exp(-(ex * ex + ey * ey) / s2)
      }
    }
  }
  for (let i = 0; i < field.length; i++) field[i] = 1 - Math.exp(-field[i] * 0.9)
  return field
}

/**
 * Палитра: тень → середина → свет. Дым серый, как в образце: в светлой теме — белёсо-серый,
 * в тёмной — серый (светлее фона, но приглушённый, чтобы не слепил ночью).
 */
const THEMES = {
  light: { deep: [150, 158, 170], mid: [196, 202, 211], top: [244, 246, 249] },
  dark: { deep: [88, 94, 104], mid: [132, 139, 149], top: [190, 195, 202] },
}

const field = puffField(TALL, 70, 44, 130, 11)
// Поле периодично по Y на участке сплошного дыма: последние строки плавно сводятся к строкам прямо над
// первой строкой сплошного дыма — тогда за последней строкой плитки ровно продолжается первая, шва нет.
const BLEND = 64
for (let r = 0; r < BLEND; r++) {
  const t = smooth(0, 1, (r + 1) / BLEND)
  for (let x = 0; x < W; x++) field[(TALL - BLEND + r) * W + x] = lerp(field[(TALL - BLEND + r) * W + x], field[(EH - BLEND + r) * W + x], t)
}

/** Свет и плотность точки поля (yy — строка поля 0..TALL). */
function light(x, yy) {
  // ниже последней строки — снова верх сплошного дыма (плитка повторяется), выше первой строки края — она сама
  const at = (xx, y) => field[(y >= TALL ? y - H : Math.max(0, y)) * W + (((xx % W) + W) % W)]
  const d = at(x, yy)
  // мягкий объём клубов: свет сверху, по крупному наклону (шаг 8 px — без мелких бугорков)
  const gy = (at(x, yy + 8) - at(x, yy - 8)) / 16
  const gx = (at(x + 8, yy) - at(x - 8, yy)) / 16
  const lit = (-gy * 0.8 - gx * 0.3) * 14
  const s = smoke(x, yy - EH, 3)
  const l = clamp(0.52 + lit * 0.7 + s * 0.8 + (d - 0.6) * 0.35)
  return { l, d, s }
}

/**
 * Рисунок дыма — из прозрачности: густые места — самые светлые, в редких проступает фон. На тёмном фоне
 * это складывается в светлые клубы с тёмными провалами. На белом фоне сложилось бы в ровную пелену,
 * поэтому в светлой теме тон обратный: густые клубы — серые, редкие места — светлые и прозрачные.
 */
function rgbOf(theme, l0) {
  const l = theme === 'light' ? 1 - l0 : l0
  const c = THEMES[theme]
  return l < 0.5 ? c.deep.map((v, i) => lerp(v, c.mid[i], l / 0.5)) : c.mid.map((v, i) => lerp(v, c.top[i], (l - 0.5) / 0.5))
}

/** lossless — для края и сплошного дыма: при сжатии с потерями края картинок сжимаются врозь и на стыках видна линия. */
async function save(name, w, h, px, lossless = false) {
  await sharp(Buffer.from(px.buffer), { raw: { width: w, height: h, channels: 4 } })
    .webp(lossless ? { lossless: true, effort: 6 } : { quality: 68, alphaQuality: 90, effort: 6 })
    .toFile(outPath(name))
}

// волнистая линия края (периодична по X)
const lineRand = rng(77)
const waves = [1, 2, 3, 5].map((f) => ({ f, p: lineRand() * Math.PI * 2, a: 1 / (f + 0.5) }))
const edgeLine = (x, amp = 0.14) => EH * 0.44 + EH * amp * waves.reduce((s, w) => s + w.a * Math.sin((x / W) * Math.PI * 2 * w.f + w.p), 0)

/**
 * Край по темам. Светлая — как тёмная (просьба владельца: «как на тёмном фоне, только под белую тему»),
 * дым чуть плотнее, чтобы не бледнел на белом.
 */
const EDGE = {
  light: { line: 0.44, span: 0.27, fade: 0.28, dense: 0.06, wave: 0.14 },
  dark: { line: 0.44, span: 0.27, fade: 0.28, dense: 0, wave: 0.14 },
}

/**
 * Плотность дыма (непрозрачность) в сплошной части: не стена, а вуаль — светлые клубы гуще,
 * провалы между ними прозрачнее; сквозь дым угадывается путь (решение владельца: «менее густой»).
 */
const veil = (theme, l, s) => clamp(0.5 + EDGE[theme].dense + l * 0.32 + s * 0.35)

for (const theme of Object.keys(THEMES)) {
  const body = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const { l, s } = light(x, EH + y)
      body.set([...rgbOf(theme, l), Math.round(veil(theme, l, s) * 255)], (y * W + x) * 4)
    }
  await save(`fog-body-${theme}.webp`, W, H, body, true)

  // край: клубы выступают, разводы дыма делают его рваным; к верху тает полностью, ниже — плотно
  const edge = new Uint8ClampedArray(W * EH * 4)
  for (let r = 0; r < EH; r++)
    for (let x = 0; x < W; x++) {
      const { l, d, s } = light(x, r)
      const e = EDGE[theme]
      const t = (r - edgeLine(x, e.wave) + EH * (0.44 - e.line)) / (EH * e.span) + (d - 0.55) * 3.4 + s * 3.4
      let a = smooth(-1.5, 0.6, t)
      a *= smooth(0, EH * e.fade, r)
      a = Math.max(a, smooth(EH * 0.5, EH * 0.78, r))
      a *= veil(theme, l, s) // внизу край ровно переходит в вуаль сплошной части
      edge.set([...rgbOf(theme, l), Math.round(a * 255)], (r * W + x) * 4)
    }
  await save(`fog-edge-${theme}.webp`, W, EH, edge, true)

  // завитки: редкие полупрозрачные струйки дыма над краем — второй слой, едет в другую сторону
  const wisp = new Uint8ClampedArray(W * WH * 4)
  for (let r = 0; r < WH; r++)
    for (let x = 0; x < W; x++) {
      const s = smoke(x * 1, r * 1.6 + 300, 41)
      const bell = smooth(0, WH * 0.45, r) * (1 - smooth(WH * 0.7, WH, r))
      const a = smooth(0.02, 0.3, s) * bell * 0.55
      wisp.set([...rgbOf(theme, clamp(0.62 + s * 0.6)), Math.round(a * 255)], (r * W + x) * 4)
    }
  await save(`fog-wisp-${theme}.webp`, W, WH, wisp)
  console.log(`туман: ${theme} — готово`)
}
