import { useEffect, useRef, useState } from 'react'

/**
 * Compte à rebours fondé sur des horodatages (et non sur un comptage de ticks) :
 * il reste juste même si l'onglet passe en arrière-plan.
 */
export function useCountdown(onEnd: () => void) {
  const [endAt, setEndAt] = useState<number | null>(null)
  const [frozen, setFrozen] = useState(0) // secondes restantes quand le minuteur est arrêté
  const [now, setNow] = useState(() => Date.now())
  const ended = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    if (endAt === null) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= endAt && !ended.current) {
        ended.current = true
        setEndAt(null)
        setFrozen(0)
        onEndRef.current()
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [endAt])

  const remaining = endAt !== null ? Math.max(0, (endAt - now) / 1000) : frozen

  return {
    remaining,
    running: endAt !== null,
    start(seconds: number) {
      ended.current = false
      setFrozen(seconds)
      setNow(Date.now())
      setEndAt(Date.now() + seconds * 1000)
    },
    pause() {
      if (endAt === null) return
      setFrozen(Math.max(0, (endAt - Date.now()) / 1000))
      setEndAt(null)
    },
    resume() {
      if (endAt !== null || frozen <= 0) return
      ended.current = false
      setNow(Date.now())
      setEndAt(Date.now() + frozen * 1000)
    },
    stop() {
      setEndAt(null)
      setFrozen(0)
    },
  }
}

/** Chronomètre du temps actif de la séance (pauses exclues), persistant si la page est rechargée. */
export class ActiveClock {
  private acc: number
  private since: number | null = null
  private key: string

  constructor(key: string) {
    this.key = key
    this.acc = Number(sessionStorage.getItem(key) ?? 0)
  }

  start() {
    if (this.since === null) this.since = Date.now()
  }

  pause() {
    if (this.since !== null) {
      this.acc += Date.now() - this.since
      this.since = null
    }
    this.save()
  }

  seconds(): number {
    return Math.round((this.acc + (this.since !== null ? Date.now() - this.since : 0)) / 1000)
  }

  save() {
    sessionStorage.setItem(this.key, String(this.acc + (this.since !== null ? Date.now() - this.since : 0)))
  }
}

/** Bip doux (fin d'un effort ou d'un repos). */
export function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch {
    // Audio indisponible : on ignore.
  }
}

export const activeClockKey = (sessionId: number) => `flow-coach-active-${sessionId}`
