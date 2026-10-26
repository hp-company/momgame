import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, face, roundRect } from './art';
import { layoutBlocks, type Rect } from './board';
import { BaseGame, type Hand } from './types';

export const HITS_TO_BREAK = 5;

export type Block = Rect & {
  id: number;
  player: number;
  damage: number;
  broken: boolean;
  wobble: number;
  seed: number;
  color: string;
};

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** 🧊 얼음 깨기 — 손목 속도로 얼음을 두드린다. */
export class IceGame extends BaseGame {
  blocks: Block[] = [];
  particles = new Particles();
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.spawn(p);
  }

  private count() {
    return this.players === 2 ? 6 : 10;
  }

  private spawn(player: number) {
    const rects = layoutBlocks(this.count(), this.field(player));
    for (const r of rects) {
      this.blocks.push({
        ...r,
        id: this.seq++,
        player,
        damage: 0,
        broken: false,
        wobble: 0,
        seed: this.seq * 1.7,
        color: PASTELS[(this.seq + player) % PASTELS.length],
      });
    }
  }

  private remaining(player: number) {
    return this.blocks.filter((b) => b.player === player && !b.broken).length;
  }

  /** 깨진 얼음이 생기면 남은 얼음을 다시 정렬한다. */
  private relayout(player: number) {
    const alive = this.blocks.filter((b) => b.player === player && !b.broken);
    const rects = layoutBlocks(alive.length, this.field(player));
    alive.forEach((b, i) => {
      if (rects[i]) Object.assign(b, rects[i]);
    });
  }

  protected step(dt: number, _hands: Hand[]) {
    for (const b of this.blocks) b.wobble = Math.max(0, b.wobble - dt);
    this.particles.update(dt);
  }

  punch(p: Punch) {
    if (this.done) return;
    const target = this.blocks.find(
      (b) =>
        !b.broken &&
        b.player === p.player &&
        p.x >= b.x &&
        p.x <= b.x + b.w &&
        p.y >= b.y &&
        p.y <= b.y + b.h,
    );
    if (!target) return;

    target.damage += 1;
    target.wobble = 0.25;
    sfx('punch');

    if (target.damage >= HITS_TO_BREAK) {
      target.broken = true;
      this.scores[target.player] += 1;
      sfx('smash');
      this.particles.burst(target.x + target.w / 2, target.y + target.h / 2, target.color, 14, ['heart', 'star', 'dot']);
      this.particles.ring(target.x + target.w / 2, target.y + target.h / 2, C.white, target.w * 0.3);
      this.relayout(target.player);
      if (this.remaining(target.player) === 0) {
        this.levels[target.player] += 1;
        this.scores[target.player] += 3;
        sfx('chime');
        this.blocks = this.blocks.filter((b) => b.player !== target.player);
        this.spawn(target.player);
      }
    } else {
      this.particles.burst(p.x, p.y, target.color, 4, ['dot', 'heart']);
      this.particles.ring(p.x, p.y, C.white, 10);
    }
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (let p = 0; p < this.players; p++) this.relayout(p);
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, _time: number) {
    for (const b of this.blocks) {
      if (b.broken) continue;
      const wob = b.wobble > 0 ? Math.sin(b.wobble * 90) * 9 * (b.wobble / 0.25) : 0;
      const cx = b.x + b.w / 2 + wob;
      const cy = b.y + b.h / 2;

      ctx.save();
      ctx.translate(cx, cy);

      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, b.w * 0.24);
      ctx.fillStyle = b.color;
      ctx.fill();

      // 유리 느낌 하이라이트
      ctx.globalAlpha = 0.65;
      roundRect(ctx, -b.w * 0.36, -b.h * 0.4, b.w * 0.72, b.h * 0.34, b.w * 0.16);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 귀여운 얼굴
      face(ctx, 0, b.h * 0.06, b.w * 0.42, {
        mood: b.damage >= 3 ? 'surprised' : 'happy',
      });

      // 균열
      if (b.damage > 0) {
        ctx.strokeStyle = 'rgba(90,74,99,0.55)';
        ctx.lineWidth = Math.max(2, b.w * 0.03);
        ctx.lineCap = 'round';
        for (let i = 0; i < Math.min(b.damage, HITS_TO_BREAK - 1); i++) {
          const a = rand(b.seed + i) * Math.PI * 2;
          const len = b.w * (0.22 + rand(b.seed + i * 3) * 0.26);
          const sx = Math.cos(a) * b.w * 0.1;
          const sy = Math.sin(a) * b.h * 0.1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
          ctx.stroke();
        }
      }

      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, b.w * 0.24);
      ctx.strokeStyle = 'rgba(90,74,99,0.75)';
      ctx.lineWidth = Math.max(2.5, b.w * 0.035);
      ctx.stroke();
      ctx.restore();
    }
    this.particles.draw(ctx);
  }
}
