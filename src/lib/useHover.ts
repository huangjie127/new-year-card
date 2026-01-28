import { useEffect, useState } from 'react'

export function useHover<T extends Element>(ref: React.RefObject<T>) {
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onEnter = () => setHover(true)
    const onLeave = () => setHover(false)

    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)

    return () => {
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [ref])

  return hover
}
