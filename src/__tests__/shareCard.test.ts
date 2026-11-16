import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { canonicalSolution } from '../solver';
import {
  SHARE_HEIGHT,
  SHARE_WIDTH,
  buildShareCard,
  canBuildShareCard,
  shareFilename,
  type ShareCanvas,
  type ShareCardInput,
  type ShareContext,
} from '../shareCard';

function stubCanvas(width: number, height: number): ShareCanvas {
  const state: Record<string, unknown> = {};
  const ctx = new Proxy({} as ShareContext, {
    get(_target, prop) {
      if (prop in state) return state[prop as string];
      return () => {};
    },
    set(_target, prop, value) {
      state[prop as string] = value;
      return true;
    },
  });
  return {
    width,
    height,
    getContext: (type: '2d') => (type === '2d' ? ctx : null),
    toBlob(callback, type) {
      callback(
        new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
          type: type ?? 'image/png',
        }),
      );
    },
  };
}

function inputFrom(game: Game, overrides: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    mode: game.mode,
    solved: game.solved,
    month: game.month,
    day: game.day,
    weekday: game.weekday,
    pieces: game.pieces,
    elapsedMs: game.elapsedMs(),
    hintsUsed: game.hintsUsed,
    streak: game.streak,
    locale: 'en',
    ...overrides,
  };
}

function solvedGame(): Game {
  const game = new Game({ persist: false, month: 11, day: 15, weekday: 0 });
  const solution = canonicalSolution(11, 15, 0)!;
  for (const piece of solution) {
    expect(game.tryPlace(piece.pieceId, piece.origin, piece.orientationIndex)).toBe(true);
  }
  expect(game.solved).toBe(true);
  return game;
}

describe('per-solve share image', () => {
  it('builds the locked filename from month, day, and weekday', () => {
    expect(shareFilename(11, 15, 0)).toBe('calendar-puzzle-11-15-0.png');
    expect(shareFilename(3, 5, 2)).toBe('calendar-puzzle-3-5-2.png');
  });

  it('produces a 1080×1350 PNG from a solved state', async () => {
    const game = solvedGame();
    const card = await buildShareCard(inputFrom(game), stubCanvas);
    expect(card).not.toBeNull();
    expect(card!.width).toBe(SHARE_WIDTH);
    expect(card!.height).toBe(SHARE_HEIGHT);
    expect(card!.width).toBe(1080);
    expect(card!.height).toBe(1350);
    expect(card!.blob.type).toBe('image/png');
    expect(card!.filename).toBe('calendar-puzzle-11-15-0.png');
  });

  it('does not generate a card in preview or unsolved states', async () => {
    const preview = new Game({
      persist: false,
      previewYesterday: true,
      today: () => new Date(2026, 10, 15),
    });
    expect(preview.mode).toBe('preview');
    expect(preview.isComplete()).toBe(true);
    expect(canBuildShareCard(preview)).toBe(false);
    expect(await buildShareCard(inputFrom(preview), stubCanvas)).toBeNull();

    const unsolved = new Game({ persist: false, month: 11, day: 15, weekday: 0 });
    expect(unsolved.solved).toBe(false);
    expect(canBuildShareCard(unsolved)).toBe(false);
    expect(await buildShareCard(inputFrom(unsolved), stubCanvas)).toBeNull();
  });
});
