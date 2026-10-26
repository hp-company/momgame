import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, Particles, face, roundRect } from './art';
import { BaseGame, type Hand } from './types';

const BAND = 0.1;

/** 🚁 헬리콥터 — 손을 올리고 내려 구름 사이를 지나간다. (우리만의 게임) */
export class HeliGame extends BaseGame {
  alt: number[] = [];
  particles = new Particles();
  private tick: [number, number] = [0, 0];
  private hit: [number, number] = [0, 0];

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.alt.push(0.5);
  }

  private bandCenter(player: number) {
    return 0.55 + Math.sin(this.levels[player] * 0.7) * 0.06;
  }

  protected step(dt: number, hands: Hand[]) {
    for (let p = 0; p < this.players; p++) {
      const f = this.field(p);
      const hand = hands.find((h) => h.player === p);
      if (hand) {
        const want = Math.max(0.08, Math.min(0.92, 1 - (hand.y - f.y) / f.h));
        this.alt[p] += (want - this.alt[p]) * Math.min(1, dt * 3.4);
      } else {
        this.alt[p] += (0.5 - this.alt[p]) * Math.min(1, dt * 1.5);
      }

      const inside = Math.abs(this.alt[p] - this.bandCenter(p)) <= BAND;
      if (inside) {
        this.tick[p] += dt;
        if (this.tick[p] >= 0.65) {
          this.tick[p] = 0;
          this.scores[p] += 1;
          this.hit[p] += 1;
          sfx('tick');
          const cy = f.y + f.h * (1 - this.alt[p]);
          this.particles.burst(f.x + f.w / 2, cy, C.yellow, 6, ['star', 'heart', 'dot']);
          if (this.hit[p] % 12 === 0) {
            this.levels[p] += 1;
            this.scores[p] += 3;
            sfx('chime');
          }
        }
      } else {
        this.tick[p] = Math.max(0, this.tick[p] - dt * 0.6);
      }
    }
    this.particles.update(dt);
  }

  punch(_p: Punch) {
    /* 손 높이로만 조종한다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (let p = 0; p < this.players; p++) {
      const f = this.field(p);
      const bandY = f.y + f.h * (1 - this.bandCenter(p));
      const bandH = f.h * BAND;

      // 구름 길
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(ctx, f.x, bandY - bandH, f.w, bandH * 2, bandH);
      ctx.fill();
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(f.x + 8, bandY + s * bandH);
        ctx.lineTo(f.x + f.w - 8, bandY + s * bandH);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // 구름 장식
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 4; i++) {
        const seed = p * 7 + i;
        const cx = f.x + ((time * 14 + i * 120 + seed * 33) % (f.w + 140)) - 70;
        const cy = f.y + f.h * (0.14 + ((i * 0.23 + seed * 0.11) % 0.7));
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy + 4, 16, 0, Math.PI * 2);
        ctx.arc(cx - 20, cy + 6, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 고도 게이지
      const gx = f.x + f.w - 14;
      ctx.save();
      ctx.strokeStyle = 'rgba(90,74,99,0.25)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, f.y + f.h * 0.92);
      ctx.lineTo(gx, f.y + f.h * 0.08);
      ctx.stroke();
      const hy = f.y + f.h * (1 - this.alt[p]);
      ctx.beginPath();
      ctx.arc(gx, hy, 9, 0, Math.PI * 2);
      ctx.fillStyle = C.pinkDeep;
      ctx.fill();
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // 헬리콥터
      const hx = f.x + f.w / 2 + Math.sin(time * 1.7 + p) * f.w * 0.14;
      const bodyR = Math.max(34, Math.min(f.w, f.h) * 0.095);
      const inside = Math.abs(this.alt[p] - this.bandCenter(p)) <= BAND;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.sin(time * 2 + p) * 0.05);

      // 꼬리
      ctx.strokeStyle = 'rgba(90,74,99,0.8)';
      ctx.lineWidth = bodyR * 0.2;
      ctx.beginPath();
      ctx.moveTo(bodyR * 0.7, -bodyR * 0.1);
      ctx.lineTo(bodyR * 1.7, -bodyR * 0.35);
      ctx.stroke();

      // 동체
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyR, bodyR * 0.78, 0, 0, Math.PI * 2);
      ctx.fillStyle = inside ? '#bfe7ff' : '#e6e1f5';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 창 + 얼굴
      ctx.beginPath();
      ctx.ellipse(-bodyR * 0.15, -bodyR * 0.12, bodyR * 0.5, bodyR * 0.36, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.white;
      ctx.fill();
      face(ctx, -bodyR * 0.15, -bodyR * 0.12, bodyR * 0.4);

      // 스키드
      ctx.strokeStyle = 'rgba(90,74,99,0.7)';
      ctx.lineWidth = bodyR * 0.12;
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.5, bodyR * 0.8);
      ctx.lineTo(bodyR * 0.6, bodyR * 0.8);
      ctx.stroke();

      // 로터
      const spin = Math.cos(time * 26 + p);
      ctx.strokeStyle = 'rgba(90,74,99,0.5)';
      ctx.lineWidth = bodyR * 0.12;
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.9 * Math.abs(spin), -bodyR * 0.98);
      ctx.lineTo(bodyR * 0.9 * Math.abs(spin || 0.2), -bodyR * 0.98);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -bodyR * 0.98);
      ctx.lineTo(0, -bodyR * 0.55);
      ctx.stroke();
      ctx.restore();

      // 반짝임
      if (inside) {
        const a = 0.4 + 0.3 * Math.sin(time * 6 + p);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.yellow;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(hx, hy, bodyR * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    this.particles.draw(ctx);
  }
}
