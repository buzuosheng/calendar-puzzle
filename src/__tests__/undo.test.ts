import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { canonicalSolution } from '../solver';
import { ORIENTATIONS, PIECE_IDS, translate } from '../pieces';

function playGame(options: ConstructorParameters<typeof Game>[0] = {}) {
  return new Game({ month: 3, day: 14, weekday: 6, persist: false, ...options });
}

describe('undo', () => {
  it('places a piece then undoes back to the tray, without rewinding the timer', () => {
    let now = 1_000_000;
    const game = playGame({ now: () => now });
    const solution = canonicalSolution(3, 14, 6)!;
    const first = solution[0]!;

    expect(game.canUndo).toBe(false);
    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.canUndo).toBe(true);
    expect(game.piece(first.pieceId).location).toBe('board');
    expect(game.timerRunning).toBe(true);
    now += 2500;
    expect(game.elapsedMs()).toBe(2500);

    game.undo();
    expect(game.canUndo).toBe(false);
    expect(game.piece(first.pieceId).location).toBe('tray');
    expect(game.piece(first.pieceId).origin).toBeNull();
    expect(game.selectedId).toBeNull();
    expect(game.timerRunning).toBe(true);
    expect(game.elapsedMs()).toBe(2500);
    expect(game.month).toBe(3);
    expect(game.day).toBe(14);
    expect(game.weekday).toBe(6);
  });

  it('undoes a hint and restores hintsUsed and the placed piece', () => {
    const game = playGame();
    const result = game.hint();
    expect(result.action).toBe('placed');
    expect(game.hintsUsed).toBe(1);
    const placedId = result.action === 'placed' ? result.pieceId : null;
    expect(placedId).not.toBeNull();
    expect(game.piece(placedId!).location).toBe('board');
    expect(game.canUndo).toBe(true);

    game.undo();
    expect(game.hintsUsed).toBe(0);
    expect(game.piece(placedId!).location).toBe('tray');
    expect(game.piece(placedId!).origin).toBeNull();
    expect(game.canUndo).toBe(false);
  });

  it('undoes a hint that returned a blocker and restores hintsUsed', () => {
    const game = playGame();
    const solution = canonicalSolution(3, 14, 6)!;
    const target = solution[0]!;
    const wanted = new Set(target.cells.map((cell) => `${cell.r},${cell.c}`));
    let blockerId: (typeof PIECE_IDS)[number] | null = null;
    let blockerOrigin: { r: number; c: number } | null = null;
    let blockerOri = 0;
    search: for (const id of PIECE_IDS) {
      if (id === target.pieceId) continue;
      const oris = ORIENTATIONS[id];
      for (let ori = 0; ori < oris.length; ori++) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 7; c++) {
            const origin = { r, c };
            const cells = translate(oris[ori]!, origin);
            if (!cells.some((cell) => wanted.has(`${cell.r},${cell.c}`))) continue;
            if (game.tryPlace(id, origin, ori)) {
              blockerId = id;
              blockerOrigin = origin;
              blockerOri = ori;
              break search;
            }
          }
        }
      }
    }
    expect(blockerId).not.toBeNull();
    expect(game.piece(blockerId!).location).toBe('board');

    const result = game.hint();
    expect(result).toEqual({ action: 'returned', pieceId: blockerId });
    expect(game.hintsUsed).toBe(1);
    expect(game.piece(blockerId!).location).toBe('tray');

    game.undo();
    expect(game.hintsUsed).toBe(0);
    expect(game.piece(blockerId!).location).toBe('board');
    expect(game.piece(blockerId!).origin).toEqual(blockerOrigin);
    expect(game.piece(blockerId!).orientationIndex).toBe(blockerOri);
  });

  it('clears the undo stack on reset and setDate', () => {
    const game = playGame();
    const first = canonicalSolution(3, 14, 6)![0]!;
    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.canUndo).toBe(true);

    game.reset();
    expect(game.canUndo).toBe(false);
    game.undo();
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);

    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.canUndo).toBe(true);
    game.setDate(1, 1, 0);
    expect(game.canUndo).toBe(false);
    expect(game.month).toBe(1);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);
    game.undo();
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);
  });

  it('clears the undo stack on startToday and applyPreview', () => {
    const today = () => new Date(2026, 10, 15);
    const game = new Game({ persist: false, today, month: 3, day: 14, weekday: 6 });
    const first = canonicalSolution(3, 14, 6)![0]!;
    expect(game.tryPlace(first.pieceId, first.origin, first.orientationIndex)).toBe(true);
    expect(game.canUndo).toBe(true);

    game.startToday();
    expect(game.canUndo).toBe(false);
    expect(game.month).toBe(11);
    expect(game.day).toBe(15);

    const todayFirst = canonicalSolution(11, 15, 0)![0]!;
    expect(game.tryPlace(todayFirst.pieceId, todayFirst.origin, todayFirst.orientationIndex)).toBe(
      true,
    );
    expect(game.canUndo).toBe(true);
    game.applyPreview(11, 14, 6);
    expect(game.mode).toBe('preview');
    expect(game.canUndo).toBe(false);
    expect(game.locked).toBe(true);
  });

  it('is a no-op when the stack is empty', () => {
    const game = playGame();
    expect(game.canUndo).toBe(false);
    game.undo();
    expect(game.canUndo).toBe(false);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'tray')).toBe(true);
    expect(game.hintsUsed).toBe(0);
    expect(game.selectedId).toBeNull();
  });

  it('is a no-op in a locked preview, even after attempted moves', () => {
    const today = () => new Date(2026, 10, 15);
    const game = new Game({ persist: false, today, previewYesterday: true });
    const before = game.pieces.map((piece) => ({
      ...piece,
      origin: piece.origin ? { ...piece.origin } : null,
    }));
    expect(game.locked).toBe(true);
    expect(game.canUndo).toBe(false);
    expect(game.tryPlace('I', { r: 2, c: 1 })).toBe(false);
    game.undo();
    expect(game.canUndo).toBe(false);
    expect(game.mode).toBe('preview');
    expect(game.pieces).toEqual(before);
  });

  it('is a no-op once the attempt is solved and does not un-save the win', () => {
    const game = playGame();
    const solution = canonicalSolution(3, 14, 6)!;
    for (const piece of solution) {
      expect(game.tryPlace(piece.pieceId, piece.origin, piece.orientationIndex)).toBe(true);
    }
    expect(game.solved).toBe(true);
    expect(game.locked).toBe(true);
    expect(game.canUndo).toBe(false);

    game.undo();
    expect(game.solved).toBe(true);
    expect(game.isComplete()).toBe(true);
    expect(PIECE_IDS.every((id) => game.piece(id).location === 'board')).toBe(true);
  });

  it('does not push history for an illegal placement', () => {
    const game = playGame();
    expect(game.tryPlace('I', { r: 0, c: 6 })).toBe(false);
    expect(game.canUndo).toBe(false);
    expect(game.piece('I').location).toBe('tray');
    game.undo();
    expect(game.piece('I').location).toBe('tray');
  });
});
