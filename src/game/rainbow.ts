import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, Particles, face } from './art';
import { BaseGame, type Hand } from './types';

type Cloud = { x: number; y: number; r: number };

const RAINBOW = ['#ff8fb1', '#ffb36b', '#ffe066', '#8fd694', '#7fc4ff', '#b39dff'];

type Round = {
  a: Cloud;
  b: Cloud;
  life: number;
  max: number;
  hold: number;
};

/** 🌈 무지개 잇기 — 두 손을 양쪽 구름에 올려 무지개를 만든다. (자체 게임) */
export class RainbowGame extends BaseGame {
  readonly handCount: 1 | 2 = 2;
  rounds: (Round | null)[] = [];
  particles = new Particles();
  private gap: [number, number] = [0.25, 0.25];
  private made: [number, number] = [0, 0];

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.rounds.push(this.makeRound(p));
  }

  private holdTime(player: number) {
    return Math.max(0.34, 0.6 - this.levels[player] * 0.02);
  }

  private makeRound(player: number): Round {
    const f = this.field(player);
    // 2인은 진영이 좁으니 구름을 조금 작게 해서 서로 겹치지 않게 한다.
    const scale = this.players === 2 ? 0.085 : 0.105;
    const r = Math.max(38, Math.min(86, Math.min(f.w, f.h) * scale));
    const y = f.y + f.h * (0.34 + Math.random() * 0.34);
    const extra = this.levels[player] > 3 ? (Math.random() - 0.5) * f.h * 0.22 : 0;
    const life = 6;
    // 구름 중심을 진영 안쪽으로 붙여 무지개가 양쪽 끝까지 이어지게 한다.
    const inset = r * 1.35;
    return {
      a: { x: f.x + inset, y, r },
      b: { x: f.x + f.w - inset, y: y + extra, r },
      life,
      max: life,
      hold: 0,
    };
  }

  protected step(dt: number, hands: Hand[]) {
    for (let p = 0; p < this.players; p++) {
      const round = this.rounds[p];
      if (!round) {
        this.gap[p] = Math.max(0, this.gap[p] - dt);
        if (this.gap[p] <= 0) this.rounds[p] = this.makeRound(p);
        continue;
      }

      round.life -= dt;
      const mine = hands.filter((h) => h.player === p);
      let left: Hand | undefined;
      let right: Hand | undefined;
      for (const h of mine) {
        if (Math.hypot(h.x - round.a.x, h.y - round.a.y) < round.a.r * 1.15) {
          left = h;
          break;
        }
      }
      for (const h of mine) {
        if (h === left) continue;
        if (Math.hypot(h.x - round.b.x, h.y - round.b.y) < round.b.r * 1.15) {
          right = h;
          break;
        }
      }

      if (left && right) {
        round.hold += dt;
        if (round.hold >= this.holdTime(p)) {
          this.finish(p, round);
          continue;
        }
      } else {
        round.hold = Math.max(0, round.hold - dt * 1.8);
      }

      if (round.life <= 0) {
        this.rounds[p] = null;
        this.gap[p] = 0.3;
      }
    }
    this.particles.update(dt);
  }

  private finish(player: number, round: Round) {
    this.scores[player] += 1;
    this.made[player] += 1;
    sfx('rainbow');
    const mx = (round.a.x + round.b.x) / 2;
    const my = (round.a.y + round.b.y) / 2 - Math.abs(round.b.x - round.a.x) * 0.22;
    this.particles.burst(mx, my, C.pink, 14, ['heart', 'star', 'dot']);
    this.particles.burst(mx, my, C.yellow, 10, ['star', 'heart']);
    this.particles.ring(mx, my, C.white, 26);
    this.rounds[player] = null;
    this.gap[player] = 0.3;

    if (this.made[player] % 5 === 0) {
      this.levels[player] += 1;
      this.scores[player] += 2;
      sfx('chime');
    }
  }

  punch(_p: Punch) {
    /* 두 손을 구름에 올려 두는 것으로만 판정한다 */
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private drawCloud(ctx: CanvasRenderingContext2D, c: Cloud, tint: string, time: number, seed: number, alpha: number) {
    const bob = Math.sin(time * 1.6 + seed) * c.r * 0.05;
    const x = c.x;
    const y = c.y + bob;
    const r = c.r;

    const puffs = [
      { x: 0, y: 0, r: r * 0.9 },
      { x: r * 0.62, y: r * 0.1, r: r * 0.66 },
      { x: -r * 0.6, y: r * 0.12, r: r * 0.6 },
      { x: r * 0.05, y: -r * 0.5, r: r * 0.62 },
    ];

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // 바깥 테두리 역할: 살짝 큰 원을 먼저 깔고 흰 원으로 덮는다.
    // (원마다 stroke를 그리면 안쪽에 선이 보여서 지저분해진다.)
    ctx.fillStyle = 'rgba(90,74,99,0.22)';
    for (const pf of puffs) {
      ctx.beginPath();
      ctx.arc(pf.x, pf.y + 3, pf.r * 1.04, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#fffdfa';
    for (const pf of puffs) {
      ctx.beginPath();
      ctx.arc(pf.x, pf.y, pf.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 아래쪽 은은한 색
    ctx.beginPath();
    ctx.ellipse(0, r * 0.55, r * 0.95, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = tint;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fill();
    ctx.globalAlpha = alpha;

    face(ctx, 0, r * 0.02, r * 0.55);
    ctx.restore();
  }

  private strokeRainbow(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, r: number) {
    const lift = Math.abs(bx - ax) * 0.34;
    const bw = Math.max(6, r * 0.1);
    ctx.lineCap = 'round';
    for (let i = 0; i < RAINBOW.length; i++) {
      const off = i * bw * 1.02;
      ctx.beginPath();
      ctx.moveTo(ax, ay - off);
      ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - lift - off, bx, by - off);
      ctx.strokeStyle = RAINBOW[i];
      ctx.lineWidth = bw;
      ctx.stroke();
    }
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (let p = 0; p < this.players; p++) {
      const round = this.rounds[p];
      if (!round) continue;
      const prog = Math.min(1, round.hold / this.holdTime(p));

      const ax = round.a.x;
      const ay = round.a.y;
      const bx = round.b.x;
      const by = round.b.y;
      const lift = Math.abs(bx - ax) * 0.34;
      const bw = Math.max(6, round.a.r * 0.1);

      // 아직 안 이어진 무지개는 흐리게, 이어지는 만큼 왼쪽부터 진하게.
      ctx.save();
      ctx.globalAlpha = 0.2;
      this.strokeRainbow(ctx, ax, ay, bx, by, round.a.r);
      ctx.restore();

      if (prog > 0) {
        ctx.save();
        const left = Math.min(ax, bx) - bw * 2;
        const right = ax + (bx - ax) * prog + bw;
        const top = Math.min(ay, by) - lift - bw * 8;
        const bottom = Math.max(ay, by) + bw * 8;
        ctx.beginPath();
        ctx.rect(left, top, Math.max(0, right - left), bottom - top);
        ctx.clip();
        this.strokeRainbow(ctx, ax, ay, bx, by, round.a.r);
        ctx.restore();

        // 이어지는 끝에 반짝이 (2차 곡선 위의 실제 지점)
        const t = prog;
        const cxp = (ax + bx) / 2;
        const cyp = Math.min(ay, by) - lift;
        const tipX = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cxp + t * t * bx;
        const tipY = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cyp + t * t * by;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = C.white;
        ctx.beginPath();
        ctx.arc(tipX, tipY - bw * 2.5, 5 + Math.sin(time * 12) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 구름 (수명이 얼마 안 남으면 깜빡)
      const urgent = round.life < 1.3 ? 0.55 + 0.45 * Math.abs(Math.sin(time * 10)) : 1;
      this.drawCloud(ctx, round.a, C.sky, time, 1 + p, urgent);
      this.drawCloud(ctx, round.b, C.lavender, time, 4 + p, urgent);

      // 손을 올릴 자리 표시
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = 'rgba(90,74,99,0.3)';
      ctx.lineWidth = 3;
      for (const c of [round.a, round.b]) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 1.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 두 손을 올린 동안 차오르는 링
      if (prog > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (const c of [round.a, round.b]) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 1.38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    this.particles.draw(ctx);
  }
}
