import { describe, expect, it } from 'vitest';
import {
  addDays,
  isConsecutiveDay,
  localDateKey,
  localMonthDay,
  localMonthDayWeekday,
  matchesLocalToday,
  monthDayWeekdayKey,
  recordBest,
  recordSolve,
  formatTime,
} from '../streak';
import { saveSolve, loadProgress, bestFor } from '../storage';

describe('streak logic', () => {
  it('starts a streak at 1 on the first solve', () => {
    expect(recordSolve({ streak: 0, lastSolved: null }, '2026-11-15')).toEqual({
      streak: 1,
      lastSolved: '2026-11-15',
    });
  });

  it('does not increment when the same local day is solved again', () => {
    const once = recordSolve({ streak: 4, lastSolved: '2026-11-15' }, '2026-11-15');
    expect(once).toEqual({ streak: 4, lastSolved: '2026-11-15' });
  });

  it('increments on the next calendar day, including across midnight month and year boundaries', () => {
    expect(recordSolve({ streak: 4, lastSolved: '2026-11-15' }, '2026-11-16')).toEqual({
      streak: 5,
      lastSolved: '2026-11-16',
    });
    expect(isConsecutiveDay('2026-11-30', '2026-12-01')).toBe(true);
    expect(recordSolve({ streak: 2, lastSolved: '2026-12-31' }, '2027-01-01')).toEqual({
      streak: 3,
      lastSolved: '2027-01-01',
    });
  });

  it('resets to 1 if a day is skipped', () => {
    expect(recordSolve({ streak: 9, lastSolved: '2026-11-15' }, '2026-11-17')).toEqual({
      streak: 1,
      lastSolved: '2026-11-17',
    });
  });

  it('treats Feb 28 → Feb 29 (leap) and Feb 29 → Mar 1 as consecutive', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(isConsecutiveDay('2024-02-28', '2024-02-29')).toBe(true);
    expect(isConsecutiveDay('2024-02-29', '2024-03-01')).toBe(true);
    expect(isConsecutiveDay('2023-02-28', '2023-03-01')).toBe(true);
    expect(isConsecutiveDay('2023-02-28', '2023-02-29')).toBe(false);
  });

  it('uses the local timezone of an injectable Date clock', () => {
    const clock = new Date(2026, 10, 15, 23, 30, 0); // 15 Nov 2026 23:30 local
    expect(localDateKey(clock)).toBe('2026-11-15');
    expect(localMonthDay(clock)).toEqual({ month: 11, day: 15 });
    expect(localMonthDayWeekday(clock)).toEqual({ month: 11, day: 15, weekday: 0 });
    const afterMidnight = new Date(2026, 10, 16, 0, 5, 0);
    expect(localDateKey(afterMidnight)).toBe('2026-11-16');
    expect(isConsecutiveDay(localDateKey(clock), localDateKey(afterMidnight))).toBe(true);
  });

  it('counts a solve for today only when month, day, and weekday all match', () => {
    const today = new Date(2026, 10, 15, 10, 0, 0); // Sunday 15 Nov 2026
    expect(matchesLocalToday(11, 15, 0, today)).toBe(true);
    expect(matchesLocalToday(11, 15, 1, today)).toBe(false);
    expect(matchesLocalToday(11, 16, 0, today)).toBe(false);
    expect(matchesLocalToday(10, 15, 0, today)).toBe(false);
  });
});

describe('best times', () => {
  it('stores the first time and only updates when strictly faster, keeping that run’s hint count', () => {
    const key = monthDayWeekdayKey(11, 15, 0);
    expect(key).toBe('11-15-0');
    const first = recordBest({}, key, 90_000, 3);
    expect(first.updated).toBe(true);
    expect(first.best[key]).toEqual({ timeMs: 90_000, hintsUsed: 3 });

    const same = recordBest(first.best, key, 90_000, 0);
    expect(same.updated).toBe(false);
    expect(same.best[key]).toEqual({ timeMs: 90_000, hintsUsed: 3 });

    const slower = recordBest(first.best, key, 91_000, 0);
    expect(slower.updated).toBe(false);

    const faster = recordBest(first.best, key, 80_000, 2);
    expect(faster.updated).toBe(true);
    expect(faster.best[key]).toEqual({ timeMs: 80_000, hintsUsed: 2 });

    // A different weekday is a different puzzle and does not overwrite this best.
    const monday = recordBest(faster.best, monthDayWeekdayKey(11, 15, 1), 70_000, 0);
    expect(monday.best[key]).toEqual({ timeMs: 80_000, hintsUsed: 2 });
    expect(monday.best['11-15-1']).toEqual({ timeMs: 70_000, hintsUsed: 0 });
  });

  it('formats times as m:ss and h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(1_000)).toBe('0:01');
    expect(formatTime(125_000)).toBe('2:05');
    expect(formatTime(3_661_000)).toBe('1:01:01');
  });
});

describe('saveSolve today and best-time keys', () => {
  const memory = new Map<string, string>();

  function installStorage() {
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: (index: number) => [...memory.keys()][index] ?? null,
      get length() {
        return memory.size;
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
  }

  it('records a streak only when the puzzle matches the real local today', () => {
    memory.clear();
    installStorage();
    const today = new Date(2026, 10, 15, 10, 0, 0); // Sunday

    const offDay = saveSolve({
      month: 11,
      day: 15,
      weekday: 1,
      timeMs: 12_000,
      hintsUsed: 0,
      today,
    });
    expect(offDay.streak).toEqual({ streak: 0, lastSolved: null });
    expect(bestFor(offDay.best, 11, 15, 1)).toEqual({ timeMs: 12_000, hintsUsed: 0 });
    // Old MM-DD keys are not used for the weekday puzzle.
    expect(bestFor(offDay.best, 11, 15, 0)).toBeNull();

    const onToday = saveSolve({
      month: 11,
      day: 15,
      weekday: 0,
      timeMs: 9_000,
      hintsUsed: 1,
      today,
    });
    expect(onToday.streak).toEqual({ streak: 1, lastSolved: '2026-11-15' });
    expect(bestFor(onToday.best, 11, 15, 0)).toEqual({ timeMs: 9_000, hintsUsed: 1 });
    expect(bestFor(onToday.best, 11, 15, 1)).toEqual({ timeMs: 12_000, hintsUsed: 0 });

    const loaded = loadProgress();
    expect(loaded.streak).toEqual({ streak: 1, lastSolved: '2026-11-15' });
  });
});
