import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, face, roundRect } from './art';
import { BaseGame, type Hand } from './types';

type Balloon = {
  id: number;
  player: number;
  baseX: number;
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  sway: number;
  color: string;
};

/** 🎈 풍선 터뜨리기 — 손을 대면 터진다. */
export class BalloonGame extends BaseGame {
  balloons: Balloon[] = [];
  particles = new Particles();
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) {
      for (let i = 0; i < 4; i++) this.balloons.push(this.spawn(p, i / 4));
    }
  }

  private spawn(player: number, stagger = 0) {
    const f = this.field(player);
    const r = Math.max(26, Math.min(f.w, f.h) * (this.players === 2 ? 0.13 : 0.09));
    const margin = r * 1.4;
    const spread = (this.seq * 0.61803398875) % 1;
    const baseX = f.x + margin + spread * Math.max(1, f.w - margin * 2);
    return {
      id: this.seq++,
      player,
      baseX,
      x: baseX,
      y: f.y + f.h - stagger * f.h * 0.92,
      r,
      vy: f.h * (0.22 + Math.random() * 0.12) * (this.players === 2 ? 0.9 : 1),
      phase: Math.random() * Math.PI * 2,
      sway: r * 0.9,
      color: PASTELS[(this.seq + player * 2) % PASTELS.length],
    } satisfies Balloon;
  }

  protected step(dt: number, hands: Hand[]) {
    const f = this.field(0);
    for (const b of this.balloons) {
      b.phase += dt * 1.6;
      b.y -= b.vy * dt;
      b.x = b.baseX + Math.sin(b.phase) * b.sway;

      if (b.y + b.r < f.y - 20) {
        Object.assign(b, this.spawn(b.player));
        continue;
      }

      for (const hand of hands) {
        if (hand.player !== b.player) continue;
        const d = Math.hypot(hand.x - b.x, hand.y - b.y);
        if (d < b.r * 0.95) {
          this.scores[b.player] += 1;
          this.particles.burst(b.x, b.y, b.color, 12, ['heart', 'star', 'dot']);
          this.particles.ring(b.x, b.y, C.white, b.r * 0.5);
          const fresh = this.spawn(b.player);
          Object.assign(b, fresh);
          break;
        }
      }
    }
    this.particles.update(dt);
  }

  punch(_p: Punch) {
    /* 접촉 판정만 사용한다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (const b of this.balloons) {
      const ry = b.r * 1.12;
      ctx.save();

      // 실
      ctx.strokeStyle = 'rgba(90,74,99,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + ry);
      ctx.quadraticCurveTo(b.x + 10, b.y + ry + b.r * 0.7, b.x - 4, b.y + ry + b.r * 1.3);
      ctx.stroke();

      // 몸통
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 하이라이트
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(b.x - b.r * 0.34, b.y - ry * 0.34, b.r * 0.2, ry * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.globalAlpha = 1;

      face(ctx, b.x, b.y + ry * 0.02, b.r * 0.72);

      // 매듭
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 0.12, b.y + ry);
      ctx.lineTo(b.x + b.r * 0.12, b.y + ry);
      ctx.lineTo(b.x, b.y + ry + b.r * 0.18);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 반짝임
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + b.phase);
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = C.white;
      roundRect(ctx, b.x + b.r * 0.55, b.y - ry * 0.75, 4, 4, 2);
      ctx.fill();
      ctx.restore();
    }
    this.particles.draw(ctx);
  }
}
