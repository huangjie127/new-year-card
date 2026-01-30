import type { ConstellationPoint } from "./render";

type P2 = { x: number; y: number };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function cubic(p0: P2, p1: P2, p2: P2, p3: P2, t: number): P2 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function sampleCubic(p0: P2, p1: P2, p2: P2, p3: P2, count: number) {
  const out: P2[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1);
    out.push(cubic(p0, p1, p2, p3, t));
  }
  return out;
}

function samplePolyline(points: P2[], totalSamples: number) {
  if (points.length < 2) return points.slice();
  const segLen: number[] = [];
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    segLen.push(l);
    sum += l;
  }
  const out: P2[] = [];
  for (let s = 0; s < totalSamples; s++) {
    const t = totalSamples <= 1 ? 0 : s / (totalSamples - 1);
    const d = t * sum;
    let acc = 0;
    let seg = 0;
    while (seg < segLen.length && acc + segLen[seg] < d) {
      acc += segLen[seg];
      seg++;
    }
    if (seg >= segLen.length) {
      out.push(points[points.length - 1]);
      continue;
    }
    const localT = segLen[seg] <= 1e-6 ? 0 : (d - acc) / segLen[seg];
    const a = points[seg];
    const b = points[seg + 1];
    out.push({ x: lerp(a.x, b.x, localT), y: lerp(a.y, b.y, localT) });
  }
  return out;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * A hand-tuned horse silhouette in normalized coordinates.
 * This is deliberately stylized (calligraphy-like) so it reads as "horse" on first glance.
 */
export function makeHorseTemplatePoints(seed = 2026) {
  // Overall composition: leave lots of whitespace above, horse sits upper-mid.
  // Coordinates are 0..1.

  const spine = sampleCubic(
    { x: 0.78, y: 0.28 }, // muzzle/forehead zone
    { x: 0.74, y: 0.20 },
    { x: 0.62, y: 0.24 },
    { x: 0.44, y: 0.32 } // withers -> back
  , 12);

  const backToRump = sampleCubic(
    { x: 0.44, y: 0.32 },
    { x: 0.36, y: 0.31 },
    { x: 0.28, y: 0.34 },
    { x: 0.22, y: 0.40 }
  , 10);

  const belly = sampleCubic(
    { x: 0.62, y: 0.50 },
    { x: 0.55, y: 0.56 },
    { x: 0.40, y: 0.58 },
    { x: 0.28, y: 0.54 }
  , 9);

  const chest = samplePolyline(
    [
      { x: 0.62, y: 0.50 },
      { x: 0.66, y: 0.42 },
      { x: 0.68, y: 0.34 },
    ],
    6
  );

  const frontLeg = samplePolyline(
    [
      { x: 0.58, y: 0.52 },
      { x: 0.60, y: 0.66 },
      { x: 0.58, y: 0.80 },
    ],
    6
  );

  const frontLeg2 = samplePolyline(
    [
      { x: 0.54, y: 0.52 },
      { x: 0.53, y: 0.68 },
      { x: 0.52, y: 0.82 },
    ],
    5
  );

  const backLeg = samplePolyline(
    [
      { x: 0.32, y: 0.54 },
      { x: 0.30, y: 0.66 },
      { x: 0.28, y: 0.78 },
    ],
    6
  );

  const backLeg2 = samplePolyline(
    [
      { x: 0.36, y: 0.54 },
      { x: 0.38, y: 0.68 },
      { x: 0.37, y: 0.80 },
    ],
    5
  );

  const tail = sampleCubic(
    { x: 0.22, y: 0.40 },
    { x: 0.16, y: 0.42 },
    { x: 0.14, y: 0.52 },
    { x: 0.18, y: 0.62 }
  , 8);

  const ear = samplePolyline(
    [
      { x: 0.73, y: 0.19 },
      { x: 0.75, y: 0.14 },
      { x: 0.77, y: 0.20 },
    ],
    3
  );

  const head = sampleCubic(
    { x: 0.78, y: 0.28 },
    { x: 0.83, y: 0.26 },
    { x: 0.83, y: 0.32 },
    { x: 0.77, y: 0.34 }
  , 6);

  // A few interior points (suggesting muscle/structure) to help the graph read.
  const ribs = samplePolyline(
    [
      { x: 0.54, y: 0.38 },
      { x: 0.50, y: 0.44 },
      { x: 0.46, y: 0.50 },
    ],
    4
  );

  const strokes: P2[][] = [
    spine,
    backToRump,
    belly,
    chest,
    head,
    ear,
    tail,
    frontLeg,
    frontLeg2,
    backLeg,
    backLeg2,
    ribs,
  ];

  const rnd = mulberry32(seed);

  const pts: ConstellationPoint[] = [];
  let id = 0;
  for (let strokeId = 0; strokeId < strokes.length; strokeId++) {
    const stroke = strokes[strokeId];
    for (let order = 0; order < stroke.length; order++) {
      const p = stroke[order];
      const jx = (rnd() - 0.5) * 0.005;
      const jy = (rnd() - 0.5) * 0.005;

      // Slightly emphasize head/neck and hoof points; tail is lighter.
      const headBoost = p.x > 0.68 && p.y < 0.36 ? 1.0 : 0.92;
      const tailLight = p.x < 0.24 ? 0.75 : 1.0;
      const legBoost = p.y > 0.62 ? 0.95 : 1.0;
      const density = clamp01((0.65 + rnd() * 0.35) * headBoost * tailLight * legBoost);

      pts.push({
        x: clamp01(p.x + jx),
        y: clamp01(p.y + jy),
        phase: rnd() * Math.PI * 2,
        speed: 0.6 + rnd() * 1.2,
        size: 0.85 + rnd() * 0.85,
        inkDensity: density,
        id,
        strokeId,
        strokeOrder: order,
      });
      id++;
    }
  }

  return pts;
}
