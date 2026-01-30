export type Snowflake = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  wobble: number;
  alpha: number;
};

export function createSnowflakes(count: number, w: number, h: number, seed = 1) {
  const rnd = mulberry32(seed);
  const flakes: Snowflake[] = [];
  for (let i = 0; i < count; i++) {
    flakes.push({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.6 + rnd() * 2.2,
      vy: 12 + rnd() * 32,
      vx: -6 + rnd() * 12,
      wobble: rnd() * Math.PI * 2,
      alpha: 0.15 + rnd() * 0.35,
    });
  }
  return flakes;
}

export function stepSnow(flakes: Snowflake[], dt: number, w: number, h: number) {
  for (const f of flakes) {
    f.wobble += dt * 0.8;
    const wx = Math.sin(f.wobble) * 10;
    f.x += (f.vx + wx) * dt;
    f.y += f.vy * dt;

    if (f.y > h + 10) {
      f.y = -10;
      f.x = Math.random() * w;
    }
    if (f.x < -30) f.x = w + 30;
    if (f.x > w + 30) f.x = -30;
  }
}

export function renderSnow(ctx: CanvasRenderingContext2D, flakes: Snowflake[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const f of flakes) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${f.alpha})`;
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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
