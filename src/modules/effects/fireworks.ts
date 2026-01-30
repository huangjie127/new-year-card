export type FireworkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type FireworkBurst = {
  particles: FireworkParticle[];
};

export function spawnBurst(x: number, y: number, strength = 1, seed = Math.random()) {
  const rnd = mulberry32(Math.floor(seed * 1e9));
  const count = Math.floor(60 + rnd() * 70);
  const particles: FireworkParticle[] = [];

  const palette = [
    "#ffd36a", // gold
    "#ff6b6b", // red
    "#ff9f43", // orange
    "#6bcBff", // blue
    "#a78bfa", // violet
    "#f472b6", // pink
  ];

  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const sp = (80 + rnd() * 260) * strength;
    const jitter = (rnd() - 0.5) * 30;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp + jitter,
      vy: Math.sin(a) * sp + jitter,
      life: 0,
      maxLife: 1.6 + rnd() * 1.2,
      color: palette[Math.floor(rnd() * palette.length)],
      size: 1 + rnd() * 2.4,
    });
  }

  return { particles } satisfies FireworkBurst;
}

export function stepFireworks(bursts: FireworkBurst[], dt: number) {
  const gravity = 130;
  for (const b of bursts) {
    for (const p of b.particles) {
      p.life += dt;
      p.vy += gravity * dt;
      p.vx *= Math.pow(0.985, dt * 60);
      p.vy *= Math.pow(0.985, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    b.particles = b.particles.filter((p) => p.life < p.maxLife);
  }
  // remove empty bursts
  for (let i = bursts.length - 1; i >= 0; i--) {
    if (bursts[i].particles.length === 0) bursts.splice(i, 1);
  }
}

export function renderFireworks(ctx: CanvasRenderingContext2D, bursts: FireworkBurst[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const b of bursts) {
    for (const p of b.particles) {
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * 0.9;
      const glow = Math.max(0, 1 - t);

      ctx.beginPath();
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // soft halo
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(p.color, alpha * 0.25);
      ctx.arc(p.x, p.y, p.size * (3.2 + glow * 2.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function hexToRgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
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
