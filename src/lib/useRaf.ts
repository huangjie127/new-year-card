import { useEffect, useRef, useState } from 'react'

export function useRaf() {
  const [timeMs, setTimeMs] = useState(() => performance.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = (t: number) => {
      setTimeMs(t)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return timeMs
}
