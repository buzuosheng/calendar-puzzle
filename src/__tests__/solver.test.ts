import { describe, expect, it } from 'vitest';
import { allCalendarPuzzles, coverMask, DAYS_IN_MONTH } from '../board';
import { maskOfPlacement, isSolved } from '../placement';
import { PIECE_IDS } from '../pieces';
import {
  asPlacements,
  canonicalSolution,
  findFirstSolution,
  placementCounts,
} from '../solver';
import { Game } from '../game';

describe('solver', () => {
  it('precomputes unique placements for each piece', () => {
    const counts = placementCounts();
    for (const id of PIECE_IDS) {
      expect(counts[id], id).toBeGreaterThan(0);
    }
    // Straight I has relatively few poses; P is compact and has many.
    expect(counts.I).toBeLessThan(counts.P);
  });

  it(
    'finds a first solution for every month/day/weekday including Feb 29',
    { timeout: 180_000 },
    () => {
      const puzzles = allCalendarPuzzles();
      expect(puzzles).toHaveLength(2562);
      expect(puzzles).toContainEqual({ month: 2, day: 29, weekday: 0 });
      expect(puzzles).toContainEqual({ month: 2, day: 29, weekday: 6 });

      // Invalid days such as 31 Apr are skipped, same as the 366-date suite.
      expect(DAYS_IN_MONTH[3]).toBe(30);

      const missing: string[] = [];
      for (const { month, day, weekday } of puzzles) {
        const solution = findFirstSolution(month, day, weekday);
        if (!solution) {
          missing.push(`${month}-${day}-${weekday}`);
          continue;
        }
        expect(solution).toHaveLength(10);
        expect(isSolved(asPlacements(solution), month, day, weekday)).toBe(true);
        const cover = solution.reduce((mask, piece) => mask | piece.mask, 0n);
        expect(cover).toBe(coverMask(month, day, weekday));
      }
      expect(missing, `unsolvable puzzles: ${missing.join(', ')}`).toEqual([]);
    },
  );

  it('returns a deterministic canonical solution for hints', () => {
    const a = canonicalSolution(7, 4, 5);
    const b = findFirstSolution(7, 4, 5);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.map((piece) => `${piece.pieceId}:${piece.orientationIndex}:${piece.origin.r},${piece.origin.c}`)).toEqual(
      b!.map((piece) => `${piece.pieceId}:${piece.orientationIndex}:${piece.origin.r},${piece.origin.c}`),
    );
    // Same date always yields the same first arrangement.
    expect(canonicalSolution(7, 4, 5)).toBe(a);
  });
});

describe('hints', () => {
  it('places one canonical piece at a time and can finish the puzzle', () => {
    const game = new Game({ month: 10, day: 6, weekday: 2, persist: false });
    let steps = 0;
    while (!game.solved && steps < 20) {
      const result = game.hint();
      expect(result.action).not.toBe('none');
      steps += 1;
    }
    expect(game.solved).toBe(true);
    expect(game.hintsUsed).toBeGreaterThanOrEqual(10);
    expect(game.hintsUsed).toBe(steps);
    expect(game.isComplete()).toBe(true);
    expect(game.timerRunning).toBe(false);
  });

  it('returns a blocking piece when the target cells are occupied', () => {
    const game = new Game({ month: 1, day: 1, weekday: 0, persist: false });
    const solution = canonicalSolution(1, 1, 0)!;
    const first = solution[0]!;
    const second = solution[1]!;
    const moved = game.tryPlace(second.pieceId, first.origin, first.orientationIndex);
    if (moved) {
      const result = game.hint();
      expect(result).toEqual({ action: 'returned', pieceId: second.pieceId });
      expect(game.piece(second.pieceId).location).toBe('tray');
    } else {
      expect(game.tryPlace(second.pieceId, second.origin, second.orientationIndex)).toBe(true);
      const result = game.hint();
      expect(result.action).toBe('placed');
      expect(result).toMatchObject({ pieceId: first.pieceId });
    }
    expect(game.hintsUsed).toBe(1);
  });
});

describe('placement masks in solutions', () => {
  it('never overlaps and never covers date cells', () => {
    const solution = findFirstSolution(12, 31, 6)!;
    let mask = 0n;
    for (const piece of solution) {
      const m = maskOfPlacement(piece);
      expect(m & mask).toBe(0n);
      mask |= m;
    }
  });
});
