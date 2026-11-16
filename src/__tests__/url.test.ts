import { describe, expect, it } from 'vitest';
import { parsePuzzleParams, puzzleSearch, replacePuzzleUrl, samePuzzleDate } from '../url';
import { resolveStart } from '../start';
import { SESSION_VERSION, type SessionState } from '../storage';
import { PIECE_IDS } from '../pieces';

function emptySession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    version: SESSION_VERSION,
    month: 11,
    day: 16,
    weekday: 1,
    pieces: PIECE_IDS.map((pieceId) => ({
      pieceId,
      orientationIndex: 0,
      location: 'tray' as const,
      origin: null,
    })),
    selectedId: null,
    hintsUsed: 0,
    solved: false,
    elapsedMs: 0,
    timerRunning: false,
    savedThisAttempt: false,
    ...overrides,
  };
}

describe('parsePuzzleParams', () => {
  it('reads m, d, and w', () => {
    expect(parsePuzzleParams('?m=11&d=16&w=1')).toEqual({ month: 11, day: 16, weekday: 1 });
    expect(parsePuzzleParams('m=1&d=1&w=0')).toEqual({ month: 1, day: 1, weekday: 0 });
  });

  it('allows day 31 even in short months, because the board has that cell', () => {
    expect(parsePuzzleParams('?m=4&d=31&w=2')).toEqual({ month: 4, day: 31, weekday: 2 });
  });

  it('derives weekday from date=YYYY-MM-DD in local time', () => {
    // 16 Nov 2026 is a Monday.
    expect(parsePuzzleParams('?date=2026-11-16')).toEqual({ month: 11, day: 16, weekday: 1 });
  });

  it('prefers m/d/w when all three are valid, even if date is also present', () => {
    expect(parsePuzzleParams('?date=2026-11-16&m=3&d=14&w=6')).toEqual({
      month: 3,
      day: 14,
      weekday: 6,
    });
  });

  it('rejects incomplete, out-of-range, and overflowing dates', () => {
    expect(parsePuzzleParams('')).toBeNull();
    expect(parsePuzzleParams('?m=11&d=16')).toBeNull();
    expect(parsePuzzleParams('?m=13&d=1&w=0')).toBeNull();
    expect(parsePuzzleParams('?m=1&d=32&w=0')).toBeNull();
    expect(parsePuzzleParams('?m=1&d=1&w=7')).toBeNull();
    expect(parsePuzzleParams('?date=2026-02-31')).toBeNull();
    expect(parsePuzzleParams('?date=2026-13-01')).toBeNull();
    expect(parsePuzzleParams('?m=11.5&d=16&w=1')).toBeNull();
  });
});

describe('puzzleSearch', () => {
  it('omits params in preview and writes m/d/w in play', () => {
    const date = { month: 11, day: 16, weekday: 1 };
    expect(puzzleSearch(date, 'preview')).toBe('');
    expect(puzzleSearch(date, 'play')).toBe('?m=11&d=16&w=1');
  });
});

describe('replacePuzzleUrl', () => {
  it('replaceState only when the URL would change', () => {
    const calls: string[] = [];
    const loc = { pathname: '/', search: '', hash: '' };
    const hist = { replaceState: (_s: unknown, _t: string, url: string) => calls.push(url) };
    replacePuzzleUrl({ month: 11, day: 16, weekday: 1 }, 'preview', loc, hist);
    expect(calls).toEqual([]);
    replacePuzzleUrl({ month: 11, day: 16, weekday: 1 }, 'play', loc, hist);
    expect(calls).toEqual(['/?m=11&d=16&w=1']);
  });
});

describe('samePuzzleDate', () => {
  it('compares month, day, and weekday', () => {
    expect(samePuzzleDate({ month: 1, day: 1, weekday: 0 }, { month: 1, day: 1, weekday: 0 })).toBe(true);
    expect(samePuzzleDate({ month: 1, day: 1, weekday: 0 }, { month: 1, day: 1, weekday: 1 })).toBe(false);
  });
});

describe('resolveStart', () => {
  it('uses yesterday preview when there is no URL and no session', () => {
    expect(resolveStart({ previewYesterday: true })).toEqual({ previewYesterday: true });
  });

  it('restores a session when the URL is empty', () => {
    const session = emptySession();
    expect(resolveStart({ previewYesterday: true, session })).toEqual({
      month: 11,
      day: 16,
      weekday: 1,
      session,
    });
  });

  it('starts a fresh play for a URL date, or restores when the session matches', () => {
    const session = emptySession();
    expect(resolveStart({ search: '?m=3&d=14&w=6', previewYesterday: true, session })).toEqual({
      month: 3,
      day: 14,
      weekday: 6,
    });
    expect(resolveStart({ search: '?m=11&d=16&w=1', previewYesterday: true, session })).toEqual({
      month: 11,
      day: 16,
      weekday: 1,
      session,
    });
  });

  it('uses a date= link as a playable date, not a preview', () => {
    expect(resolveStart({ search: '?date=2026-11-16', previewYesterday: true })).toEqual({
      month: 11,
      day: 16,
      weekday: 1,
    });
  });
});
