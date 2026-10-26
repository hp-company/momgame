import type { Punch } from '../motion/punch';
import { C, Particles, face } from './art';
import { BaseGame, type Hand } from './types';

type Hole = { x: number; y: number; r: number };

type Mole = {
  player: number;
  hole: Hole;
  up: number;
  target: number;
  wait: number;
  stay: number;
  wobble: number;
  color: string;
  seed: number;
};

const FURS = ['#e9b48f', '#f3c6a5', '#dfa583', '#f7d3b6'];

/** 🦖 땅속 친구 — 두더지가 올라오면 손으로 콕 눌러 준다. */
export class DinoGame extends BaseGame {
  moles: Mole[] = [];
  particles = new Particles();
  private hits: [number, number] = [0, 0];
  private lock: [number, number] = [0, 0];

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.build(p);
  }

  private build(player: number) {
    const { cols, rows } = this.grid();
    const f = this.field(player);
    const cw = f.w / cols;
    const ch = f.h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hole = {
          x: f.x + cw * (c + 0.5),
          y: f.y + ch * (r + 0.68),
          r: Math.min(cw, ch) * 0.25,
        };
        this.moles.push({
          player,
          hole,
          up: 0,
          target: 0,
          wait: 0.4 + Math.random() * 1.8,
          stay: 0,
          wobble: 0,
          color: FURS[Math.floor(Math.random() * FURS.length)],
          seed: Math.random() * 10,
        });
      }
    }
  }

  private grid() {
    return this.players === 2 ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 };
  }

  private upCount(player: number) {
    return this.moles.filter((m) => m.player === player && m.target === 1).length;
  }

  protected step(dt: number, hands: Hand[]) {
    this.lock = [Math.max(0, this.lock[0] - dt), Math.max(0, this.lock[1] - dt)];

    for (const m of this.moles) {
      if (m.target === 1) {
        m.stay -= dt;
        if (m.stay <= 0) m.target = 0;
      } else {
        m.wait -= dt;
        if (m.wait <= 0) {
          if (this.upCount(m.player) < 2) {
            m.target = 1;
            m.stay = Math.max(0.75, 1.3 - this.levels[m.player] * 0.08);
            m.up = Math.min(m.up, 0.05);
          } else {
            m.wait = 0.3;
          }
        }
      }
      const speed = m.target === 1 ? 7 : 8;
      m.up += (m.target - m.up) * Math.min(1, speed * dt);
      if (m.target === 0 && m.up < 0.02 && m.wait <= 0) {
        m.up = 0;
        m.wait = 0.35 + Math.random() * 1.1;
      }
      m.wobble = Math.max(0, m.wobble - dt);
    }

    for (const h of hands) this.strike(h.x, h.y, h.player);
    this.particles.update(dt);
  }

  private strike(x: number, y: number, player: number) {
    if (this.lock[player] > 0) return;
    let best: Mole | null = null;
    let bestD = Infinity;
    for (const m of this.moles) {
      if (m.player !== player || m.up < 0.45) continue;
      const cy = this.headY(m);
      const d = Math.hypot(x - m.hole.x, y - cy);
      if (d < m.hole.r * 1.25 && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return;

    best.target = 0;
    best.up = 0;
    best.stay = 0;
    best.wobble = 0.3;
    best.wait = 0.45 + Math.random() * 1.3;
    this.lock[player] = 0.22;
    this.scores[player] += 1;
    this.hits[player] += 1;

    const cx = best.hole.x;
    const cy = this.headY(best);
    this.particles.burst(cx, cy, best.color, 10, ['heart', 'star', 'dot']);
    this.particles.ring(cx, cy, C.white, best.hole.r * 0.7);

    if (this.hits[player] % 10 === 0) {
      this.levels[player] += 1;
      this.scores[player] += 2;
      for (const m of this.moles) if (m.player === player) m.wait = Math.min(m.wait, 0.9);
    }
  }

  punch(p: Punch) {
    if (this.done) return;
    this.strike(p.x, p.y, p.player);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (let p = 0; p < this.players; p++) {
      const f = this.field(p);
      const mine = this.moles.filter((m) => m.player === p);
      const { cols, rows } = this.grid();
      const cw = f.w / cols;
      const ch = f.h / rows;
      mine.forEach((m, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        m.hole = {
          x: f.x + cw * (c + 0.5),
          y: f.y + ch * (r + 0.68),
          r: Math.min(cw, ch) * 0.25,
        };
      });
    }
  }

  private headY(m: Mole) {
    return m.hole.y - m.hole.r * 1.05 * m.up;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (const m of this.moles) {
      const { hole } = m;
      const rx = hole.r * 1.35;
      const ry = hole.r * 0.6;

      // 구멍
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b08a8f';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y - ry * 0.18, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#8d6b74';
      ctx.fill();
      ctx.restore();

      if (m.up > 0.02) {
        const cy = this.headY(m);
        const bob = Math.sin(time * 5 + m.seed) * hole.r * 0.04 * m.up;
        const wob = m.wobble > 0 ? Math.sin(m.wobble * 80) * hole.r * 0.18 * (m.wobble / 0.3) : 0;

        ctx.save();
        // 땅 위로만 보이게 자른다.
        ctx.beginPath();
        ctx.rect(hole.x - rx * 2, hole.y - hole.r * 6, rx * 4, hole.r * 6);
        ctx.clip();

        const bodyR = hole.r * 0.92;
        // 손
        ctx.fillStyle = m.color;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(hole.x + s * bodyR * 0.95 + wob, cy + bodyR * 0.45 + bob, bodyR * 0.22, bodyR * 0.3, s * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // 몸통
        ctx.beginPath();
        ctx.ellipse(hole.x + wob, cy + bodyR * 0.5 + bob, bodyR * 0.95, bodyR * 1.05, 0, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 배
        ctx.beginPath();
        ctx.ellipse(hole.x + wob, cy + bodyR * 0.72 + bob, bodyR * 0.55, bodyR * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();

        // 얼굴
        face(ctx, hole.x + wob, cy + bob + bodyR * 0.05, bodyR * 0.9);

        // 새싹
        ctx.strokeStyle = '#7cbf8f';
        ctx.lineWidth = Math.max(2, bodyR * 0.09);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hole.x + wob, cy - bodyR * 0.95 + bob);
        ctx.lineTo(hole.x + wob + bodyR * 0.05, cy - bodyR * 1.25 + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hole.x + wob - bodyR * 0.1, cy - bodyR * 1.3 + bob, bodyR * 0.16, bodyR * 0.1, -0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#8ed6a2';
        ctx.fill();
        ctx.restore();

        // 앞쪽 흙 테두리
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(hole.x, hole.y - ry * 0.1, rx, ry * 0.55, 0, 0, Math.PI);
        ctx.strokeStyle = '#7f5f68';
        ctx.lineWidth = Math.max(3, hole.r * 0.12);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 점수 표시
    this.particles.draw(ctx);
  }
}
