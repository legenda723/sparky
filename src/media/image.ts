// Фото карточки: уменьшаем до ~800 px по длинной стороне и сохраняем JPEG (SPEC 7.3).
export const IMAGE_MAX_SIDE = 800
const QUALITY = 0.82

/** Размер после уменьшения; маленькие картинки не увеличиваем. */
export function fitSize(width: number, height: number, max = IMAGE_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не получилось открыть картинку'))
    }
    img.src = url
  })
}

export interface CompressedImage {
  kind: 'image'
  blob: Blob
  mime: string
  width: number
  height: number
}

/** Сжимает фото из галереи, камеры или буфера. Поворот по EXIF iOS учитывает сам при показе <img>. */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const img = await loadImage(file)
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Нет canvas')
  // Прозрачные PNG — на белом фоне, иначе JPEG сделает его чёрным.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Не получилось сжать картинку')
  return { kind: 'image', blob, mime: 'image/jpeg', width, height }
}

/** Картинка из буфера обмена (iOS спросит «Вставить»). null — в буфере нет картинки. */
export async function readClipboardImage(): Promise<Blob | null> {
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return item.getType(type)
  }
  return null
}
