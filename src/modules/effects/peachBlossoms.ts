export type PeachBlossom = {
  kind: "blossom" | "petal";
  id?: number;
  user?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  rotV: number;
  petals: number;
  bloom: number;
  bloomV: number;
  life: number;
  lifeMax: number;
  hue: number;
  sat: number;
  light: number;
  depth: number;
  phase: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spawnBlossom(rand: () => number, w: number, h: number): PeachBlossom {
  const margin = Math.min(w, h) * 0.06;
  const x = margin + rand() * (w - margin * 2);
  const y = margin + rand() * (h - margin * 2);

  // Larger blossoms for a more painterly feel. (User request: ~3x)
  const r = (6.2 + rand() * 11.0) * (0.9 + rand() * 0.45) * 3;
  const petals = 5 + (rand() > 0.86 ? 1 : 0);

  // Blossoms: mostly stay in place; very subtle breathing drift.
  const vx = (rand() - 0.5) * 3;
  const vy = (rand() - 0.5) * 3;

  const rot = rand() * Math.PI * 2;
  const rotV = (rand() - 0.5) * 0.35;

  // bloom in, then linger, then fade
  const bloom = 0;
  const bloomV = 0.45 + rand() * 0.55;
  const lifeMax = 10 + rand() * 14;

  // peach blossom palette (ink-wash friendly)
  const hue = 342 + rand() * 18; // pink/red
  // Depth controls ink strength: some blossoms are pale, some are deeper.
  const depth = Math.pow(rand(), 0.75); // bias towards mid
  const sat = 28 + depth * 32 + rand() * 8;
  const light = 78 - depth * 16 + rand() * 6;

  return {
    kind: "blossom",
    x,
    y,
    vx,
    vy,
    r,
    rot,
    rotV,
    petals,
    bloom,
    bloomV,
    life: 0,
    lifeMax,
    hue,
    sat,
    light,
    depth,
    phase: rand() * Math.PI * 2,
  };
}

export function createUserBlossom(
  x: number,
  y: number,
  w: number,
  h: number,
  seed = 20260129
): PeachBlossom {
  const rand = mulberry32((seed ^ Math.floor(x + y)) >>> 0);
  const b = spawnBlossom(rand, w, h);
  b.x = x;
  b.y = y;
  b.user = true;
  b.life = 0;
  b.lifeMax = 1e9;
  b.bloom = 0;
  return b;
}

function spawnPetal(rand: () => number, w: number, h: number): PeachBlossom {
  const margin = Math.min(w, h) * 0.06;
  const x = margin + rand() * (w - margin * 2);
  const y = -margin - rand() * h * 0.35;

  // Petals should be noticeably smaller than blossoms.
  const r = (4.0 + rand() * 8.0) * (0.9 + rand() * 0.5) * 1.6;
  const petals = 1;

  const vx = (rand() - 0.5) * 22;
  const vy = 8 + rand() * 22;
  const rot = rand() * Math.PI * 2;
  const rotV = (rand() - 0.5) * 2.0;

  const bloom = 0;
  const bloomV = 0.35 + rand() * 0.45;
  const lifeMax = 9 + rand() * 12;

  const hue = 342 + rand() * 18;
  const depth = Math.pow(rand(), 0.85);
  const sat = 22 + depth * 26 + rand() * 8;
  const light = 82 - depth * 14 + rand() * 6;

  return {
    kind: "petal",
    x,
    y,
    vx,
    vy,
    r,
    rot,
    rotV,
    petals,
    bloom,
    bloomV,
    life: 0,
    lifeMax,
    hue,
    sat,
    light,
    depth,
    phase: rand() * Math.PI * 2,
  };
}

export function createPeachBlossoms(count: number, w: number, h: number, seed = 20260129): PeachBlossom[] {
  const rand = mulberry32(seed);
  const items: PeachBlossom[] = [];
  // Majority blossoms, minority petals.
  const petalRatio = 0.18;
  for (let i = 0; i < count; i++) {
    items.push(rand() < petalRatio ? spawnPetal(rand, w, h) : spawnBlossom(rand, w, h));
  }
  return items;
}

export function stepPeachBlossoms(items: PeachBlossom[], dt: number, w: number, h: number, seed = 20260129) {
  const rand = mulberry32((seed + Math.floor(performance.now() / 1000)) >>> 0);
  const t = performance.now() / 1000;
  const margin = Math.min(w, h) * 0.06;

  // Physics-ish params (canvas pixels / second units)
  // Tuning goal: slower, floatier, more "xian".
  const g = 85; // gravity
  const drag = 0.42; // stronger linear drag
  const windBase = 44;
  const windWave = 0.7;
  const windScroll = 0.22;

  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    b.life += dt;

    // bloom curve (ease out)
    b.bloom = Math.min(1, b.bloom + dt * b.bloomV);

    // User-pinned blossoms: keep them stable (no respawn), allow gentle breathing.
    if (b.user && b.kind === "blossom") {
      b.rot += b.rotV * dt * 0.4;
      b.x += Math.sin(b.phase + t * 0.25) * dt * (0.9 + 1.2 * b.depth);
      b.y += Math.cos(b.phase * 0.7 + t * 0.2) * dt * (0.7 + 1.0 * b.depth);
      continue;
    }

    if (b.kind === "blossom") {
      // Blossoms: gently "exist" and then fade/renew (grow-open-fall).
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.rotV * dt;
      // micro sway
      b.x += Math.sin(b.phase + t * 0.25) * dt * (0.8 + 1.2 * b.depth);
      b.y += Math.cos(b.phase * 0.7 + t * 0.2) * dt * (0.6 + 1.0 * b.depth);

      const pad = Math.max(160, b.r * 1.8);
      const out = b.x < -pad || b.x > w + pad || b.y < -pad || b.y > h + pad;
      if (b.life > b.lifeMax || out) {
        items[i] = spawnBlossom(rand, w, h);
      }
      continue;
    }

    // Petals: wind + gravity free-fall
    const wind =
      windBase * Math.sin(b.phase + b.y * 0.0035 * windWave + t * windScroll) +
      18 * Math.sin(b.phase * 0.9 + t * 0.9);

    const ax = wind;
    const ay = g;

    b.vx += ax * dt;
    b.vy += ay * dt;

    b.vx *= 1 - drag * dt;
    b.vy *= 1 - drag * dt;

    b.vy = Math.min(b.vy, 190 + 60 * b.depth);

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += (b.rotV + b.vx * 0.012) * dt;

    if (rand() > 0.989) {
      b.vx += (rand() - 0.5) * 26;
      b.vy += (rand() - 0.5) * 12;
      b.rotV += (rand() - 0.5) * 0.45;
    }

    const pad = Math.max(120, b.r * 2.6);
    const outBottom = b.y > h + pad;
    const outSide = b.x < -pad || b.x > w + pad;
    if (b.life > b.lifeMax || outBottom || outSide) {
      const nb = spawnPetal(rand, w, h);
      nb.x = margin + rand() * (w - margin * 2);
      nb.y = -pad - rand() * h * 0.2;
      items[i] = nb;
    }
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, r: number) {
  // simple teardrop petal
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.8, -r * 0.6, r * 0.9, r * 0.5, 0, r);
  ctx.bezierCurveTo(-r * 0.9, r * 0.5, -r * 0.8, -r * 0.6, 0, -r);
  ctx.closePath();
  ctx.fill();
}

