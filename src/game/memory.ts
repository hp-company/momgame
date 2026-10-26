import { sfx } from '../audio/sfx';
import type { Punch } from '../motion/punch';
import { C, Particles, heartPath, roundRect } from './art';
import { layoutBlocks, type Rect } from './board';
import { BaseGame, type Hand } from './types';

type Card = Rect & {
  id: number;
  player: number;
  symbol: string;
  faceUp: boolean;
  matched: boolean;
  pop: number;
  back: string;
};

const POOL = ['🍓', '🌙', '🐰', '🍰', '🌈', '🐳', '🌸', '🍋', '🐤', '🍑', '⭐', '🍬'];
const BACKS = [C.pink, C.lavender, C.sky, C.mint];

function shuffle<T>(list: T[]) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 🃏 짝 맞추기 — 카드를 콕 찍어 같은 그림 두 장을 찾는다. */
export class MemoryGame extends BaseGame {
  cards: Card[] = [];
  particles = new Particles();
  private open: [number[], number[]] = [[], []];
  private wrong: [number, number] = [0, 0];
  private lock: [number, number] = [0, 0];
  private lastPoint: ({ x: number; y: number } | null)[] = [null, null];
  private seq = 1;

  constructor(players: 1 | 2, w: number, h: number) {
    super(players, w, h);
    for (let p = 0; p < players; p++) this.deal(p);
  }

  private deal(player: number) {
    const pairs = 3;
    const symbols = shuffle(POOL).slice(0, pairs);
    const deck = shuffle([...symbols, ...symbols]);
    const rects = layoutBlocks(deck.length, this.field(player));
    rects.forEach((r, i) => {
      this.cards.push({
        ...r,
        id: this.seq++,
        player,
        symbol: deck[i],
        faceUp: false,
        matched: false,
        pop: 0,
        back: BACKS[(i + player) % BACKS.length],
      });
    });
    this.open[player] = [];
    this.wrong[player] = 0;
  }

  private mine(player: number) {
    return this.cards.filter((c) => c.player === player);
  }

  private relayout(player: number) {
    const rects = layoutBlocks(6, this.field(player));
    this.mine(player).forEach((c, i) => {
      if (rects[i]) Object.assign(c, rects[i]);
    });
  }

  protected step(dt: number, hands: Hand[]) {
    for (const c of this.cards) c.pop = Math.max(0, c.pop - dt);
    this.particles.update(dt);

    for (let p = 0; p < this.players; p++) {
      this.lock[p] = Math.max(0, this.lock[p] - dt);

      if (this.wrong[p] > 0) {
        this.wrong[p] -= dt;
        if (this.wrong[p] <= 0) {
          for (const id of this.open[p]) {
            const c = this.cards.find((x) => x.id === id);
            if (c) c.faceUp = false;
          }
          this.open[p] = [];
          this.lock[p] = 0.2;
        }
      }

      const mine = this.mine(p);
      if (mine.length > 0 && mine.every((c) => c.matched)) {
        this.levels[p] += 1;
        this.scores[p] += 3;
        sfx('chime');
        this.cards = this.cards.filter((c) => c.player !== p);
        this.deal(p);
        continue;
      }

      for (const h of hands) {
        if (h.player !== p) continue;
        this.touch(h.x, h.y, p);
      }
    }
  }

  private touch(x: number, y: number, player: number) {
    if (this.lock[player] > 0 || this.wrong[player] > 0) return;

    // 손을 거의 안 움직이면 같은 자리에서 계속 뒤집히지 않게 한다.
    const last = this.lastPoint[player];
    const minMove = this.field(player).w * 0.14;
    if (last && Math.hypot(x - last.x, y - last.y) < minMove) return;

    const card = this.mine(player).find(
      (c) =>
        !c.matched &&
        !c.faceUp &&
        x >= c.x - c.w * 0.04 &&
        x <= c.x + c.w * 1.04 &&
        y >= c.y - c.h * 0.04 &&
        y <= c.y + c.h * 1.04,
    );
    if (!card) {
      // 카드 밖으로 나가면 다시 찍을 수 있다.
      this.lastPoint[player] = null;
      return;
    }

    this.lastPoint[player] = { x, y };
    card.faceUp = true;
    card.pop = 0.28;
    sfx('tap');
    this.lock[player] = 0.32;
    this.open[player].push(card.id);

    if (this.open[player].length < 2) return;

    const [a, b] = this.open[player].map((id) => this.cards.find((c) => c.id === id)!);
    if (a && b && a.symbol === b.symbol) {
      a.matched = true;
      b.matched = true;
      a.pop = 0.4;
      b.pop = 0.4;
      this.scores[player] += 1;
      sfx('sparkle');
      this.particles.burst(a.x + a.w / 2, a.y + a.h / 2, C.pinkDeep, 12, ['heart', 'star', 'dot']);
      this.particles.burst(b.x + b.w / 2, b.y + b.h / 2, C.yellow, 12, ['heart', 'star', 'dot']);
      this.particles.ring(a.x + a.w / 2, a.y + a.h / 2, C.white, a.w * 0.35);
      this.open[player] = [];
    } else {
      this.wrong[player] = 0.7;
      sfx('buzz');
    }
  }

  punch(p: Punch) {
    if (this.done) return;
    this.touch(p.x, p.y, p.player);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (let p = 0; p < this.players; p++) this.relayout(p);
  }

  render(ctx: CanvasRenderingContext2D, _w: number, _h: number, time: number) {
    for (const c of this.cards) {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const pop = 1 + Math.sin(Math.min(1, c.pop / 0.3) * Math.PI) * 0.06;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pop, pop);
      roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, c.w * 0.2);
      ctx.fillStyle = c.faceUp || c.matched ? '#fffdfa' : c.back;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,74,99,0.8)';
      ctx.lineWidth = Math.max(2.5, c.w * 0.035);
      ctx.stroke();

      if (c.faceUp || c.matched) {
        ctx.font = `${Math.round(c.w * 0.5)}px 'Segoe UI Emoji', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(90,74,99,0.9)';
        ctx.fillText(c.symbol, 0, c.h * 0.03);
        if (c.matched) {
          const tw = 0.5 + 0.5 * Math.sin(time * 4 + c.id);
          ctx.globalAlpha = 0.35 + tw * 0.3;
          ctx.strokeStyle = C.yellow;
          ctx.lineWidth = Math.max(4, c.w * 0.05);
          roundRect(ctx, -c.w / 2 + 3, -c.h / 2 + 3, c.w - 6, c.h - 6, c.w * 0.17);
          ctx.stroke();
        }
      } else {
        // 카드 뒷면: 하트 패턴
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 3; i++) {
          heartPath(ctx, 0, -c.h * 0.2 + i * c.h * 0.2, c.w * (0.1 + i * 0.02));
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    this.particles.draw(ctx);
  }
}
