import type { Cell } from './board';

/**
 * Official DragonFjord “A Puzzle A Day” set:
 * one hexomino (O) + seven pentominoes (L, N, P, U, V, Y, Z) = 41 cells.
 *
 * The original brief named a few shapes incorrectly (Y and N were both drawn
 * as L, and an F appeared instead of Y). This is the standard set that yields
 * 24,405 solutions year-round, min 7 (Oct 6), max 216 (Jan 25).
 */
export type PieceId = 'O' | 'L' | 'N' | 'P' | 'U' | 'V' | 'Y' | 'Z';

export const PIECE_IDS: readonly PieceId[] = ['O', 'L', 'N', 'P', 'U', 'V', 'Y', 'Z'];

/** ASCII rows; `#` is a filled cell. */
export const PIECE_SHAPES: Record<PieceId, readonly string[]> = {
  O: ['###', '###'],
  L: ['#', '#', '#', '##'],
  N: ['  ##', '###'],
  P: ['##', '###'],
  U: ['# #', '###'],
  V: ['#', '#', '###'],
  Y: [' #', '####'],
  Z: ['##', ' #', ' ##'],
};

export type PieceColor = {
  fill: string;
  stroke: string;
  highlight: string;
};

/** Distinct, high-contrast painted-wood colors. */
export const PIECE_COLORS: Record<PieceId, PieceColor> = {
  O: { fill: '#C9A15A', stroke: '#5C3E16', highlight: '#E8D09A' },
  L: { fill: '#C24B3C', stroke: '#5A1C16', highlight: '#E28A7A' },
  N: { fill: '#5E8A46', stroke: '#243C18', highlight: '#9BC47A' },
  P: { fill: '#E0A03C', stroke: '#6A4A10', highlight: '#F3D07A' },
  U: { fill: '#2F8F7B', stroke: '#143F36', highlight: '#7FCFBB' },
  V: { fill: '#3D6FB0', stroke: '#1A3358', highlight: '#89B0E0' },
  Y: { fill: '#8A4EA0', stroke: '#3A1C48', highlight: '#C898D8' },
  Z: { fill: '#D25C1E', stroke: '#6A2A0C', highlight: '#F0A06A' },
};

export type Orientation = readonly Cell[];

export function parseShape(rows: readonly string[]): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '#') cells.push({ r, c });
    });
  });
  return cells;
}

export function normalizeCells(cells: readonly Cell[]): Cell[] {
  if (cells.length === 0) return [];
  const minR = Math.min(...cells.map((cell) => cell.r));
  const minC = Math.min(...cells.map((cell) => cell.c));
  return cells
    .map((cell) => ({ r: cell.r - minR, c: cell.c - minC }))
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

function orientationKey(cells: readonly Cell[]): string {
  return normalizeCells(cells)
    .map((cell) => `${cell.r},${cell.c}`)
    .join(';');
}

/** 90° clockwise: (r, c) → (c, −r), then normalized. */
export function rotateCells90CW(cells: readonly Cell[]): Cell[] {
  return normalizeCells(cells.map((cell) => ({ r: cell.c, c: -cell.r })));
}

/** Horizontal mirror: (r, c) → (r, −c), then normalized. */
export function flipCellsHorizontal(cells: readonly Cell[]): Cell[] {
  return normalizeCells(cells.map((cell) => ({ r: cell.r, c: -cell.c })));
}

/**
 * Unique free orientations. Order is deterministic and is the search order
 * used by the solver: unflipped then flipped; for each, rotations 0°, 90°,
 * 180°, 270° clockwise, first-seen only.
 */
export function uniqueOrientations(shape: readonly string[]): Orientation[] {
  const base = parseShape(shape);
  const seen = new Set<string>();
  const out: Orientation[] = [];
  for (const flipped of [false, true]) {
    let current = flipped ? flipCellsHorizontal(base) : normalizeCells(base);
    for (let i = 0; i < 4; i++) {
      const key = orientationKey(current);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(current);
      }
      current = rotateCells90CW(current);
    }
  }
  return out;
}

export const ORIENTATIONS: Record<PieceId, Orientation[]> = {
  O: uniqueOrientations(PIECE_SHAPES.O),
  L: uniqueOrientations(PIECE_SHAPES.L),
  N: uniqueOrientations(PIECE_SHAPES.N),
  P: uniqueOrientations(PIECE_SHAPES.P),
  U: uniqueOrientations(PIECE_SHAPES.U),
  V: uniqueOrientations(PIECE_SHAPES.V),
  Y: uniqueOrientations(PIECE_SHAPES.Y),
  Z: uniqueOrientations(PIECE_SHAPES.Z),
};

export function pieceSize(pieceId: PieceId): number {
  return pieceId === 'O' ? 6 : 5;
}

export function boundingBox(cells: readonly Cell[]): {
  minR: number;
  minC: number;
  maxR: number;
  maxC: number;
  width: number;
  height: number;
} {
  const minR = Math.min(...cells.map((cell) => cell.r));
  const minC = Math.min(...cells.map((cell) => cell.c));
  const maxR = Math.max(...cells.map((cell) => cell.r));
  const maxC = Math.max(...cells.map((cell) => cell.c));
  return { minR, minC, maxR, maxC, width: maxC - minC + 1, height: maxR - minR + 1 };
}

/** Translate a normalized orientation by an origin (top-left of its bbox). */
export function translate(cells: readonly Cell[], origin: Cell): Cell[] {
  return cells.map((cell) => ({ r: cell.r + origin.r, c: cell.c + origin.c }));
}

/**
 * Find the orientation index and origin that reproduce `cells`.
 * Returns null if the set is not a known orientation of the piece.
 */
export function placementFromCells(
  pieceId: PieceId,
  cells: readonly Cell[],
): { orientationIndex: number; origin: Cell } | null {
  if (cells.length === 0) return null;
  const minR = Math.min(...cells.map((cell) => cell.r));
  const minC = Math.min(...cells.map((cell) => cell.c));
  const normalized = normalizeCells(cells);
  const key = orientationKey(normalized);
  const oris = ORIENTATIONS[pieceId];
  const orientationIndex = oris.findIndex((ori) => orientationKey(ori) === key);
  if (orientationIndex < 0) return null;
  return { orientationIndex, origin: { r: minR, c: minC } };
}

export function neighborFlags(cells: readonly Cell[]): Map<string, { n: boolean; e: boolean; s: boolean; w: boolean }> {
  const set = new Set(cells.map((cell) => `${cell.r},${cell.c}`));
  const flags = new Map<string, { n: boolean; e: boolean; s: boolean; w: boolean }>();
  for (const cell of cells) {
    const key = `${cell.r},${cell.c}`;
    flags.set(key, {
      n: set.has(`${cell.r - 1},${cell.c}`),
      e: set.has(`${cell.r},${cell.c + 1}`),
      s: set.has(`${cell.r + 1},${cell.c}`),
      w: set.has(`${cell.r},${cell.c - 1}`),
    });
  }
  return flags;
}
