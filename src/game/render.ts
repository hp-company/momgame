import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Pose } from '../motion/pose';
import { toScreen, type Cover } from '../motion/viewport';
import { C, drawBackdrop, roundRect } from './art';
import type { Hand, MiniGame } from './types';

export const PLAYER_COLORS = [C.pinkDeep, C.lavender];

export function drawVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cover: Cover, w: number, h: number) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  try {
    ctx.drawImage(video, cover.dx, cover.dy, cover.dw, cover.dh);
  } catch {
    /* 첫 프레임 전 */
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 238, 246, 0.30)';
  ctx.fillRect(0, 0, w, h);
}

function drawSkeleton(ctx: CanvasRenderingContext2D, poses: Pose[], playerOfPose: number[], cover: Cover) {
  poses.forEach((pose, i) => {
    const color = PLAYER_COLORS[(playerOfPose[i] ?? 0) % PLAYER_COLORS.length];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    for (const c of PoseLandmarker.POSE_CONNECTIONS) {
      const la = pose[c.start];
      const lb = pose[c.end];
      if (!la || !lb) continue;
      if ((la.visibility ?? 1) < 0.5 || (lb.visibility ?? 1) < 0.5) continue;
      const pa = toScreen(la.x, la.y, cover);
      const pb = toScreen(lb.x, lb.y, cover);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawHands(ctx: CanvasRenderingContext2D, hands: Hand[], time: number) {
  for (const h of hands) {
    const color = PLAYER_COLORS[h.player % PLAYER_COLORS.length];
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(h.x - 4, h.y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = C.white) {
  ctx.save();
  ctx.font = `700 ${size}px Jua, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + size * 1.5;
  const hh = size * 1.85;
  ctx.shadowColor = 'rgba(90,74,99,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, x - w / 2, y - hh / 2, w, hh, hh / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, game: MiniGame, players: number, w: number, h: number) {
  const size = Math.max(19, Math.min(36, w * 0.028));
  const top = h * (players === 2 ? 0.135 : 0.115);
  pill(ctx, `⏱ ${Math.ceil(game.timeLeft)}`, w / 2, top, size);

  if (players === 2) {
    pill(ctx, `P1 ${game.scores[0]}`, w * 0.15, top, size * 0.85, C.pink);
    pill(ctx, `P2 ${game.scores[1]}`, w * 0.85, top, size * 0.85, C.lavender);
  } else {
    pill(ctx, `💗 ${game.scores[0]}   Lv.${game.levels[0]}`, w / 2, top + h * 0.075, size * 0.82);
  }
}

export function drawScene(args: {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement | null;
  cover: Cover;
  w: number;
  h: number;
  game: MiniGame;
  poses: Pose[];
  playerOfPose: number[];
  hands: Hand[];
  time: number;
}) {
  const { ctx, video, cover, w, h, game, poses, playerOfPose, hands, time } = args;
  ctx.clearRect(0, 0, w, h);

  if (video && video.readyState >= 2) {
    drawVideo(ctx, video, cover, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ffe6f2');
    g.addColorStop(0.5, '#efe7ff');
    g.addColorStop(1, '#e3f7ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawBackdrop(ctx, w, h, time);
  game.render(ctx, w, h, time);
  drawSkeleton(ctx, poses, playerOfPose, cover);
  drawHands(ctx, hands, time);
  drawHud(ctx, game, game.players, w, h);
}
