import { useMemo } from 'react'
import type { SceneStateV1 } from './types'
import { generateHorseStrokes } from './horseGenerator'

export function useHorseStrokes(state: SceneStateV1, width: number, height: number) {
  return useMemo(() => {
    if (width <= 0 || height <= 0) return []
    return generateHorseStrokes({
      seed: state.logo.seed,
      variant: state.logo.variant,
      strokeCount: state.logo.strokeCount,
      pointsPerStroke: state.logo.pointsPerStroke,
      width,
      height,
    })
  }, [state.logo.seed, state.logo.variant, state.logo.strokeCount, state.logo.pointsPerStroke, width, height])
}
