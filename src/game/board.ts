export type Rect = { x: number; y: number; w: number; h: number };

/**
 * n개의 사각형을 주어진 영역 안에 최대 크기로 배치한다.
 * 정사각형을 유지한 채 rows x cols 격자를 고르고, 가운데 정렬한다.
 */
export function layoutBlocks(n: number, area: Rect): Rect[] {
  if (n <= 0) return [];
  const gap = area.w * 0.02;
  let best = { rows: 1, cols: n, side: 0 };

  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows);
    const side = Math.min(
      area.h * 0.42,
      (area.w * 0.94 - (cols - 1) * gap) / cols,
      (area.h - (rows - 1) * gap) / rows,
    );
    if (side > best.side) best = { rows, cols, side };
  }

  const { rows, cols, side } = best;
  const totalH = rows * side + (rows - 1) * gap;
  const y0 = area.y + (area.h - totalH) / 2;
  const out: Rect[] = [];

  for (let r = 0; r < rows; r++) {
    const count = Math.min(cols, n - r * cols);
    if (count <= 0) break;
    const rowW = count * side + (count - 1) * gap;
    const x0 = area.x + (area.w - rowW) / 2;
    for (let c = 0; c < count; c++) {
      out.push({ x: x0 + c * (side + gap), y: y0 + r * (side + gap), w: side, h: side });
    }
  }
  return out;
}
