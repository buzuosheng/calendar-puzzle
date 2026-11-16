import { describe, expect, it } from 'vitest';
import { isSolved } from '../placement';
import { asPlacements, canonicalSolution, findFirstSolution } from '../solver';
import { Game } from '../game';
import { PIECE_IDS } from '../pieces';

describe('win detection', () => {
  it('does not mark an incomplete board as solved', () => {
    const solution = findFirstSolution(1, 1, 0);
    expect(solution).not.toBeNull();
    const partial = asPlacements(solution!).slice(0, 9);
    expect(isSolved(partial, 1, 1, 0)).toBe(false);
    expect(isSolved([], 1, 1, 0)).toBe(false);
  });

  it('accepts a complete legal covering', () => {
    const solution = findFirstSolution(10, 6, 2);
    expect(solution).not.toBeNull();
    expect(isSolved(asPlacements(solution!), 10, 6, 2)).toBe(true);
  });

  it('rejects a covering that still includes a date cell or the wrong date', () => {
    const solution = findFirstSolution(1, 1, 0);
    expect(isSolved(asPlacements(solution!), 1, 2, 0)).toBe(false);
    expect(isSolved(asPlacements(solution!), 1, 1, 1)).toBe(false);
  });

  it('Game applies a canonical solution, stops the timer, and does not solve early', () => {
    let now = 1_000_000;
    const game = new Game({ month: 3, day: 14, weekday: 6, persist: false, now: () => now });
    expect(game.isComplete()).toBe(false);
    expect(game.timerRunning).toBe(false);

    const solution = canonicalSolution(3, 14, 6)!;
    const first = solution[0]!;
    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.timerRunning).toBe(true);
    expect(game.solved).toBe(false);

    now += 2500;
    for (const piece of solution.slice(1)) {
      expect(game.tryPlace(piece.pieceId, piece.origin, piece.orientationIndex)).toBe(true);
    }
    expect(game.solved).toBe(true);
    expect(game.isComplete()).toBe(true);
    expect(game.timerRunning).toBe(false);
    expect(game.elapsedMs()).toBe(2500);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'board')).toBe(true);
  });
});
