export type Vec2 = { x: number; y: number }

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

export function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}
