import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
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

export function useMediaBlob(id: Id | undefined): Blob | undefined {
  return useLiveQuery(async () => (id ? (await db.media.get(id))?.blob : undefined), [id])
}

export function useMediaUrl(id: Id | undefined): string | undefined {
  return useBlobUrl(useMediaBlob(id))
}
