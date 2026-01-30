// Ink & Paper Style Renderer

export type ConstellationPoint = {
  x: number;
  y: number;
  phase: number;
  speed: number;
  // Ink specific
  size: number;
  inkDensity: number; // 0..1 how dark
  id: number; // stable id for deterministic motion
  strokeId?: number;
  strokeOrder?: number;
};

export type ConstellationScene = {
  version: 3;
  points: ConstellationPoint[];
  mode: "idle" | "wandering" | "dispersing" | "finished";
};

type Size = { w: number; h: number; dpr: number };

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// Simple Perlin-like noise approximation for "wandering"
// time + seed -> value -1..1
function noise(t: number, seed: number) {
  return Math.sin(t + seed * 12.34) * 0.5 + Math.sin(t * 0.5 + seed * 45.67) * 0.5;
}

function getOffset(p: ConstellationPoint, t: number, mode: ConstellationScene["mode"]) {
  // “Wind, ink, time”: low-frequency motion, never twitchy.
  const amp = mode === "wandering" ? 0.020 : mode === "idle" ? 0.003 : 0.0;
  const rate = mode === "wandering" ? 0.28 : 0.12;

  // Two slightly different bands to avoid circular motion.
  const ox = noise(t * rate, p.id + p.phase) * amp;
  const oy = noise(t * (rate * 0.86), p.id + p.speed) * amp;
  return { x: ox, y: oy };
}

function buildEdges(pos: Array<{ x: number; y: number }>, k = 2, maxDist = 0.35) {
  const edges: Array<[number, number]> = [];
  const maxD2 = maxDist * maxDist;

  for (let i = 0; i < pos.length; i++) {
    const pi = pos[i];
    const candidates: Array<{ j: number; d2: number }> = [];
    for (let j = 0; j < pos.length; j++) {
      if (i === j) continue;
      const pj = pos[j];
      const d2 = dist2(pi.x, pi.y, pj.x, pj.y);
      if (d2 <= maxD2) candidates.push({ j, d2 });
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (let n = 0; n < Math.min(k, candidates.length); n++) {
      const j = candidates[n].j;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      if (!edges.some(([x, y]) => x === a && y === b)) edges.push([a, b]);
    }
  }
  return edges;
}

function buildStrokeEdges(points: ConstellationPoint[]) {
  const byStroke = new Map<number, ConstellationPoint[]>();
  for (const p of points) {
    if (p.strokeId === undefined || p.strokeOrder === undefined) continue;
    const arr = byStroke.get(p.strokeId) ?? [];
    arr.push(p);
    byStroke.set(p.strokeId, arr);
  }

  const edges: Array<[number, number]> = [];
  for (const arr of byStroke.values()) {
    arr.sort((a, b) => (a.strokeOrder ?? 0) - (b.strokeOrder ?? 0));
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i].id;
      const b = arr[i + 1].id;
      if (a === b) continue;
      edges.push(a < b ? [a, b] : [b, a]);
    }
  }
  return edges;
}

function dedupeEdges(edges: Array<[number, number]>) {
  const out: Array<[number, number]> = [];
  for (const [a, b] of edges) {
    if (!out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
  }
  return out;
}

export function renderInk(
  ctx: CanvasRenderingContext2D,
  scene: ConstellationScene,
  timeMs: number,
  size: Size
) {
  const { w, h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Background is transparent (handled by CSS)
  
  const t = timeMs / 1000;
  const pts = scene.points;

  const pos = pts.map((p) => {
    const off = scene.mode === "finished" ? { x: 0, y: 0 } : getOffset(p, t, scene.mode);
    return { x: p.x + off.x, y: p.y + off.y };
  });

  // Draw Ink Lines
  // Preserve silhouette first (stroke edges), then add a few neighbor links.
  const strokeEdges = buildStrokeEdges(pts);
  const neighborEdges = buildEdges(pos, 2, 0.22);
  const edges = dedupeEdges([...strokeEdges, ...neighborEdges]);
  
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [a, b] of edges) {
    const pa = pts[a];
    const pb = pts[b];

    const ax = pos[a].x * w;
    const ay = pos[a].y * h;
    const bx = pos[b].x * w;
    const by = pos[b].y * h;

    // Ink "Breathing" Opacity
    // Sine wave 12-18s cycle
    // We map -1..1 to 0.82..0.88
    const breath = 0.85 + Math.sin(t * 0.4) * 0.03; 
    
    // Line Width variation
    const dist = Math.sqrt(dist2(pa.x, pa.y, pb.x, pb.y));
    const width = Math.max(0.5, 3.0 - dist * 5); // Short lines thicker

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    // Beziers for organic ink?
    // Stick to straight for "Constellation" feel but textured
    ctx.lineTo(bx, by);

    // Style
    // Ink color: Dark grey
    ctx.strokeStyle = `rgba(28, 28, 32, ${breath * pa.inkDensity})`;
    ctx.lineWidth = width;
    ctx.stroke();
    
    // "Bleed" pass (subtle wider, lower opacity)
    ctx.strokeStyle = `rgba(28, 28, 32, 0.08)`;
    ctx.lineWidth = width * 2.5;
    ctx.stroke();
  }

  // Ink Dots (Nodes)
  for (const p of pts) {
    const i = p.id;
    const x = pos[i] ? pos[i].x * w : p.x * w;
    const y = pos[i] ? pos[i].y * h : p.y * h;
    
    // Irregular dot
    ctx.fillStyle = `rgba(20, 20, 25, ${0.9 * p.inkDensity})`;
    ctx.beginPath();
    ctx.arc(x, y, p.size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Bleed
    ctx.fillStyle = `rgba(20, 20, 25, 0.05)`;
    ctx.beginPath();
    ctx.arc(x, y, p.size * 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
