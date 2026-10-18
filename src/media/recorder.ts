// Своя запись произношения: до 5 секунд с микрофона (SPEC 7.3).
import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORD_MS = 5000

// iPhone пишет в mp4, остальные браузеры — в webm.
const TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']

export function pickMimeType(isSupported: (t: string) => boolean): string | undefined {
  return TYPES.find((t) => isSupported(t))
}

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

/** На время записи iOS нужен режим «запись», потом возвращаем «ambient» (уважает беззвучный режим). */
function setSession(type: 'play-and-record' | 'ambient') {
  const nav = navigator as Navigator & AudioSessionNavigator
  if (nav.audioSession) nav.audioSession.type = type
}

export interface Recording {
  kind: 'audio'
  blob: Blob
  mime: string
  durationMs: number
}

export type RecorderState = 'idle' | 'recording' | 'denied' | 'unsupported'

export function useRecorder(onDone: (rec: Recording) => void) {
  const [state, setState] = useState<RecorderState>(() =>
    typeof MediaRecorder === 'undefined' || !navigator.mediaDevices ? 'unsupported' : 'idle',
  )
  const [elapsed, setElapsed] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const timers = useRef<number[]>([])
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t))
    timers.current = []
  }

  const stop = useCallback(() => {
    clearTimers()
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    let stream: MediaStream
    try {
      setSession('play-and-record')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setSession('ambient')
      setState('denied')
      return
    }
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    const startedAt = performance.now()
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      setSession('ambient')
      recorder.current = null
      setState('idle')
      const mime = rec.mimeType || mimeType || 'audio/mp4'
      const blob = new Blob(chunks, { type: mime })
      const durationMs = Math.min(MAX_RECORD_MS, Math.round(performance.now() - startedAt))
      if (blob.size > 0) doneRef.current({ kind: 'audio', blob, mime, durationMs })
    }
    recorder.current = rec
    rec.start()
    setElapsed(0)
    setState('recording')
    timers.current.push(
      window.setInterval(() => {
        const ms = performance.now() - startedAt
        setElapsed(ms)
        if (ms >= MAX_RECORD_MS) stop()
      }, 100),
    )
  }, [stop])

  // Закрыли окно посреди записи — останавливаем и отпускаем микрофон.
  useEffect(() => () => stop(), [stop])

  return { state, elapsed, start, stop }
}
