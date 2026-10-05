import type { Domain } from '../types';

export const FRAME_W = 380;
export const FRAME_GAP = 72;
export const ROOT_W = 300;
/** Vertical distance from the root card's bottom edge to the domain row. */
export const ROOT_GAP = 120;
export const ROOT_H = 96;

export interface Pos {
  x: number;
  y: number;
}

/**
 * Domains with a saved (x, y) stay where someone put them. The rest are
 * laid out left-to-right after the right-most placed frame, so a newly added
 * client never lands on top of an existing one.
 */
export function layoutDomains(domains: Domain[], drafts: Record<string, Pos>): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  let cursorX = 0;
  let rowY = 0;
  // Saved positions only — a frame being dragged must not reflow the others.
  const placed = domains.filter((d) => d.x != null && d.y != null);
  if (placed.length) {
    const pts = placed.map((d) => ({ x: d.x!, y: d.y! }));
    cursorX = Math.max(...pts.map((p) => p.x)) + FRAME_W + FRAME_GAP;
    rowY = Math.min(...pts.map((p) => p.y));
  }
  for (const d of domains) {
    if (drafts[d.id]) out[d.id] = drafts[d.id];
    else if (d.x != null && d.y != null) out[d.id] = { x: d.x, y: d.y };
    else {
      out[d.id] = { x: cursorX, y: rowY };
      cursorX += FRAME_W + FRAME_GAP;
    }
  }
  return out;
}

/**
 * A frame dropped onto another takes that column's slot (or the one after it,
 * if dropped on its right half), lines up with its top, and everything it now
 * overlaps shifts right. Frames never move left, so a hole the dragged frame
 * left behind simply absorbs the shift. `heights` are measured frame heights.
 */
export function resolveDrop(pos: Record<string, Pos>, heights: Record<string, number>, movedId: string) {
  const STEP = FRAME_W + FRAME_GAP;
  const out = { ...pos };
  const hits = (a: string, b: string) =>
    Math.abs(out[a].x - out[b].x) < STEP &&
    out[a].y < out[b].y + (heights[b] ?? 0) + FRAME_GAP &&
    out[b].y < out[a].y + (heights[a] ?? 0) + FRAME_GAP;

  const others = Object.keys(out).filter((id) => id !== movedId);
  const target = others
    .filter((id) => hits(movedId, id))
    .sort((a, b) => Math.abs(out[a].x - out[movedId].x) - Math.abs(out[b].x - out[movedId].x))[0];
  if (!target) return pos;

  const t = out[target];
  out[movedId] = { x: out[movedId].x <= t.x ? t.x : t.x + STEP, y: t.y };

  // Sweep left→right; push anything that collides with an already-settled frame to its right.
  const settled = [movedId];
  for (const id of others.sort((a, b) => out[a].x - out[b].x)) {
    let s: string | undefined;
    while ((s = settled.find((s) => out[id].x >= out[s].x && hits(id, s)))) out[id] = { ...out[id], x: out[s].x + STEP };
    settled.push(id);
  }
  return out;
}

/** Root ("EagleAI") sits centred above the frames. */
export function rootPosition(positions: Pos[]): Pos {
  if (!positions.length) return { x: -ROOT_W / 2, y: -ROOT_H - ROOT_GAP };
  const centers = positions.map((p) => p.x + FRAME_W / 2);
  const cx = (Math.min(...centers) + Math.max(...centers)) / 2;
  const top = Math.min(...positions.map((p) => p.y));
  return { x: cx - ROOT_W / 2, y: top - ROOT_GAP - ROOT_H };
}

/** Orthogonal connector with rounded elbows, draw.io style. */
export function elbowPath(from: Pos, to: Pos, r = 14) {
  const midY = from.y + (to.y - from.y) / 2;
  const dx = to.x - from.x;
  if (Math.abs(dx) < 1) return `M ${from.x} ${from.y} V ${to.y}`;
  if (to.y - from.y < 2 * r + 8) {
    // Target isn't below the source — fall back to a smooth curve.
    const c = Math.max(60, Math.abs(to.y - from.y) / 2);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + c}, ${to.x} ${to.y - c}, ${to.x} ${to.y}`;
  }
  const s = Math.sign(dx);
  const rr = Math.min(r, Math.abs(dx) / 2, (to.y - from.y) / 4);
  return [
    `M ${from.x} ${from.y}`,
    `V ${midY - rr}`,
    `Q ${from.x} ${midY} ${from.x + s * rr} ${midY}`,
    `H ${to.x - s * rr}`,
    `Q ${to.x} ${midY} ${to.x} ${midY + rr}`,
    `V ${to.y}`,
  ].join(' ');
}
