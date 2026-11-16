import { describe, expect, it } from 'vitest';
import { Game, calendarParts, previousDate } from '../game';
import { canonicalSolution } from '../solver';
import { isSolved } from '../placement';
import { PIECE_IDS } from '../pieces';

describe('yesterday preview and start today', () => {
  it('opens on yesterday with a complete solution, without saving a solve', () => {
    const today = () => new Date(2026, 10, 15); // Sunday, Nov 15, 2026
    const game = new Game({ persist: false, today, previewYesterday: true });
    const yesterday = calendarParts(previousDate(today()));

    expect(yesterday).toEqual({ month: 11, day: 14, weekday: 6 });
    expect(game.mode).toBe('preview');
    expect(game.month).toBe(11);
    expect(game.day).toBe(14);
    expect(game.weekday).toBe(6);
    expect(game.locked).toBe(true);
    expect(game.solved).toBe(false);
    expect(game.timerRunning).toBe(false);
    expect(game.elapsedMs()).toBe(0);
    expect(game.hintsUsed).toBe(0);
    expect(game.isComplete()).toBe(true);
    expect(isSolved(game.boardPlacements(), 11, 14, 6)).toBe(true);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'board')).toBe(true);

    const solution = canonicalSolution(11, 14, 6)!;
    for (const placed of solution) {
      const piece = game.piece(placed.pieceId);
      expect(piece.orientationIndex).toBe(placed.orientationIndex);
      expect(piece.origin).toEqual(placed.origin);
    }

    expect(game.tryPlace(solution[0]!.pieceId, { r: 0, c: 0 })).toBe(false);
    expect(game.hint()).toEqual({ action: 'none' });
  });

  it('wraps yesterday from January 1 to December 31 of the previous year', () => {
    const today = () => new Date(2026, 0, 1);
    const game = new Game({ persist: false, today, previewYesterday: true });
    const yesterday = calendarParts(previousDate(today()));
    expect(yesterday).toEqual({ month: 12, day: 31, weekday: 3 });
    expect(game.month).toBe(12);
    expect(game.day).toBe(31);
    expect(game.weekday).toBe(3);
    expect(game.isComplete()).toBe(true);
  });

  it('startToday leaves preview and begins an empty puzzle for today', () => {
    let now = 1_000_000;
    const today = () => new Date(2026, 10, 15);
    const game = new Game({ persist: false, today, now: () => now, previewYesterday: true });

    game.startToday();
    expect(game.mode).toBe('play');
    expect(game.locked).toBe(false);
    expect(game.solved).toBe(false);
    expect(game.month).toBe(11);
    expect(game.day).toBe(15);
    expect(game.weekday).toBe(0);
    expect(game.isComplete()).toBe(false);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);
    expect(game.timerRunning).toBe(false);

    const solution = canonicalSolution(11, 15, 0)!;
    const first = solution[0]!;
    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.timerRunning).toBe(true);
    now += 4000;
    for (const piece of solution.slice(1)) {
      expect(game.tryPlace(piece.pieceId, piece.origin, piece.orientationIndex)).toBe(true);
    }
    expect(game.solved).toBe(true);
    expect(game.elapsedMs()).toBe(4000);
  });

  it('changing the date exits preview and starts a fresh board', () => {
    const today = () => new Date(2026, 10, 15);
    const game = new Game({ persist: false, today, previewYesterday: true });
    game.setDate(3, 1, 0);
    expect(game.mode).toBe('play');
    expect(game.locked).toBe(false);
    expect(game.month).toBe(3);
    expect(game.day).toBe(1);
    expect(game.weekday).toBe(0);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);
  });
});
