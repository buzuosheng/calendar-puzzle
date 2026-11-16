import {
  COLS,
  ROWS,
  type Cell,
  FULL_BOARD_MASK,
  bitOf,
  coverMask,
} from './board';
import {
  type PieceId,
  ORIENTATIONS,
  PIECE_IDS,
  translate,
} from './pieces';
import type { Placement } from './placement';

const PIECE_COUNT = PIECE_IDS.length;

/**
 * Search order (deterministic; the first solution is the hint target):
 *
 * 1. Always cover the lowest-index remaining cell (index = row * 7 + col,
 *    row-major, top-left to bottom-right).
 * 2. Try pieces in fixed order: V, T, Z, L, N, P, U, J, S, I.
 * 3. For each piece, try precomputed placements that cover that cell, in
 *    generation order: unique orientations (unflipped then flipped; for each,
 *    rotations 0°, 90°, 180°, 270° CW, first-seen only), and for each
 *    orientation, origins in row-major order.
 */
export type SolvedPiece = Placement & { cells: Cell[]; mask: bigint };

type IndexedPlacement = {
  mask: bigint;
  orientationIndex: number;
  origin: Cell;
};

type PieceTables = {
  pieceId: PieceId;
  all: IndexedPlacement[];
  byCell: IndexedPlacement[][];
};

let TABLES: PieceTables[] | null = null;

function buildTables(): PieceTables[] {
  return PIECE_IDS.map((pieceId) => {
    const all: IndexedPlacement[] = [];
    const byCell: IndexedPlacement[][] = Array.from({ length: ROWS * COLS }, () => []);

    ORIENTATIONS[pieceId].forEach((ori, orientationIndex) => {
      const maxR = Math.max(...ori.map((cell) => cell.r));
      const maxC = Math.max(...ori.map((cell) => cell.c));
      for (let r0 = 0; r0 <= ROWS - 1 - maxR; r0++) {
        for (let c0 = 0; c0 <= COLS - 1 - maxC; c0++) {
          const origin = { r: r0, c: c0 };
          const cells = translate(ori, origin);
          let mask = 0n;
          for (const cell of cells) mask |= bitOf(cell.r, cell.c);
          if ((mask & FULL_BOARD_MASK) !== mask) continue;
          const placement: IndexedPlacement = { mask, orientationIndex, origin };
          all.push(placement);
          let cursor = mask;
          while (cursor !== 0n) {
            const lsb = cursor & -cursor;
            const index = lowestBitIndex(lsb);
            byCell[index]!.push(placement);
            cursor ^= lsb;
          }
        }
      }
    });

    return { pieceId, all, byCell };
  });
}

function tables(): PieceTables[] {
  if (!TABLES) TABLES = buildTables();
  return TABLES;
}

/** Index of the least-significant set bit in a 56-bit board mask. */
function lowestBitIndex(mask: bigint): number {
  const low = Number(mask & 0xffffffffn);
  if (low !== 0) return 31 - Math.clz32(low & -low);
  const high = Number((mask >> 32n) & 0xffffffffn);
  return 32 + (31 - Math.clz32(high & -high));
}

function reconstruct(pieceIndex: number, item: IndexedPlacement): SolvedPiece {
  const pieceId = PIECE_IDS[pieceIndex]!;
  const ori = ORIENTATIONS[pieceId][item.orientationIndex]!;
  return {
    pieceId,
    orientationIndex: item.orientationIndex,
    origin: item.origin,
    cells: translate(ori, item.origin),
    mask: item.mask,
  };
}

function searchFirst(board: bigint): SolvedPiece[] | null {
  const tabs = tables();
  const chosen: (IndexedPlacement | null)[] = Array(PIECE_COUNT).fill(null);
  let used = 0;

  const rec = (remaining: bigint): boolean => {
    if (remaining === 0n) return true;
    const cell = lowestBitIndex(remaining);
    for (let p = 0; p < PIECE_COUNT; p++) {
      if ((used >> p) & 1) continue;
      const options = tabs[p]!.byCell[cell]!;
      for (let i = 0; i < options.length; i++) {
        const item = options[i]!;
        if ((item.mask & remaining) !== item.mask) continue;
        used |= 1 << p;
        chosen[p] = item;
        if (rec(remaining ^ item.mask)) return true;
        used ^= 1 << p;
        chosen[p] = null;
      }
    }
    return false;
  };

  if (!rec(board)) return null;
  return chosen.map((item, p) => reconstruct(p, item!));
}

/**
 * First solution for a month/day/weekday, or null if none (should never
 * happen for a real calendar combination on this piece set, including Feb 29).
 */
export function findFirstSolution(
  month: number,
  day: number,
  weekday: number,
): SolvedPiece[] | null {
  return searchFirst(coverMask(month, day, weekday));
}

/** Count every exact covering for a month/day/weekday. */
export function countSolutions(month: number, day: number, weekday: number): number {
  const board = coverMask(month, day, weekday);
  const tabs = tables();
  let used = 0;
  let count = 0;

  const rec = (remaining: bigint): void => {
    if (remaining === 0n) {
      count += 1;
      return;
    }
    const cell = lowestBitIndex(remaining);
    for (let p = 0; p < PIECE_COUNT; p++) {
      if ((used >> p) & 1) continue;
      const options = tabs[p]!.byCell[cell]!;
      for (let i = 0; i < options.length; i++) {
        const item = options[i]!;
        if ((item.mask & remaining) !== item.mask) continue;
        used |= 1 << p;
        rec(remaining ^ item.mask);
        used ^= 1 << p;
      }
    }
  };

  rec(board);
  return count;
}

const firstCache = new Map<string, SolvedPiece[] | null>();

export function dateKey(month: number, day: number, weekday: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${weekday}`;
}

/** Cached canonical (first) solution used by hints. */
export function canonicalSolution(
  month: number,
  day: number,
  weekday: number,
): SolvedPiece[] | null {
  const key = dateKey(month, day, weekday);
  if (firstCache.has(key)) return firstCache.get(key)!;
  const solution = findFirstSolution(month, day, weekday);
  firstCache.set(key, solution);
  return solution;
}

export function asPlacements(solution: readonly SolvedPiece[]): Placement[] {
  return solution.map(({ pieceId, orientationIndex, origin }) => ({
    pieceId,
    orientationIndex,
    origin,
  }));
}

/** Number of precomputed placements (for tests / sanity). */
export function placementCounts(): Record<PieceId, number> {
  const counts = {} as Record<PieceId, number>;
  for (const table of tables()) {
    counts[table.pieceId] = table.all.length;
  }
  return counts;
}
