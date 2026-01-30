import { useEffect, useState } from 'react'

export function useResizeObserver<T extends Element>(ref: React.RefObject<T>) {
  const [rect, setRect] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setRect({ width: cr.width, height: cr.height })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return rect
}
