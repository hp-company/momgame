import type { Pose } from './pose';
import { LM, toScreen, type Cover } from './viewport';

export const HAND_L = LM.lWrist;
export const HAND_R = LM.rWrist;
export type HandIndex = typeof HAND_L | typeof HAND_R;

export type HandSample = { hand: HandIndex; x: number; y: number; player: number };
export type Punch = { hand: HandIndex; x: number; y: number; player: number; speed: number };

/** 양어깨 사이 거리(px). 화면상 몸 크기를 재는 기준값. */
export function shoulderSpan(pose: Pose, cover: Cover): number | null {
  const a = pose[LM.lShoulder];
  const b = pose[LM.rShoulder];
  if (!a || !b) return null;
  if ((a.visibility ?? 1) < 0.5 || (b.visibility ?? 1) < 0.5) return null;
  return Math.hypot((a.x - b.x) * cover.dw, (a.y - b.y) * cover.dh);
}

/**
 * 어깨 폭을 지수평활(EMA)하고 화면 높이 대비 8~50%로 제한한다.
 * 펀치 임계값이 "몸 크기"에 비례하도록 만드는 장치.
 */
export class BodyScale {
  private value: number | null = null;
  constructor(
    private readonly alpha = 0.3,
    private readonly minRatio = 0.08,
    private readonly maxRatio = 0.5,
  ) {}

  update(raw: number | null, viewHeight: number): number | null {
    if (raw !== null) {
      this.value = this.value === null ? raw : this.value + (raw - this.value) * this.alpha;
    }
    if (this.value === null) return null;
    this.value = Math.min(this.maxRatio * viewHeight, Math.max(this.minRatio * viewHeight, this.value));
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }
}

/**
 * 손목 속도 기반 펀치 판정기.
 * - 속도는 어깨 폭으로 정규화한다(거리에 무관).
 * - 같은 손은 minGapS 안에 다시 판정하지 않는다(연타 방지).
 * - 프레임 간격이 staleS보다 크면(끊김) 속도를 0으로 본다.
 */
export class PunchTracker {
  private t = 0;
  private prev = new Map<string, { x: number; y: number; t: number }>();
  private last = new Map<string, number>();

  constructor(
    readonly speed = 0.6,
    readonly minGapS = 0.35,
    readonly staleS = 0.3,
  ) {}

  reset() {
    this.t = 0;
    this.prev.clear();
    this.last.clear();
  }

  step(dt: number, hands: HandSample[], spans: (number | null)[]): Punch[] {
    this.t += dt;
    const out: Punch[] = [];

    const seen = new Set<string>();
    for (const h of hands) {
      const key = `${h.player}:${h.hand}`;
      seen.add(key);
      // 몸이 아직 안 보이면 그 플레이어는 판정하지 않는다.
      const threshold = (spans[h.player] ?? 0) * this.speed;
      if (threshold <= 0) continue;
      const p = this.prev.get(key);
      if (!p) {
        this.prev.set(key, { x: h.x, y: h.y, t: this.t });
        continue;
      }
      const span = this.t - p.t;
      let v = 0;
      if (span > 0 && span <= this.staleS) {
        v = Math.hypot(h.x - p.x, h.y - p.y) / span;
      }
      this.prev.set(key, { x: h.x, y: h.y, t: this.t });

      if (v < threshold) continue;
      const lastHit = this.last.get(key) ?? -Infinity;
      if (this.t - lastHit < this.minGapS) continue;
      this.last.set(key, this.t);
      out.push({ hand: h.hand, x: h.x, y: h.y, player: h.player, speed: v });
    }

    for (const key of [...this.prev.keys()]) if (!seen.has(key)) this.prev.delete(key);
    return out;
  }
}

/** 검출된 포즈들을 화면 좌표계의 손목 샘플로 바꾼다. */
export function collectHands(
  poses: Pose[],
  playerOfPose: number[],
  cover: Cover,
): HandSample[] {
  const hands: HandSample[] = [];
  poses.forEach((pose, i) => {
    const player = playerOfPose[i] ?? 0;
    for (const idx of [HAND_L, HAND_R] as HandIndex[]) {
      const lm = pose[idx];
      if (!lm) continue;
      if ((lm.visibility ?? 1) < 0.4) continue;
      const p = toScreen(lm.x, lm.y, cover);
      hands.push({ hand: idx, x: p.x, y: p.y, player });
    }
  });
  return hands;
}

/** 각 포즈가 화면 어느 쪽(플레이어)에 서 있는지 어깨 중앙으로 판정한다. */
export function assignPlayers(poses: Pose[], cover: Cover, players: number, width: number): number[] {
  if (players < 2) return poses.map(() => 0);
  return poses.map((pose) => {
    const a = pose[LM.lShoulder];
    const b = pose[LM.rShoulder];
    const cx = a && b ? toScreen((a.x + b.x) / 2, (a.y + b.y) / 2, cover).x : width / 2;
    return cx < width / 2 ? 0 : 1;
  });
}
