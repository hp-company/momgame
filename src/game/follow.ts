import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, heartPath, starPath } from './art';
import { BaseGame, type Hand } from './types';

type Target = {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  kind: 'star' | 'heart';
  color: string;
};

const HOLD_S = 0.45;

/** 🙌 따라쟁이 — 링이 나타나면 손을 그 안에 잠깐 올려 둔다. */
export class FollowGame extends BaseGame {
  targets: (Target | null)[] = [];
  particles = new Particles();
  private hold: [number, number] = [0, 0];
  private gap: [number, number] = [0.2, 0.2];
  private hits: [number, number] = [0, 0];

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.targets.push(this.makeTarget(p));
  }

  private makeTarget(player: number): Target {
    const f = this.field(player);
    const r = Math.max(52, Math.min(f.w, f.h) * (this.players === 2 ? 0.17 : 0.13));
    const margin = r + f.w * 0.04;
    const life = Math.max(1.5, 3.4 - this.levels[player] * 0.14);
    return {
      x: f.x + margin + Math.random() * Math.max(1, f.w - margin * 2),
      y: f.y + margin + Math.random() * Math.max(1, f.h - margin * 2),
      r,
      life,
      max: life,
      kind: Math.random() < 0.5 ? 'star' : 'heart',
      color: PASTELS[Math.floor(Math.random() * PASTELS.length)],
    };
  }

  protected step(dt: number, hands: Hand[]) {
    for (let p = 0; p < this.players; p++) {
      const t = this.targets[p];
      if (!t) {
        this.gap[p] = Math.max(0, this.gap[p] - dt);
        if (this.gap[p] <= 0) {
          this.targets[p] = this.makeTarget(p);
          this.hold[p] = 0;
        }
        continue;
      }

      t.life -= dt;
      const hand = hands.find((h) => h.player === p);
      const inside = !!hand && Math.hypot(hand.x - t.x, hand.y - t.y) < t.r * 0.92;

      if (inside) {
        this.hold[p] += dt;
        if (this.hold[p] >= HOLD_S) {
          this.collect(p, t);
          continue;
        }
      } else {
        this.hold[p] = Math.max(0, this.hold[p] - dt * 2);
      }

      if (t.life <= 0) {
        this.targets[p] = null;
        this.gap[p] = 0.25;
        this.hold[p] = 0;
      }
    }
    this.particles.update(dt);
  }

  private collect(player: number, t: Target) {
    this.scores[player] += 1;
    this.hits[player] += 1;
    sfx('sparkle');
    this.particles.burst(t.x, t.y, t.color, 12, ['heart', 'star', 'dot']);
    this.particles.ring(t.x, t.y, C.white, t.r * 0.8);
    this.targets[player] = null;
    this.gap[player] = 0.18;
    this.hold[player] = 0;

    if (this.hits[player] % 6 === 0) {
      this.levels[player] += 1;
      this.scores[player] += 2;
      sfx('chime');
    }
  }

  punch(_p: Punch) {
    /* 손을 대고 있는 시간으로만 판정한다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (let p = 0; p < this.players; p++) {
      const t = this.targets[p];
      if (!t) continue;
      const k = Math.min(1, this.hold[p] / HOLD_S);
      const pulse = 1 + Math.sin(time * 4 + p) * 0.04;
      const urgent = t.life < 0.9 ? 0.55 + 0.45 * Math.abs(Math.sin(time * 12)) : 1;

      ctx.save();
      ctx.globalAlpha = urgent;

      // 바깥 링
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(5, t.r * 0.12);
      ctx.setLineDash([t.r * 0.5, t.r * 0.35]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 안쪽 아이콘
      ctx.fillStyle = t.color;
      const ir = t.r * 0.6;
      if (t.kind === 'star') {
        starPath(ctx, t.x, t.y, ir);
        ctx.fill();
      } else {
        heartPath(ctx, t.x, t.y, ir);
        ctx.fill();
      }

      // 채워지는 진행도
      if (k > 0) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.strokeStyle = C.white;
        ctx.lineWidth = Math.max(6, t.r * 0.14);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 남은 시간 테두리
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, t.life / t.max));
      ctx.strokeStyle = 'rgba(90,74,99,0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();
    }
    this.particles.draw(ctx);
  }
}
