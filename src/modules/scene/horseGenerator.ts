import type { Vec2 } from './types'
import { clamp01, dist } from '../../lib/math'
import { mulberry32, randRange } from '../../lib/rng'

function polylineLength(points: Vec2[]) {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += dist(points[i - 1], points[i])
  return sum
}

function resamplePolyline(points: Vec2[], count: number): Vec2[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: count }, () => ({ ...points[0] }))

  const total = polylineLength(points)
  if (total === 0) return Array.from({ length: count }, () => ({ ...points[0] }))

  const out: Vec2[] = []
  const step = total / (count - 1)
  let target = 0
  let acc = 0

  out.push({ ...points[0] })

  let segStart = points[0]
  let segIndex = 1

  while (out.length < count - 1) {
    const segEnd = points[segIndex]
    const segLen = dist(segStart, segEnd)

    if (acc + segLen >= target + step) {
      const remaining = target + step - acc
      const t = segLen === 0 ? 0 : remaining / segLen
      const p: Vec2 = {
        x: segStart.x + (segEnd.x - segStart.x) * t,
        y: segStart.y + (segEnd.y - segStart.y) * t,
      }
      out.push(p)
      target += step
      segStart = p
      // segIndex unchanged; continue within same segment
    } else {
      acc += segLen
      segStart = segEnd
      segIndex++
      if (segIndex >= points.length) break
    }
  }

  out.push({ ...points[points.length - 1] })

  // Ensure exact count
  while (out.length < count) out.push({ ...out[out.length - 1] })
  return out.slice(0, count)
}

function normalizeToCanvas(p: Vec2, rect: { x: number; y: number; w: number; h: number }): Vec2 {
  return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h }
}

function basePaths(variant: string): Vec2[][] {
  // Rough horse-like silhouette in normalized [0..1] space.
  // Variants tweak a few control points to enable morphing.
  const v = variant || 'a'
  const headLift = v === 'b' ? 0.06 : v === 'c' ? -0.03 : 0
  const neckBow = v === 'b' ? 0.05 : 0
  const backDip = v === 'c' ? 0.05 : 0

  const back: Vec2[] = [
    { x: 0.12, y: 0.48 - backDip },
    { x: 0.28, y: 0.38 - backDip },
    { x: 0.45, y: 0.35 },
    { x: 0.62, y: 0.34 },
    { x: 0.76, y: 0.38 },
    { x: 0.86, y: 0.45 },
  ]

  const belly: Vec2[] = [
    { x: 0.18, y: 0.60 },
    { x: 0.36, y: 0.70 },
    { x: 0.56, y: 0.70 },
    { x: 0.74, y: 0.62 },
  ]

  const neckHead: Vec2[] = [
    { x: 0.68, y: 0.40 },
    { x: 0.74, y: 0.28 - neckBow },
    { x: 0.82, y: 0.20 - headLift },
    { x: 0.90, y: 0.22 - headLift },
    { x: 0.84, y: 0.28 - headLift },
    { x: 0.78, y: 0.34 },
  ]

  const legFront: Vec2[] = [
    { x: 0.66, y: 0.60 },
    { x: 0.66, y: 0.78 },
    { x: 0.64, y: 0.92 },
  ]

  const legBack: Vec2[] = [
    { x: 0.36, y: 0.60 },
    { x: 0.34, y: 0.78 },
    { x: 0.32, y: 0.92 },
  ]

  const tail: Vec2[] = [
    { x: 0.14, y: 0.46 },
    { x: 0.08, y: 0.52 },
    { x: 0.10, y: 0.62 },
    { x: 0.16, y: 0.70 },
  ]

  const accent: Vec2[] = [
    { x: 0.44, y: 0.44 },
    { x: 0.56, y: 0.46 },
    { x: 0.66, y: 0.50 },
  ]

  return [back, belly, neckHead, legFront, legBack, tail, accent]
}

export function generateHorseStrokes(params: {
  seed: number
  variant: string
  strokeCount: number
  pointsPerStroke: number
  width: number
  height: number
}): Vec2[][] {
  const { seed, variant, strokeCount, pointsPerStroke, width, height } = params
  const rand = mulberry32(seed)

  const margin = Math.max(24, Math.min(width, height) * 0.08)
  const rect = {
    x: margin,
    y: margin,
    w: Math.max(1, width - margin * 2),
    h: Math.max(1, height - margin * 2),
  }

  const paths = basePaths(variant)
  const strokes: Vec2[][] = []

  for (let i = 0; i < strokeCount; i++) {
    const base = paths[i % paths.length]
    const sampled = resamplePolyline(base, pointsPerStroke)

    // Offset multiple strokes around the same path to create a "line art" feeling.
    const band = Math.floor(i / paths.length)
    const offsetMag = (band + 1) * randRange(rand, -0.010, 0.010)
    const jitterMag = randRange(rand, 0.0005, 0.006)

    const offsetAngle = randRange(rand, 0, Math.PI * 2)
    const ox = Math.cos(offsetAngle) * offsetMag
    const oy = Math.sin(offsetAngle) * offsetMag

    const stroke = sampled.map((p, idx) => {
      const t = idx / (pointsPerStroke - 1)
      const wobble = (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * jitterMag
      const jx = randRange(rand, -1, 1) * wobble
      const jy = randRange(rand, -1, 1) * wobble
      const pp = {
        x: clamp01(p.x + ox + jx),
        y: clamp01(p.y + oy + jy),
      }
      return normalizeToCanvas(pp, rect)
    })

    strokes.push(stroke)
  }

  return strokes
}
