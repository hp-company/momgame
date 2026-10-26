/** MediaPipe pose landmark indices we rely on (Pose Landmarker 33-point model). */
export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
} as const;

export type Cover = { dx: number; dy: number; dw: number; dh: number };

/** object-fit: cover 배치를 계산한다. */
export function coverRect(vw: number, vh: number, cw: number, ch: number): Cover {
  if (!vw || !vh) return { dx: 0, dy: 0, dw: cw, dh: ch };
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };
}

/**
 * 정규화 랜드마크 → 화면 좌표.
 * 거울 모드이므로 x를 반전한다. (MediaPipe는 원본 영상 기준)
 */
export function toScreen(x: number, y: number, c: Cover): { x: number; y: number } {
  return { x: c.dx + (1 - x) * c.dw, y: c.dy + y * c.dh };
}
