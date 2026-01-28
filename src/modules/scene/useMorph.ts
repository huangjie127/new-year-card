import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vec2 } from './types'
import { clamp01 } from '../../lib/math'
import { easeInOutCubic } from '../../lib/easing'

export function useMorph(params: { from: Vec2[][]; to: Vec2[][]; triggerKey: string; durationMs?: number }) {
  const { from, to, triggerKey, durationMs = 850 } = params
  const [t, setT] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = performance.now()
    setT(0)

    let raf = 0
    const tick = () => {
      const start = startRef.current
      if (start == null) return
      const raw = clamp01((performance.now() - start) / durationMs)
      setT(easeInOutCubic(raw))
      if (raw < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [triggerKey, durationMs])

  const ready = useMemo(() => from.length > 0 && to.length > 0 && from.length === to.length, [from, to])
  return { t: ready ? t : 0, ready }
}
