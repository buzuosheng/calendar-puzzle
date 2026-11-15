import { describe, expect, it } from 'vitest';
import { dateMask, bitOf, monthCell, dayCell } from '../board';
import { placementLegality, isLegalPlacement, occupancyMask, cellsOf } from '../placement';
import type { Placement } from '../placement';

const blockedJan1 = dateMask(1, 1);

describe('placement legality', () => {
  it('accepts a piece fully on playable, uncovered cells', () => {
    // O at (0,0) would cover Jan–Mar on row 0 and Jul–Sep on row 1 — Jan is a date cell.
    // Place O at (2,0): days 1–3 and 8–10. Day 1 is blocked for Jan 1.
    // Place O at (2,1): days 2–4 and 9–11, all free on Jan 1.
    const cells = [
      { r: 2, c: 1 },
      { r: 2, c: 2 },
      { r: 2, c: 3 },
      { r: 3, c: 1 },
      { r: 3, c: 2 },
      { r: 3, c: 3 },
    ];
    expect(placementLegality(cells, 0n, blockedJan1)).toEqual({ ok: true });
  });

  it('rejects placements that cover a date cell', () => {
    const jan = monthCell(1);
    const cells = [
      jan,
      { r: jan.r, c: jan.c + 1 },
      { r: jan.r, c: jan.c + 2 },
      { r: jan.r + 1, c: jan.c },
      { r: jan.r + 1, c: jan.c + 1 },
      { r: jan.r + 1, c: jan.c + 2 },
    ];
    expect(placementLegality(cells, 0n, blockedJan1).ok).toBe(false);
    expect(placementLegality(cells, 0n, blockedJan1)).toMatchObject({ reason: 'date-cell' });
  });

  it('rejects placements that cover unused cells', () => {
    const cells = [{ r: 0, c: 5 }, { r: 0, c: 6 }];
    const result = placementLegality(cells, 0n, blockedJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unused');
  });

  it('rejects off-board cells', () => {
    const result = placementLegality([{ r: -1, c: 0 }, { r: 0, c: 0 }], 0n, blockedJan1);
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
      { r: 5, c: 4 },
    ];
    const result = placementLegality(cells, occupied, blockedJan1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('overlap');
  });

  it('occupancyMask skips the excluded piece', () => {
    const a: Placement = { pieceId: 'O', orientationIndex: 0, origin: { r: 2, c: 1 } };
    const b: Placement = { pieceId: 'U', orientationIndex: 0, origin: { r: 4, c: 0 } };
    const all = occupancyMask([a, b]);
    const withoutA = occupancyMask([a, b], 'O');
    const aMask = cellsOf(a).reduce((m, cell) => m | bitOf(cell.r, cell.c), 0n);
    expect(all & aMask).toBe(aMask);
    expect(withoutA & aMask).toBe(0n);
  });

  it('isLegalPlacement matches placementLegality.ok', () => {
    const day = dayCell(1);
    expect(isLegalPlacement([day], 0n, blockedJan1)).toBe(false);
    expect(isLegalPlacement([{ r: 3, c: 0 }], 0n, blockedJan1)).toBe(true);
  });
});
