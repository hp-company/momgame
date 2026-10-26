import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, PASTELS, Particles, face, heartPath, roundRect, starPath } from './art';
import { BaseGame, type Hand } from './types';

type Note = {
  id: number;
  player: number;
  lane: number;
  y: number;
  vy: number;
  kind: 'heart' | 'star';
  color: string;
  seed: number;
};

type Pop = { x: number; y: number; text: string; color: string; life: number };

const LANES = 3;

/** 🥁 리듬 북 — 떨어지는 표시가 북에 닿을 때 손을 빠르게 튕긴다. (자체 게임) */
export class RhythmGame extends BaseGame {
  notes: Note[] = [];
  particles = new Particles();
  pops: Pop[] = [];
  private spawnIn: [number, number] = [0.3, 0.3];
  private flash: [number, number, number][] = [];
  private hits: [number, number] = [0, 0];
  private combo: [number, number] = [0, 0];
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    this.flash = Array.from({ length: players }, () => [0, 0, 0]);
  }

  private drumY(player: number) {
    return this.field(player).y + this.field(player).h * 0.86;
  }

  private hitY(player: number) {
    return this.drumY(player) - this.field(player).h * 0.06;
  }

  private laneX(player: number, lane: number) {
    const f = this.field(player);
    return f.x + f.w * ((lane + 0.5) / LANES);
  }

  private spawn(player: number) {
    const f = this.field(player);
    const lane = Math.floor(Math.random() * LANES);
    const travel = Math.max(1.05, 1.75 - this.levels[player] * 0.07);
    const startY = f.y - 30;
    const dist = this.hitY(player) - startY;
    this.notes.push({
      id: this.seq++,
      player,
      lane,
      y: startY,
      vy: dist / travel,
      kind: Math.random() < 0.3 ? 'star' : 'heart',
      color: PASTELS[(lane + player * 2) % PASTELS.length],
      seed: Math.random() * 10,
    });
  }

  protected step(dt: number, _hands: Hand[]) {
    for (let p = 0; p < this.players; p++) {
      this.spawnIn[p] -= dt;
      if (this.spawnIn[p] <= 0) {
        this.spawn(p);
        this.spawnIn[p] = Math.max(0.44, 0.95 - this.levels[p] * 0.05) * (0.8 + Math.random() * 0.45);
      }
      for (let l = 0; l < LANES; l++) this.flash[p][l] = Math.max(0, this.flash[p][l] - dt * 3);
    }

    for (const n of this.notes) {
      n.y += n.vy * dt;
      const f = this.field(n.player);
      if (n.y > this.hitY(n.player) + f.h * 0.16) {
        n.y = Infinity;
        if (this.combo[n.player] > 0) sfx('miss');
        this.combo[n.player] = 0;
      }
    }
    this.notes = this.notes.filter((n) => n.y !== Infinity);

    for (const p of this.pops) p.life -= dt;
    this.pops = this.pops.filter((p) => p.life > 0);

    this.particles.update(dt);
  }

  punch(p: Punch) {
    if (this.done) return;
    const f = this.field(p.player);
    if (p.x < f.x || p.x > f.x + f.w) return;

    const lane = Math.min(LANES - 1, Math.max(0, Math.floor(((p.x - f.x) / f.w) * LANES)));
    const line = this.hitY(p.player);
    const perfect = f.h * 0.05;
    const good = f.h * 0.11;

    let best: Note | null = null;
    let bestD = Infinity;
    for (const n of this.notes) {
      if (n.player !== p.player || n.lane !== lane) continue;
      const d = Math.abs(n.y - line);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    if (!best) return;

    if (bestD <= perfect) {
      this.register(p.player, lane, 'PERFECT', 3, best);
    } else if (bestD <= good) {
      this.register(p.player, lane, 'GOOD', 1, best);
    } else {
      return;
    }

    best.y = Infinity;
    this.notes = this.notes.filter((n) => n.y !== Infinity);
  }

  private register(player: number, lane: number, text: string, score: number, note: Note) {
    this.scores[player] += score;
    this.combo[player] += 1;
    this.hits[player] += 1;
    this.flash[player][lane] = 1;
    sfx('drum', lane);
    if (text === 'PERFECT') sfx('perfect');

    const x = this.laneX(player, lane);
    const y = this.hitY(player);
    this.particles.burst(x, y, note.color, text === 'PERFECT' ? 12 : 7, ['star', 'heart', 'dot']);
    this.particles.ring(x, y, text === 'PERFECT' ? C.yellow : C.white, 18);
    this.pops.push({
      x,
      y: y - 40,
      text: this.combo[player] >= 3 ? `${text} x${this.combo[player]}` : text,
      color: text === 'PERFECT' ? '#e39b12' : C.inkSoft,
      life: 0.7,
    });

    if (this.hits[player] % 12 === 0) {
      this.levels[player] += 1;
      this.scores[player] += 3;
      sfx('chime');
    }
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (let p = 0; p < this.players; p++) {
      const f = this.field(p);
      const lineY = this.hitY(p);
      const drumY = this.drumY(p);

      // 레인 안내선
      ctx.save();
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      for (let l = 1; l < LANES; l++) {
        const x = f.x + (f.w / LANES) * l;
        ctx.beginPath();
        ctx.moveTo(x, f.y + 10);
        ctx.lineTo(x, lineY);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 판정선
      const band = f.h * 0.028;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      roundRect(ctx, f.x, lineY - band, f.w, band * 2, band);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(f.x, lineY);
      ctx.lineTo(f.x + f.w, lineY);
      ctx.stroke();
      ctx.restore();

      // 노트
      const ns = Math.max(20, Math.min(32, (f.w / LANES) * 0.24));
      for (const n of this.notes) {
        if (n.player !== p) continue;
        const x = this.laneX(p, n.lane);
        const near = Math.abs(n.y - lineY) < f.h * 0.055;
        ctx.save();
        ctx.translate(x, n.y);
        ctx.rotate(Math.sin(time * 3 + n.seed) * 0.1);
        if (near) {
          ctx.beginPath();
          ctx.arc(0, 0, ns * 1.7, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.globalAlpha = 0.28;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(0, 0, ns * 1.45, 0, Math.PI * 2);
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.fillStyle = n.color;
        if (n.kind === 'star') {
          starPath(ctx, 0, 0, ns);
          ctx.fill();
        } else {
          heartPath(ctx, 0, 0, ns * 0.94);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(90,74,99,0.65)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // 북 3개
      const laneW = f.w / LANES;
      const drumW = laneW * 0.78;
      const drumH = Math.max(40, Math.min(92, f.h * 0.12));
      for (let l = 0; l < LANES; l++) {
        const x = this.laneX(p, l);
        const fl = this.flash[p][l];
        const scale = 1 + fl * 0.07 + Math.sin(time * 3 + l) * 0.01;

        ctx.save();
        ctx.translate(x, drumY);
        ctx.scale(scale, scale);

        // 다리
        ctx.strokeStyle = '#c9a97a';
        ctx.lineWidth = 6;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * drumW * 0.32, drumH * 0.2);
          ctx.lineTo(s * drumW * 0.42, drumH * 0.75);
          ctx.stroke();
        }

        // 몸통
        roundRect(ctx, -drumW / 2, -drumH / 2, drumW, drumH, drumH * 0.3);
        ctx.fillStyle = PASTELS[(l + p) % PASTELS.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 윗면
        ctx.beginPath();
        ctx.ellipse(0, -drumH * 0.32, drumW * 0.47, drumH * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,99,0.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        face(ctx, 0, drumH * 0.1, drumW * 0.24);

        // 타격 반짝임
        if (fl > 0) {
          ctx.globalAlpha = fl;
          ctx.strokeStyle = C.white;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, -drumH * 0.32, drumW * 0.55 + (1 - fl) * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }

    // 판정 글자
    for (const p of this.pops) {
      const k = p.life / 0.7;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = `700 ${Math.max(18, Math.min(30, this.w * 0.022))}px Jua, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - (1 - k) * 26);
      ctx.restore();
    }

    this.particles.draw(ctx);
  }
}
