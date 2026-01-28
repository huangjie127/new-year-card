export type ConstellationPoint = {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  phase: number; // twinkle phase
  speed: number; // twinkle speed
};

export type ConstellationScene = {
  version: 2;
  points: ConstellationPoint[];
  bg: { a: string; b: string }; // gradient colors
  lineColor: string;
  pointColor: string;
  glowColor: string;
  template: "center" | "lowerThird";
  text: {
    content: string;
    color: string;
    fontSize: number;
    fontFamily: string;
    weight: number;
  };
};

type Size = { w: number; h: number; dpr: number };

// Stateless particles cache (in a real app, bind to scene state, but here we use a module-level weakmap or similar if needed. 
// For simplicity, we'll generate them deterministically based on time or just keep them transient.)
// We will modify the signature to accept a persistent "visualState" if we want continuity, 
// but for a "flowing" effect, pure time-based + hash approach is jerky. 
// Let's stick to a simpler "dash offset" or "gradient flow" approach for lines to avoid complex state management.

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function buildEdges(points: ConstellationPoint[], k = 2, maxDist = 0.22) {
  // Connect each point to k nearest neighbors within maxDist (normalized units)
  const edges: Array<[number, number]> = [];
  const maxD2 = maxDist * maxDist;

  for (let i = 0; i < points.length; i++) {
    const pi = points[i];
    const candidates: Array<{ j: number; d2: number }> = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const pj = points[j];
      const d2 = dist2(pi.x, pi.y, pj.x, pj.y);
      if (d2 <= maxD2) candidates.push({ j, d2 });
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (let n = 0; n < Math.min(k, candidates.length); n++) {
      const j = candidates[n].j;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      // de-dup
      if (!edges.some(([x, y]) => x === a && y === b)) edges.push([a, b]);
    }
  }
  return edges;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    // Chinese-friendly: fallback char wrap
    const chars = [...text];
    const lines: string[] = [];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderConstellation(
  ctx: CanvasRenderingContext2D,
  scene: ConstellationScene,
  timeMs: number,
  size: Size
) {
  const { w, h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, scene.bg.a);
  g.addColorStop(1, scene.bg.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const t = timeMs / 1000;

  // Subtle vignette
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  const pts = scene.points;

  // Lines
  const edges = buildEdges(pts, 2, 0.22);
  ctx.save();
  for (const [a, b] of edges) {
    const pa = pts[a];
    const pb = pts[b];
    const ax = pa.x * w;
    const ay = pa.y * h;
    const bx = pb.x * w;
    const by = pb.y * h;
    const twA = 0.55 + 0.45 * Math.sin(t * pa.speed + pa.phase);
    const twB = 0.55 + 0.45 * Math.sin(t * pb.speed + pb.phase);
    const midTw = (twA + twB) * 0.5;

    // Base line (thicker)
    ctx.strokeStyle = scene.lineColor;
    ctx.globalAlpha = 0.4 * midTw; // increased opacity
    ctx.lineWidth = 2.0; // thicker
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Flowing pulse effect (gradient overlay)
    // We simulate a pulse moving from A to B or B to A based on time
    const dist = Math.sqrt(dist2(pa.x * w, pa.y * h, pb.x * w, pb.y * h));
    const flowSpeed = 100; // pixels per second
    const flowT = (timeMs / 1000 * flowSpeed) % (dist * 2); // repeating cycle
    void flowT;

    // Draw a "packet" of light
    const grad = ctx.createLinearGradient(ax, ay, bx, by);
    // Create a moving highlight window
    const phase = (timeMs / 800 + (a + b) * 0.2) % 1;

    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(Math.max(0, phase - 0.15), "rgba(255,255,255,0)");
    grad.addColorStop(phase, "rgba(255,255,255,0.9)"); // Bright white peak
    grad.addColorStop(Math.min(1, phase + 0.15), "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 4.0; // Glow width
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.8;
    ctx.globalCompositeOperation = "screen";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter"; // Restore
  }

  // Points (glow + core)
  for (const p of pts) {
    const x = p.x * w;
    const y = p.y * h;
    const tw = 0.55 + 0.45 * Math.sin(t * p.speed + p.phase);

    // outer glow (larger)
    ctx.save();
    ctx.globalAlpha = 0.4 * tw;
    ctx.fillStyle = scene.glowColor;
    ctx.shadowColor = scene.glowColor;
    ctx.shadowBlur = 25; // increased blur
    ctx.beginPath();
    ctx.arc(x, y, 6.0, 0, Math.PI * 2); // larger radius
    ctx.fill();
    ctx.restore();

    // core (larger)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = scene.pointColor;
    ctx.beginPath();
    ctx.arc(x, y, 3.0, 0, Math.PI * 2); // larger core
    ctx.fillStyle = scene.glowColor;
    ctx.shadowColor = scene.glowColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = scene.pointColor;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // Text (template)
  const tx = scene.text;
  ctx.save();
  ctx.fillStyle = tx.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${tx.weight} ${tx.fontSize}px ${tx.fontFamily}`;

  const maxWidth = Math.min(w * 0.78, 920);
  const lines = wrapLines(ctx, tx.content || " ", maxWidth).slice(0, 4);
  const lineH = Math.round(tx.fontSize * 1.25);

  const baseY = scene.template === "center" ? h * 0.55 : h * 0.72;
  const startY = baseY - ((lines.length - 1) * lineH) / 2;

  // Soft text shadow for readability
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w * 0.5, startY + i * lineH);
  }
  ctx.restore();
}

export function canvasToNormalizedPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
) {
  const r = canvas.getBoundingClientRect();
  const x = clamp01((clientX - r.left) / r.width);
  const y = clamp01((clientY - r.top) / r.height);
  return { x, y };
}
