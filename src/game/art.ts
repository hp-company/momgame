/** 파스텔 팔레트 + 귀여운 도형/파티클 헬퍼 */

export const C = {
  ink: '#5a4a63',
  inkSoft: '#8c7a94',
  cream: '#fff8fb',
  white: '#ffffff',
  pink: '#ffb3d1',
  pinkDeep: '#ff7fb4',
  lavender: '#c9b6ff',
  mint: '#a8e6cf',
  sky: '#a7d8ff',
  yellow: '#ffe27a',
  peach: '#ffc9a3',
};

export const PASTELS = [C.pink, C.lavender, C.mint, C.sky, C.yellow, C.peach];

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points = 5) {
  const inner = r * 0.46;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.75);
  ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.35, cx - r * 0.55, cy - r * 1.35, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.35, cx + r * 1.5, cy - r * 0.35, cx, cy + r * 0.75);
  ctx.closePath();
}

/** 눈 + 볼터치 + 입. kekawaii 얼굴. */
export function face(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts?: { mood?: 'happy' | 'surprised' | 'sleepy'; blush?: string },
) {
  const mood = opts?.mood ?? 'happy';
  const blush = opts?.blush ?? 'rgba(255, 127, 180, 0.55)';
  const eyeR = Math.max(1.6, r * 0.09);
  const dx = r * 0.32;
  const dy = -r * 0.08;

  ctx.save();
  ctx.fillStyle = 'rgba(255,127,180,0.35)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * r * 0.52, cy + r * 0.16, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = C.ink;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (mood === 'sleepy') {
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.strokeStyle = C.ink;
      ctx.moveTo(cx + s * dx - eyeR, cy + dy);
      ctx.lineTo(cx + s * dx + eyeR, cy + dy);
      ctx.stroke();
    } else {
      ctx.arc(cx + s * dx, cy + dy, eyeR, 0, Math.PI * 2);
      ctx.fill();
      // 반짝이 눈동자
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + s * dx + eyeR * 0.35, cy + dy - eyeR * 0.4, eyeR * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1.4, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'surprised') {
    ctx.ellipse(cx, cy + r * 0.3, r * 0.09, r * 0.12, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, cy + r * 0.16, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();

  if (mood === 'happy') {
    ctx.fillStyle = blush;
  }
  ctx.restore();
}

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  rot: number;
  vr: number;
  shape: 'heart' | 'star' | 'dot' | 'ring';
  grow?: number;
};

export class Particles {
  list: Particle[] = [];

  burst(
    x: number,
    y: number,
    color: string,
    count = 8,
    shapes: Particle['shape'][] = ['heart', 'star', 'dot'],
  ) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 240;
      const life = 0.5 + Math.random() * 0.5;
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life,
        max: life,
        color,
        size: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }
  }

  ring(x: number, y: number, color: string, size = 16) {
    this.list.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      max: 0.35,
      color,
      size,
      rot: 0,
      vr: 0,
      shape: 'ring',
      grow: 60,
    });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      if (p.shape === 'ring') {
        p.size += (p.grow ?? 40) * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 520 * dt;
        p.rot += p.vr * dt;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'heart') {
        ctx.fillStyle = p.color;
        heartPath(ctx, 0, 0, p.size);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.fillStyle = p.color;
        starPath(ctx, 0, 0, p.size);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/** 배경에 천천히 떠다니는 장식 (하트/별/물방울) */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const spots = [
    { x: 0.08, y: 0.16, r: 0.055, kind: 'heart', color: C.pink, sp: 0.18 },
    { x: 0.92, y: 0.12, r: 0.045, kind: 'star', color: C.yellow, sp: 0.24 },
    { x: 0.16, y: 0.86, r: 0.05, kind: 'star', color: C.lavender, sp: 0.2 },
    { x: 0.86, y: 0.82, r: 0.06, kind: 'heart', color: C.pinkDeep, sp: 0.16 },
    { x: 0.5, y: 0.06, r: 0.03, kind: 'dot', color: C.mint, sp: 0.3 },
  ] as const;

  ctx.save();
  for (const s of spots) {
    const bob = Math.sin(time * s.sp + s.x * 10) * h * 0.012;
    const x = s.x * w;
    const y = s.y * h + bob;
    const r = s.r * Math.min(w, h);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = s.color;
    if (s.kind === 'heart') {
      heartPath(ctx, x, y, r);
      ctx.fill();
    } else if (s.kind === 'star') {
      starPath(ctx, x, y, r);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
