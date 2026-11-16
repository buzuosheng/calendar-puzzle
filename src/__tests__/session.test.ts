import { afterEach, describe, expect, it } from 'vitest';
import { Game } from '../game';
import { canonicalSolution } from '../solver';
import {
  SESSION_KEY,
  clearSession,
  loadSession,
  saveSession,
  isValidSession,
} from '../storage';
import { PIECE_IDS } from '../pieces';

const memory = new Map<string, string>();

function installStorage(): void {
  memory.clear();
  const storage: Storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

afterEach(() => {
  memory.clear();
});

describe('session persistence', () => {
  it('saves a mid-play board and restores it with the timer still running', () => {
    installStorage();
    let now = 1_000_000;
    const today = () => new Date(2026, 10, 16); // Monday
    const first = new Game({ persist: true, today, now: () => now, month: 11, day: 16, weekday: 1 });
    const solution = canonicalSolution(11, 16, 1)!;
    const placed = solution[0]!;
    expect(first.tryPlace(placed.pieceId, placed.origin, placed.orientationIndex)).toBe(true);
    expect(first.elapsedMs()).toBe(0);
    expect(first.mode).toBe('play');

    const saved = loadSession();
    expect(saved).not.toBeNull();
    expect(saved?.month).toBe(11);
    expect(saved?.day).toBe(16);
    expect(saved?.weekday).toBe(1);
    expect(saved?.timerRunning).toBe(true);
    expect(saved?.startedAt).toBe(1_000_000);
    expect(saved?.solved).toBe(false);
    expect(saved?.pieces.find((piece) => piece.pieceId === placed.pieceId)?.location).toBe('board');

    now += 5_000;
    expect(first.elapsedMs()).toBe(5_000);

    now += 2_000;
    const restored = new Game({
      persist: true,
      today,
      now: () => now,
      month: saved!.month,
      day: saved!.day,
      weekday: saved!.weekday,
      session: saved!,
    });
    expect(restored.mode).toBe('play');
    expect(restored.locked).toBe(false);
    expect(restored.piece(placed.pieceId).origin).toEqual(placed.origin);
    expect(restored.timerRunning).toBe(true);
    expect(restored.elapsedMs()).toBe(7_000);
  });

  it('restores a solved board without recording the streak again', () => {
    installStorage();
    const today = () => new Date(2026, 10, 16);
    const first = new Game({ persist: true, today, month: 11, day: 16, weekday: 1 });
    const solution = canonicalSolution(11, 16, 1)!;
    for (const placed of solution) {
      expect(first.tryPlace(placed.pieceId, placed.origin, placed.orientationIndex)).toBe(true);
    }
    expect(first.solved).toBe(true);
    expect(first.streak).toBe(1);
    const streakAfterFirst = first.streak;

    const saved = loadSession();
    expect(saved?.solved).toBe(true);
    expect(saved?.savedThisAttempt).toBe(true);

    const restored = new Game({
      persist: true,
      today,
      month: 11,
      day: 16,
      weekday: 1,
      session: saved!,
    });
    expect(restored.solved).toBe(true);
    expect(restored.locked).toBe(true);
    expect(restored.streak).toBe(streakAfterFirst);
    expect(restored.isComplete()).toBe(true);
  });

  it('does not write a session during yesterday preview', () => {
    installStorage();
    const today = () => new Date(2026, 10, 16);
    const game = new Game({ persist: true, today, previewYesterday: true });
    expect(game.mode).toBe('preview');
    expect(loadSession()).toBeNull();
  });

  it('Start today writes an empty play session so refresh does not return to preview', () => {
    installStorage();
    const today = () => new Date(2026, 10, 16);
    const game = new Game({ persist: true, today, previewYesterday: true });
    game.startToday();
    expect(game.mode).toBe('play');
    expect(game.month).toBe(11);
    expect(game.day).toBe(16);
    expect(game.weekday).toBe(1);
    const saved = loadSession();
    expect(saved).not.toBeNull();
    expect(saved?.solved).toBe(false);
    expect(saved?.pieces.every((piece) => piece.location === 'tray')).toBe(true);

    const restored = new Game({ persist: true, today, session: saved! });
    expect(restored.mode).toBe('play');
    expect(restored.month).toBe(11);
    expect(restored.day).toBe(16);
    expect(PIECE_IDS.every((id) => restored.piece(id).location === 'tray')).toBe(true);
  });

  it('ignores an illegal session and can fall back to preview', () => {
    installStorage();
    const today = () => new Date(2026, 10, 16);
    const session = {
      version: 1 as const,
      month: 11,
      day: 16,
      weekday: 1,
      pieces: PIECE_IDS.map((pieceId, index) =>
        index < 2
          ? {
              pieceId,
              orientationIndex: 0,
              location: 'board' as const,
              origin: { r: 2, c: 0 },
            }
          : { pieceId, orientationIndex: 0, location: 'tray' as const, origin: null },
      ),
      selectedId: null,
      hintsUsed: 0,
      solved: false,
      elapsedMs: 0,
      timerRunning: false,
      savedThisAttempt: false,
    };
    expect(isValidSession(session)).toBe(true);
    const game = new Game({
      persist: true,
      today,
      previewYesterday: true,
      session,
    });
    expect(game.mode).toBe('preview');
    expect(game.day).toBe(15); // yesterday Nov 15 2026 is Sunday
  });

  it('undo and reset update or replace the saved session', () => {
    installStorage();
    const today = () => new Date(2026, 10, 16);
    const game = new Game({ persist: true, today, month: 11, day: 16, weekday: 1 });
    const placed = canonicalSolution(11, 16, 1)![0]!;
    game.tryPlace(placed.pieceId, placed.origin, placed.orientationIndex);
    expect(loadSession()?.pieces.find((piece) => piece.pieceId === placed.pieceId)?.location).toBe(
      'board',
    );
    game.undo();
    expect(loadSession()?.pieces.find((piece) => piece.pieceId === placed.pieceId)?.location).toBe(
      'tray',
    );
    game.tryPlace(placed.pieceId, placed.origin, placed.orientationIndex);
    game.reset();
    expect(loadSession()?.pieces.every((piece) => piece.location === 'tray')).toBe(true);
    expect(loadSession()?.elapsedMs).toBe(0);
  });

  it('rejects structurally invalid session JSON', () => {
    installStorage();
    saveSession({
      version: 1,
      month: 11,
      day: 16,
      weekday: 1,
      pieces: [],
      selectedId: null,
      hintsUsed: 0,
      solved: false,
      elapsedMs: 0,
      timerRunning: false,
      savedThisAttempt: false,
    });
    expect(loadSession()).toBeNull();
    clearSession();
    expect(memory.has(SESSION_KEY)).toBe(false);
  });
});
