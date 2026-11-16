import {
  type Cell,
  coverMask,
  dateMask,
  isPlayable,
  isUnused,
  bitOf,
  FULL_BOARD_MASK,
  COVER_CELLS,
} from './board';
import {
  type PieceId,
  ORIENTATIONS,
  PIECE_IDS,
  translate,
  pieceSize,
} from './pieces';

export type Placement = {
  pieceId: PieceId;
  orientationIndex: number;
  origin: Cell;
};

export function cellsOf(placement: Placement): Cell[] {
  const ori = ORIENTATIONS[placement.pieceId][placement.orientationIndex];
  if (!ori) {
    throw new RangeError(
      `Unknown orientation ${placement.orientationIndex} for ${placement.pieceId}`,
    );
  }
  return translate(ori, placement.origin);
}

export function maskOfCells(cells: readonly Cell[]): bigint {
  let mask = 0n;
  for (const { r, c } of cells) mask |= bitOf(r, c);
  return mask;
}

export function maskOfPlacement(placement: Placement): bigint {
  return maskOfCells(cellsOf(placement));
}

export type IllegalReason =
  | 'off-board'
  | 'unused'
  | 'date-cell'
  | 'overlap'
  | 'unknown-orientation';

export type Legality = { ok: true } | { ok: false; reason: IllegalReason };

/**
 * A placement is legal when every cell is playable, not a date cell, and not
 * already occupied. Off-board and unused cells are rejected.
 */
export function placementLegality(
  cells: readonly Cell[],
  occupied: bigint,
  blocked: bigint,
): Legality {
  let seen = 0n;
  for (const { r, c } of cells) {
    if (!isPlayable(r, c)) {
      return { ok: false, reason: isUnused(r, c) ? 'unused' : 'off-board' };
    }
    const bit = bitOf(r, c);
    if (bit & blocked) return { ok: false, reason: 'date-cell' };
    if (bit & occupied) return { ok: false, reason: 'overlap' };
    if (bit & seen) return { ok: false, reason: 'overlap' };
    seen |= bit;
  }
  return { ok: true };
}

export function isLegalPlacement(
  cells: readonly Cell[],
  occupied: bigint,
  blocked: bigint,
): boolean {
  return placementLegality(cells, occupied, blocked).ok;
}

/** Occupancy mask of every placed piece except `exceptId`. */
export function occupancyMask(
  placements: Iterable<Placement>,
  exceptId?: PieceId,
): bigint {
  let mask = 0n;
  for (const placement of placements) {
    if (placement.pieceId === exceptId) continue;
    mask |= maskOfPlacement(placement);
  }
  return mask;
}

/**
 * The board is solved when all ten pieces are placed, they do not overlap,
 * and they cover exactly the 47 non-date playable cells.
 */
export function isSolved(
  placements: readonly Placement[],
  month: number,
  day: number,
  weekday: number,
): boolean {
  if (placements.length !== PIECE_IDS.length) return false;
  const seen = new Set<PieceId>();
  let mask = 0n;
  let cells = 0;
  for (const placement of placements) {
    if (seen.has(placement.pieceId)) return false;
    seen.add(placement.pieceId);
    const pieceCells = cellsOf(placement);
    if (pieceCells.length !== pieceSize(placement.pieceId)) return false;
    const pieceMask = maskOfCells(pieceCells);
    if (pieceMask & mask) return false;
    if ((pieceMask & FULL_BOARD_MASK) !== pieceMask) return false;
    if (pieceMask & dateMask(month, day, weekday)) return false;
    mask |= pieceMask;
    cells += pieceCells.length;
  }
  return cells === COVER_CELLS && mask === coverMask(month, day, weekday) && seen.size === PIECE_IDS.length;
}

/**
 * After a rotate/flip, try to keep the piece near its previous center.
 * Returns a legal origin, or null if no nearby origin fits.
 */
export function originAfterTransform(
  pieceId: PieceId,
  newOrientationIndex: number,
  previousCells: readonly Cell[],
  occupied: bigint,
  blocked: bigint,
): Cell | null {
  const ori = ORIENTATIONS[pieceId][newOrientationIndex];
  if (!ori || previousCells.length === 0) return null;

  const prevMinR = Math.min(...previousCells.map((cell) => cell.r));
  const prevMaxR = Math.max(...previousCells.map((cell) => cell.r));
  const prevMinC = Math.min(...previousCells.map((cell) => cell.c));
  const prevMaxC = Math.max(...previousCells.map((cell) => cell.c));
  const prevCenterR = (prevMinR + prevMaxR) / 2;
  const prevCenterC = (prevMinC + prevMaxC) / 2;

  const box = {
    height: Math.max(...ori.map((cell) => cell.r)) + 1,
    width: Math.max(...ori.map((cell) => cell.c)) + 1,
  };

  const candidates: { origin: Cell; dist: number }[] = [];
  for (let r = prevMinR - box.height; r <= prevMaxR + 1; r++) {
    for (let c = prevMinC - box.width; c <= prevMaxC + 1; c++) {
      const origin = { r, c };
      const cells = translate(ori, origin);
      if (!isLegalPlacement(cells, occupied, blocked)) continue;
      const minR = Math.min(...cells.map((cell) => cell.r));
      const maxR = Math.max(...cells.map((cell) => cell.r));
      const minC = Math.min(...cells.map((cell) => cell.c));
      const maxC = Math.max(...cells.map((cell) => cell.c));
      const centerR = (minR + maxR) / 2;
      const centerC = (minC + maxC) / 2;
      const dist =
        (centerR - prevCenterR) ** 2 + (centerC - prevCenterC) ** 2;
      candidates.push({ origin, dist });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist || a.origin.r - b.origin.r || a.origin.c - b.origin.c);
  return candidates[0]?.origin ?? null;
}
