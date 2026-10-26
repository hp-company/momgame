import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, face, starPath } from './art';
import { BaseGame, type Hand } from './types';

type Star = {
  id: number;
  player: number;
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  hold: number;
  color: string;
  phase: number;
};

/** ⭐ 별 따기 — 손을 별 위에 잠깐 머물게 하면 모인다. */
export class StarGame extends BaseGame {
  stars: Star[] = [];
  particles = new Particles();
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) {
      const n = players === 2 ? 3 : 4;
      for (let i = 0; i < n; i++) this.stars.push(this.make(p));
    }
  }

  private make(player: number): Star {
    const f = this.field(player);
    const r = Math.max(24, Math.min(f.w, f.h) * (this.players === 2 ? 0.1 : 0.075));
    const margin = r * 1.6;
    return {
      id: this.seq++,
      player,
      x: f.x + margin + Math.random() * Math.max(1, f.w - margin * 2),
      y: f.y + margin + Math.random() * Math.max(1, f.h - margin * 2),
      r,
      life: 4.5,
      max: 4.5,
      hold: 0,
      color: PASTELS[Math.floor(Math.random() * PASTELS.length)],
      phase: Math.random() * Math.PI * 2,
    };
  }

  private respawn(s: Star) {
    Object.assign(s, this.make(s.player), { id: s.id, player: s.player });
  }

  protected step(dt: number, hands: Hand[]) {
    for (const s of this.stars) {
      s.life -= dt;
      s.phase += dt * 2;
      if (s.life <= 0) {
        this.respawn(s);
        continue;
      }
      const touching = hands.some((h) => h.player === s.player && Math.hypot(h.x - s.x, h.y - s.y) < s.r * 1.1);
      if (touching) {
        s.hold += dt;
        if (s.hold >= 0.35) {
          this.scores[s.player] += 1;
          sfx('sparkle');
          this.particles.burst(s.x, s.y, s.color, 10, ['star', 'heart', 'dot']);
          this.particles.ring(s.x, s.y, C.white, s.r * 0.6);
          this.respawn(s);
          continue;
        }
      } else {
        s.hold = Math.max(0, s.hold - dt * 2);
      }
    }
    this.particles.update(dt);
  }

  punch(_p: Punch) {
    /* 접촉 유지 판정만 사용한다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (const s of this.stars) {
      const bob = Math.sin(time * 2 + s.phase) * s.r * 0.12;
      const y = s.y + bob;
      const fade = Math.min(1, s.life / 0.6);

      ctx.save();
      ctx.globalAlpha = fade;

      // 은은한 후광
      ctx.beginPath();
      ctx.arc(s.x, y, s.r * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();

      starPath(ctx, s.x, y, s.r);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      starPath(ctx, s.x, y, s.r);
      ctx.save();
      ctx.clip();
      face(ctx, s.x, y + s.r * 0.06, s.r * 0.62);
      ctx.restore();

      // 모으는 진행 링
      if (s.hold > 0) {
        ctx.beginPath();
        ctx.arc(s.x, y, s.r * 1.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.hold / 0.35));
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 반짝임
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + s.phase));
      ctx.globalAlpha = fade * tw;
      ctx.fillStyle = C.white;
      starPath(ctx, s.x + s.r * 0.85, y - s.r * 0.7, s.r * 0.16, 4);
      ctx.fill();
      ctx.restore();
    }
    this.particles.draw(ctx);
  }
}