export function renderPeachBlossoms(ctx: CanvasRenderingContext2D, items: PeachBlossom[], w: number, h: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const blossoms = items.filter((it) => it.kind === "blossom");
  const petals = items.filter((it) => it.kind === "petal");

  // Blossoms (grow/open/fade)
  for (const b of blossoms) {
    const t = b.life / b.lifeMax;
    const fade = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    const alpha = (0.09 + 0.14 * b.depth) * b.bloom * fade;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);

    const washRadius = b.r * (6.6 + 2.8 * b.depth);
    const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, washRadius);
    wash.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${Math.min(94, b.light + 10)}%, ${alpha * (0.55 + 0.25 * b.depth)})`);
    wash.addColorStop(1, `hsla(${b.hue}, ${Math.max(10, b.sat - 22)}%, ${Math.max(66, b.light)}%, 0)`);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(0, 0, washRadius, 0, Math.PI * 2);
    ctx.fill();

    const petalAlpha = alpha * (1.0 + 0.55 * b.depth);
    ctx.fillStyle = `hsla(${b.hue}, ${b.sat}%, ${b.light}%, ${petalAlpha})`;
    const pr = b.r * (0.95 + 0.55 * b.bloom);
    for (let i = 0; i < b.petals; i++) {
      ctx.save();
      ctx.rotate((i * (Math.PI * 2)) / b.petals);
      ctx.translate(0, -b.r * (0.42 + 0.08 * b.depth));
      drawPetal(ctx, pr);
      ctx.restore();
    }

    // center dot
    ctx.globalAlpha = 1;
    ctx.fillStyle = `hsla(${b.hue + 8}, ${Math.min(72, b.sat + 18)}%, ${Math.max(32, b.light - 32 - 10 * b.depth)}%, ${alpha * (0.9 + 0.55 * b.depth)})`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.2, b.r * (0.45 + 0.18 * b.depth)), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Petals (floaty fall)
  for (const b of petals) {
    const t = b.life / b.lifeMax;
    const fade = t < 0.78 ? 1 : Math.max(0, 1 - (t - 0.78) / 0.22);
    const alpha = (0.08 + 0.10 * b.depth) * b.bloom * fade;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);

    const washRadius = b.r * (5.2 + 2.0 * b.depth);
    const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, washRadius);
    wash.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${Math.min(95, b.light + 12)}%, ${alpha * (0.55 + 0.18 * b.depth)})`);
    wash.addColorStop(1, `hsla(${b.hue}, ${Math.max(10, b.sat - 22)}%, ${Math.max(68, b.light)}%, 0)`);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(0, 0, washRadius, 0, Math.PI * 2);
    ctx.fill();

    const pr = b.r * (1.05 + 0.65 * b.bloom);
    const petalAlpha = alpha * (0.95 + 0.75 * b.depth);
    ctx.fillStyle = `hsla(${b.hue}, ${Math.max(18, b.sat - 4)}%, ${b.light}%, ${petalAlpha})`;
    ctx.save();
    ctx.translate(0, -b.r * (0.20 + 0.16 * b.depth));
    drawPetal(ctx, pr);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = `hsla(${b.hue}, ${Math.max(10, b.sat - 14)}%, ${Math.min(96, b.light + 14)}%, ${petalAlpha * 0.55})`;
    ctx.lineWidth = Math.max(1, b.r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.2, -b.r * 0.75);
    ctx.quadraticCurveTo(b.r * 0.35, -b.r * 0.1, -b.r * 0.05, b.r * 0.85);
    ctx.stroke();

    ctx.restore();
  }

  // subtle paper vignette so blossoms sit "in" the paper
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.15, w * 0.5, h * 0.45, Math.min(w, h) * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(120,110,90,0.06)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
