import type { Cell } from './board';

export type Point = { x: number; y: number };

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

function addEdge(edges: Map<string, Point[]>, a: Point, b: Point): void {
  const list = edges.get(key(a));
  if (list) list.push(b);
  else edges.set(key(a), [b]);
}

/** Directed boundary edges, interior on the left (grid y grows downward). */
function buildEdges(cells: readonly Cell[]): Map<string, Point[]> {
  const filled = new Set(cells.map((cell) => `${cell.r},${cell.c}`));
  const has = (r: number, c: number) => filled.has(`${r},${c}`);
  const edges = new Map<string, Point[]>();
  for (const { r, c } of cells) {
    if (!has(r - 1, c)) addEdge(edges, { x: c + 1, y: r }, { x: c, y: r });
    if (!has(r + 1, c)) addEdge(edges, { x: c, y: r + 1 }, { x: c + 1, y: r + 1 });
    if (!has(r, c - 1)) addEdge(edges, { x: c, y: r }, { x: c, y: r + 1 });
    if (!has(r, c + 1)) addEdge(edges, { x: c + 1, y: r + 1 }, { x: c + 1, y: r });
  }
  return edges;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export function collapseColinear(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const out: Point[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    if (cross(curr.x - prev.x, curr.y - prev.y, next.x - curr.x, next.y - curr.y) !== 0) {
      out.push(curr);
    }
  }
  return out;
}

/**
 * Closed outline vertices in grid units (min corner at the origin of the
 * normalized polyomino). Colinear midpoints are removed.
 */
export function polyominoOutline(cells: readonly Cell[]): Point[] {
  if (cells.length === 0) return [];
  const edges = buildEdges(cells);
  let start: Point | null = null;
  for (const k of edges.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (!start || y < start.y || (y === start.y && x < start.x)) start = { x, y };
  }
  if (!start) return [];

  const path: Point[] = [start];
  let current = start;
  let prev: Point | null = null;
  const used = new Set<string>();

  for (let guard = 0; guard < 1024; guard++) {
    const options = (edges.get(key(current)) ?? []).filter(
      (end) => !used.has(`${key(current)}->${key(end)}`),
    );
    if (options.length === 0) break;

    let next: Point;
    if (!prev) {
      next = options.find((end) => end.y === current.y && end.x < current.x) ?? options[0]!;
    } else {
      const ix = current.x - prev.x;
      const iy = current.y - prev.y;
      next = options.reduce((best, end) => {
        const score = cross(ix, iy, end.x - current.x, end.y - current.y);
        const bestScore = cross(ix, iy, best.x - current.x, best.y - current.y);
        return score > bestScore ? end : best;
      });
    }

    used.add(`${key(current)}->${key(next)}`);
    if (next.x === start.x && next.y === start.y) break;
    path.push(next);
    prev = current;
    current = next;
  }

  return collapseColinear(path);
}

const DEFAULT_RADIUS_RATIO = 0.16;

function fmt(value: number): string {
  return String(Number(value.toFixed(3)));
}

/**
 * Single SVG path for the rounded union of `cells`.
 * Convex corners use a circular arc; concave corners get a slight inner radius
 * so the tile stays one continuous silhouette.
 */
export function roundedPolyominoPath(
  cells: readonly Cell[],
  size: number,
  radius: number = size * DEFAULT_RADIUS_RATIO,
): string {
  const verts = polyominoOutline(cells);
  if (verts.length < 3 || size <= 0) return '';
  const n = verts.length;
  const px = verts.map((p) => ({ x: p.x * size, y: p.y * size }));

  type Corner = { a: Point; b: Point; r: number; sweep: 0 | 1 };
  const corners: Corner[] = [];
  for (let i = 0; i < n; i++) {
    const prev = px[(i - 1 + n) % n]!;
    const p = px[i]!;
    const nxt = px[(i + 1) % n]!;
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(nxt.x - p.x, nxt.y - p.y);
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(radius, inLen * 0.49, outLen * 0.49);
    const ux = (p.x - prev.x) / inLen;
    const uy = (p.y - prev.y) / inLen;
    const vx = (nxt.x - p.x) / outLen;
    const vy = (nxt.y - p.y) / outLen;
    corners.push({
      a: { x: p.x - ux * r, y: p.y - uy * r },
      b: { x: p.x + vx * r, y: p.y + vy * r },
      r,
      sweep: cross(ux, uy, vx, vy) > 0 ? 1 : 0,
    });
  }
  if (corners.length === 0) return '';

  const first = corners[0]!;
  const parts = [`M${fmt(first.a.x)} ${fmt(first.a.y)}`];
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i]!;
    if (i > 0) parts.push(`L${fmt(corner.a.x)} ${fmt(corner.a.y)}`);
    parts.push(
      `A${fmt(corner.r)} ${fmt(corner.r)} 0 0 ${corner.sweep} ${fmt(corner.b.x)} ${fmt(corner.b.y)}`,
    );
  }
  parts.push('Z');
  return parts.join('');
}

