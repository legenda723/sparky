import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { useCachedLiveQuery } from '../db/liveCache'
import type { Id } from '../db/types'

/** Адрес для <img>/<audio> из файла в базе. Освобождается, когда больше не нужен. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/** Файл из базы. Уже открытые хранятся в памяти — повторно окно слова открывается сразу с фото. */
export function useMediaBlob(id: Id | undefined): Blob | undefined {
  return useCachedLiveQuery(`media:${id ?? ''}`, async () => (id ? (await db.media.get(id))?.blob : undefined), [id])
}

export function useMediaUrl(id: Id | undefined): string | undefined {
  return useBlobUrl(useMediaBlob(id))
}
