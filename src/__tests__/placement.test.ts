import { describe, expect, it } from 'vitest';
import { dateMask, bitOf, monthCell, dayCell, weekdayCell } from '../board';
import { placementLegality, isLegalPlacement, occupancyMask, cellsOf, isSolved } from '../placement';
import type { Placement } from '../placement';
import { asPlacements, findFirstSolution } from '../solver';

const blockedSunJan1 = dateMask(1, 1, 0);

describe('placement legality', () => {
  it('accepts a piece fully on playable, uncovered cells', () => {
    // I tetromino vertical at (2,1): days 2, 9, 16, 23 — all free on Sunday 1 Jan.
    const cells = [
      { r: 2, c: 1 },
      { r: 3, c: 1 },
      { r: 4, c: 1 },
      { r: 5, c: 1 },
    ];
    expect(placementLegality(cells, 0n, blockedSunJan1)).toEqual({ ok: true });
  });

  it('rejects placements that cover a date cell', () => {
    const jan = monthCell(1);
    const cells = [
      jan,
      { r: jan.r, c: jan.c + 1 },
      { r: jan.r + 1, c: jan.c },
      { r: jan.r + 1, c: jan.c + 1 },
    ];
    expect(placementLegality(cells, 0n, blockedSunJan1).ok).toBe(false);
    expect(placementLegality(cells, 0n, blockedSunJan1)).toMatchObject({ reason: 'date-cell' });
  });

  it('rejects placements that cover a weekday cell', () => {
    const sun = weekdayCell(0);
    expect(placementLegality([sun], 0n, blockedSunJan1)).toMatchObject({
      ok: false,
      reason: 'date-cell',
    });
  });

  it('rejects placements that cover unused cells', () => {
    const cells = [{ r: 0, c: 5 }, { r: 0, c: 6 }];
    const result = placementLegality(cells, 0n, blockedSunJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unused');
  });

  it('rejects the unused notch on the bottom row', () => {
    const result = placementLegality([{ r: 7, c: 3 }, { r: 7, c: 4 }], 0n, blockedSunJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unused');
  });

  it('rejects off-board cells', () => {
    const result = placementLegality([{ r: -1, c: 0 }, { r: 0, c: 0 }], 0n, blockedSunJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('off-board');
  });

  it('rejects overlap with occupied cells', () => {
    const occupied = bitOf(4, 1) | bitOf(4, 2);
    const cells = [
      { r: 4, c: 1 },
      { r: 5, c: 1 },
      { r: 5, c: 2 },
      { r: 5, c: 3 },
    ];
    const result = placementLegality(cells, occupied, blockedSunJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('overlap');
  });

  it('occupancyMask skips the excluded piece', () => {
    const a: Placement = { pieceId: 'I', orientationIndex: 0, origin: { r: 2, c: 1 } };
    const b: Placement = { pieceId: 'U', orientationIndex: 0, origin: { r: 2, c: 3 } };
    const all = occupancyMask([a, b]);
    const withoutA = occupancyMask([a, b], 'I');
    const aMask = cellsOf(a).reduce((m, cell) => m | bitOf(cell.r, cell.c), 0n);
    expect(all & aMask).toBe(aMask);
    expect(withoutA & aMask).toBe(0n);
  });

  it('isLegalPlacement matches placementLegality.ok', () => {
    const day = dayCell(1);
    expect(isLegalPlacement([day], 0n, blockedSunJan1)).toBe(false);
    expect(isLegalPlacement([{ r: 3, c: 0 }], 0n, blockedSunJan1)).toBe(true);
  });

  it('win detection requires the three date cells to stay uncovered', () => {
    const solution = findFirstSolution(1, 1, 0);
    expect(solution).not.toBeNull();
    expect(isSolved(asPlacements(solution!), 1, 1, 0)).toBe(true);
    expect(isSolved(asPlacements(solution!), 1, 1, 1)).toBe(false);
    expect(isSolved(asPlacements(solution!).slice(0, 9), 1, 1, 0)).toBe(false);
  });
});
