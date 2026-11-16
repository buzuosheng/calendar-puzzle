import type { Cell } from './board';

/**
 * Standard weekday (DOTY-style) calendar set:
 * seven pentominoes (V, T, Z, L, N, P, U) + three tetrominoes (J, S, I) = 47 cells.
 *
 * Pieces may be rotated in 90° steps and flipped. Only unique orientations
 * are kept.
 */
export type PieceId = 'V' | 'T' | 'Z' | 'L' | 'N' | 'P' | 'U' | 'J' | 'S' | 'I';

export const PIECE_IDS: readonly PieceId[] = ['V', 'T', 'Z', 'L', 'N', 'P', 'U', 'J', 'S', 'I'];

export const PENTOMINO_IDS: readonly PieceId[] = ['V', 'T', 'Z', 'L', 'N', 'P', 'U'];
export const TETROMINO_IDS: readonly PieceId[] = ['J', 'S', 'I'];

/** ASCII rows; `#` is a filled cell, `.` is empty. Canonical orientation. */
export const PIECE_SHAPES: Record<PieceId, readonly string[]> = {
  V: ['#..', '#..', '###'],
  T: ['###', '.#.', '.#.'],
  Z: ['##.', '.#.', '.##'],
  L: ['##', '#.', '#.', '#.'],
  N: ['#.', '##', '.#', '.#'],
  P: ['##', '##', '#.'],
  U: ['##', '#.', '##'],
  J: ['##', '#.', '#.'],
  S: ['#.', '##', '.#'],
  I: ['#', '#', '#', '#'],
};

export type PieceColor = {
  fill: string;
  stroke: string;
};

/** Same flat light maple as the board; pieces are distinguished by shape. */
export const PIECE_COLOR: PieceColor = {
  fill: '#F3E2B8',
  stroke: '#C49A62',
};

/** Kept so existing imports can stay; every piece uses the board maple. */
export const PIECE_COLORS: Record<PieceId, PieceColor> = {
  V: PIECE_COLOR,
  T: PIECE_COLOR,
  Z: PIECE_COLOR,
  L: PIECE_COLOR,
  N: PIECE_COLOR,
  P: PIECE_COLOR,
  U: PIECE_COLOR,
  J: PIECE_COLOR,
  S: PIECE_COLOR,
  I: PIECE_COLOR,
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
  V: uniqueOrientations(PIECE_SHAPES.V),
  T: uniqueOrientations(PIECE_SHAPES.T),
  Z: uniqueOrientations(PIECE_SHAPES.Z),
  L: uniqueOrientations(PIECE_SHAPES.L),
  N: uniqueOrientations(PIECE_SHAPES.N),
  P: uniqueOrientations(PIECE_SHAPES.P),
  U: uniqueOrientations(PIECE_SHAPES.U),
  J: uniqueOrientations(PIECE_SHAPES.J),
  S: uniqueOrientations(PIECE_SHAPES.S),
  I: uniqueOrientations(PIECE_SHAPES.I),
};

export function pieceSize(pieceId: PieceId): number {
  return pieceId === 'J' || pieceId === 'S' || pieceId === 'I' ? 4 : 5;
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
