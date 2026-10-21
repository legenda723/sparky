// Текстуры тумана пути (DESIGN.md → «Туман пути»): клубящийся дым как в образце references/туман-PvZ.jpg.
// Рисуется один раз заранее и кладётся готовыми WebP в src/path/fog/ — в приложении нет живых фильтров
// и размытия (на iPhone это тормозит). Запуск: npm run fog
//
// Дым — это множество мягких клубов (размытые шары разного размера), освещённых сверху-слева:
// верхушки светлые, провалы между клубами — в тени. Поле периодично по X и Y, поэтому плитки стыкуются
// без шва и могут медленно ехать вбок. Край — строки поля прямо над первой строкой сплошного дыма:
// край и сплошной дым продолжают друг друга.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const W = 512 // ширина плитки, px (= css px в приложении)
const H = 512 // высота плитки сплошного дыма
const EH = 256 // высота края
const WH = 220 // высота слоя завитков

const OUT = new URL('../src/path/fog/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const outPath = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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

const smooth = (a, b, t) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const lerp = (a, b, t) => a + (b - a) * t

/** Поле плотности W×h: сумма мягких клубов, периодично по X (и по Y, если wrapY). */
function puffField(h, count, rMin, rMax, seed, wrapY) {
  const rand = rng(seed)
  const field = new Float32Array(W * h)
  for (let n = 0; n < count; n++) {
    const cx = rand() * W
    const cy = rand() * h
    const r = rMin * (rMax / rMin) ** rand() // больше мелких, меньше крупных
    const s2 = 2 * (r * 0.55) ** 2
    const amp = 0.6 + rand() * 0.6
    const reach = Math.ceil(r * 1.6)
    for (let dy = -reach; dy <= reach; dy++) {
      let y = Math.floor(cy) + dy
      if (wrapY) y = ((y % h) + h) % h
      else if (y < 0 || y >= h) continue
      for (let dx = -reach; dx <= reach; dx++) {
        const x = (((Math.floor(cx) + dx) % W) + W) % W
        const ex = Math.floor(cx) + dx - cx
        const ey = Math.floor(cy) + dy - cy
        field[y * W + x] += amp * Math.exp(-(ex * ex + ey * ey) / s2)
      }
    }
  }
  // мягкое насыщение: где клубов много — плотно, но без пересвета
  for (let i = 0; i < field.length; i++) field[i] = 1 - Math.exp(-field[i] * 0.85)
  return field
}

const THEMES = {
  // светлая: белые клубы, серо-голубые провалы (как в образце)
  light: { deep: [168, 181, 198], mid: [214, 222, 233], top: [255, 255, 255] },
  // тёмная: тёмно-синий дым
  dark: { deep: [22, 36, 54], mid: [44, 66, 94], top: [92, 124, 160] },
}

/** Цвет точки: свет по наклону клуба (свет сверху-слева) и тень в провалах. */
function colorAt(theme, field, h, x, y, wrapY) {
  const at = (xx, yy) => {
    const X = ((xx % W) + W) % W
    let Y = yy
    if (wrapY) Y = ((Y % h) + h) % h
    else Y = Math.min(h - 1, Math.max(0, Y))
    return field[Y * W + X]
  }
  const d = at(x, y)
  const gx = (at(x + 3, y) - at(x - 3, y)) / 6
  const gy = (at(x, y + 3) - at(x, y - 3)) / 6
  // нормаль поверхности «высоты» d и свет сверху-слева
  const k = 40
  const nx = -gx * k
  const ny = -gy * k
  const len = Math.hypot(nx, ny, 1)
  const lambert = Math.max(0, (nx * -0.45 + ny * -0.75 + 0.5) / len / Math.hypot(0.45, 0.75, 0.5))
  let l = 0.18 + 0.82 * lambert
  l *= 0.55 + 0.45 * (0.35 + 0.65 * d) // провалы между клубами темнее, но без «дыр»
  l = Math.min(1, Math.max(0, l))
  const c = THEMES[theme]
  const rgb = l < 0.55 ? c.deep.map((v, i) => lerp(v, c.mid[i], l / 0.55)) : c.mid.map((v, i) => lerp(v, c.top[i], (l - 0.55) / 0.45))
  return { rgb, d }
}

async function save(name, w, h, px) {
  await sharp(Buffer.from(px.buffer), { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 74, alphaQuality: 72, effort: 6 })
    .toFile(outPath(name))
}

// Одно поле на сплошной дым и край (край — его продолжение вверх), отдельное — на завитки.
const TALL = H + EH
const main = puffField(TALL, 190, 22, 84, 11, false)
// Делаем поле периодичным по Y на участке сплошного дыма: верх участка (строка EH) ↔ низ (строка TALL),
// плавно сводим последние строки к первым — плитка повторяется вниз без шва.
const BLEND = 48
for (let r = 0; r < BLEND; r++) {
  const t = smooth(0, 1, r / BLEND)
  for (let x = 0; x < W; x++) {
    const bottom = (TALL - BLEND + r) * W + x
    const top = (EH + r) * W + x
    main[bottom] = lerp(main[bottom], main[top], t)
  }
}
const wisps = puffField(WH, 70, 14, 46, 501, false)

for (const theme of Object.keys(THEMES)) {
  // сплошной дым: строки EH..TALL поля
  const body = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const { rgb } = colorAt(theme, main, TALL, x, EH + y, false)
      body.set([...rgb, 255], (y * W + x) * 4)
    }
  await save(`fog-body-${theme}.webp`, W, H, body)

  // край: строки 0..EH; клубы выступают и растворяются, ниже — плотно
  const edge = new Uint8ClampedArray(W * EH * 4)
  const lineRand = rng(77)
  const waves = Array.from({ length: 4 }, (_, i) => ({ f: (i + 1) * (1 + Math.floor(lineRand() * 2)), p: lineRand() * Math.PI * 2, a: 1 / (i + 1.5) }))
  for (let r = 0; r < EH; r++)
    for (let x = 0; x < W; x++) {
      const { rgb, d } = colorAt(theme, main, TALL, x, r, false)
      // волнистая линия края (периодична по X) + клубы выступают выше неё
      const wave = waves.reduce((s, w) => s + w.a * Math.sin((x / W) * Math.PI * 2 * w.f + w.p), 0)
      const line = EH * 0.48 + EH * 0.12 * wave
      const t = (r - line) / (EH * 0.26) + (d - 0.5) * 4.6
      let a = smooth(-1, 0.45, t)
      a *= smooth(0, EH * 0.3, r) // к верху картинки дым тает полностью — без обреза
      a = Math.max(a, smooth(EH * 0.5, EH * 0.78, r)) // прозрачна только верхняя бахрома, ниже — плотно
      edge.set([...rgb, Math.round(a * 255)], (r * W + x) * 4)
    }
  await save(`fog-edge-${theme}.webp`, W, EH, edge)

  // завитки: редкие полупрозрачные клубы над краем — второй слой, едет в другую сторону
  const wisp = new Uint8ClampedArray(W * WH * 4)
  for (let r = 0; r < WH; r++)
    for (let x = 0; x < W; x++) {
      const { rgb, d } = colorAt(theme, wisps, WH, x, r, false)
      const bell = smooth(0, WH * 0.4, r) * (1 - smooth(WH * 0.75, WH, r))
      const a = smooth(0.25, 0.8, d) * bell * 0.6
      wisp.set([...rgb, Math.round(a * 255)], (r * W + x) * 4)
    }
  await save(`fog-wisp-${theme}.webp`, W, WH, wisp)
  console.log(`туман: ${theme} — готово`)
}
