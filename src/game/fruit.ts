import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, face } from './art';
import { BaseGame, type Hand } from './types';

type Fall = {
  id: number;
  player: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  kind: 'fruit' | 'bee';
  color: string;
  rot: number;
  vr: number;
  sway: number;
  phase: number;
  seed: number;
};

/** 🍎 과일 받기 — 손을 좌우로 움직여 바구니로 과일을 받는다. (우리만의 게임) */
export class FruitGame extends BaseGame {
  falls: Fall[] = [];
  particles = new Particles();
  private baskets: number[] = [];
  private stun: [number, number] = [0, 0];
  private timer: [number, number] = [0.4, 0.4];
  private caught: [number, number] = [0, 0];
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.baskets.push(this.field(p).x + this.field(p).w / 2);
  }

  private basketW(player: number) {
    const f = this.field(player);
    return Math.max(96, Math.min(f.w * 0.42, 190));
  }

  private basketY(player: number) {
    const f = this.field(player);
    return f.y + f.h - this.basketW(player) * 0.16;
  }

  private spawn(player: number) {
    const f = this.field(player);
    const r = Math.max(20, Math.min(f.w, f.h) * 0.055);
    const bee = Math.random() < 0.18;
    this.falls.push({
      id: this.seq++,
      player,
      x: f.x + r * 2 + Math.random() * Math.max(1, f.w - r * 4),
      y: f.y - r * 2,
      vy: f.h * (0.34 + Math.random() * 0.14) + this.levels[player] * f.h * 0.012,
      r,
      kind: bee ? 'bee' : 'fruit',
      color: bee ? '#ffd95e' : PASTELS[Math.floor(Math.random() * PASTELS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 2.2,
      sway: r * (0.5 + Math.random() * 0.6),
      phase: Math.random() * Math.PI * 2,
      seed: Math.random() * 99,
    });
  }

  protected step(dt: number, hands: Hand[]) {
    for (let p = 0; p < this.players; p++) {
      const hand = hands.find((h) => h.player === p);
      if (hand) {
        const f = this.field(p);
        const half = this.basketW(p) / 2;
        const target = Math.max(f.x + half, Math.min(f.x + f.w - half, hand.x));
        this.baskets[p] += (target - this.baskets[p]) * Math.min(1, dt * 14);
      }

      this.stun[p] = Math.max(0, this.stun[p] - dt);
      this.timer[p] -= dt;
      if (this.timer[p] <= 0) {
        this.spawn(p);
        this.timer[p] = Math.max(0.34, 0.85 - this.levels[p] * 0.04) * (0.75 + Math.random() * 0.5);
      }
    }

    const bx: number[] = [];
    const by: number[] = [];
    for (let p = 0; p < this.players; p++) {
      bx.push(this.baskets[p]);
      by.push(this.basketY(p));
    }

    for (const it of this.falls) {
      it.phase += dt * 2.2;
      it.rot += it.vr * dt;
      it.y += it.vy * dt;
      it.x += Math.sin(it.phase) * it.sway * dt;

      const half = this.basketW(it.player) / 2;
      const basketX = bx[it.player];
      const basketTop = by[it.player];
      const inBasket =
        it.y + it.r * 0.5 >= basketTop &&
        it.y - it.r * 0.5 <= basketTop + this.basketW(it.player) * 0.34 &&
        Math.abs(it.x - basketX) <= half + it.r * 0.3;

      if (inBasket && this.stun[it.player] <= 0) {
        if (it.kind === 'fruit') {
          this.scores[it.player] += 1;
          this.caught[it.player] += 1;
          sfx('catch');
          this.particles.burst(it.x, it.y, it.color, 9, ['heart', 'star', 'dot']);
          this.particles.ring(it.x, it.y, C.white, 14);
          if (this.caught[it.player] % 10 === 0) {
            this.levels[it.player] += 1;
            this.scores[it.player] += 2;
            sfx('chime');
          }
        } else {
          this.stun[it.player] = 0.55;
          sfx('buzz');
          this.particles.burst(it.x, it.y, '#ffd95e', 8, ['dot']);
        }
        it.y = Infinity;
        continue;
      }

      const f = this.field(it.player);
      if (it.y - it.r > f.y + f.h + 80) it.y = Infinity;
    }

    this.falls = this.falls.filter((it) => it.y !== Infinity);
    this.particles.update(dt);
  }

  punch(_p: Punch) {
    /* 손 위치로만 받는다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    // 바구니
    for (let p = 0; p < this.players; p++) {
      const w = this.basketW(p);
      const h = w * 0.34;
      const x = this.baskets[p];
      const y = this.basketY(p);
      const tilt = this.stun[p] > 0 ? Math.sin(time * 30) * 0.08 : 0;

      ctx.save();
      ctx.translate(x, y + h / 2);
      ctx.rotate(tilt);

      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w * 0.38, h / 2);
      ctx.lineTo(-w * 0.38, h / 2);
      ctx.closePath();
      ctx.fillStyle = '#e8c79a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(150,110,80,0.55)';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * w * 0.18, -h / 2 + 3);
        ctx.lineTo(i * w * 0.14, h / 2 - 3);
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.44 + i * 3, -h * 0.1 + i * h * 0.28);
        ctx.lineTo(w * 0.44 - i * 3, -h * 0.1 + i * h * 0.28);
        ctx.stroke();
      }

      // 앞면 귀여운 얼굴
      face(ctx, 0, h * 0.05, w * 0.12, { blush: 'rgba(255,127,180,0.45)' });
      ctx.restore();
    }

    // 떨어지는 것들
    for (const it of this.falls) {
      ctx.save();
      ctx.translate(it.x, it.y);

      if (it.kind === 'bee') {
        ctx.rotate(Math.sin(time * 18 + it.seed) * 0.15);
        // 날개
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(s * it.r * 0.75, -it.r * 0.55, it.r * 0.55, it.r * 0.32, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, it.r, it.r * 0.92, 0, 0, Math.PI * 2);
        ctx.fillStyle = it.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.8)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, it.r, it.r * 0.92, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#5a4a63';
        for (const off of [-0.35, 0.15, 0.6]) {
          ctx.fillRect(-it.r, it.r * off, it.r * 2, it.r * 0.16);
        }
        ctx.restore();

        face(ctx, 0, -it.r * 0.05, it.r * 0.7, { mood: 'surprised' });
      } else {
        ctx.rotate(it.rot * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fillStyle = it.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 잎
        ctx.beginPath();
        ctx.ellipse(it.r * 0.15, -it.r * 1.05, it.r * 0.34, it.r * 0.16, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#8ed6a2';
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        face(ctx, 0, it.r * 0.05, it.r * 0.7);
      }
      ctx.restore();
    }

    this.particles.draw(ctx);
  }
}
