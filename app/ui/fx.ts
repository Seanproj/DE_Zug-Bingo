// Feedback effects: haptics + a tiny canvas confetti engine (no dependencies).

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(pattern: number[], enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw when not triggered by a gesture */
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
  ttl: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas!.width = innerWidth * dpr;
    canvas!.height = innerHeight * dpr;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
}

function tick() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life < p.ttl && p.y < innerHeight + 40);
  for (const p of particles) {
    p.life++;
    p.vy += 0.18;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
    ctx.restore();
  }
  raf = particles.length ? requestAnimationFrame(tick) : 0;
}

export interface BurstOptions {
  count: number;
  colors: string[];
  /** initial speed */
  power?: number;
  /** radians; full circle by default */
  spread?: number;
  /** direction in radians (−π/2 = up) */
  angle?: number;
}

/** Confetti burst from a viewport point. No-op with reduced motion. */
export function burst(x: number, y: number, { count, colors, power = 7, spread = Math.PI * 2, angle = -Math.PI / 2 }: BurstOptions): void {
  if (prefersReducedMotion() || typeof document === 'undefined') return;
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = power * (0.45 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 6,
      color: colors[i % colors.length]!,
      life: 0,
      ttl: 70 + Math.random() * 50,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

/** Center of an element in viewport coordinates. */
export function centerOf(el: Element): [number, number] {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
