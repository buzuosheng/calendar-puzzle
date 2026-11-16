import {
  type BestMap,
  type StreakState,
  localDateKey,
  matchesLocalToday,
  monthDayWeekdayKey,
  recordBest,
  recordSolve,
} from './streak';

export const STORAGE_PREFIX = 'calendar-puzzle:';

const KEYS = {
  streak: `${STORAGE_PREFIX}streak`,
  lastSolved: `${STORAGE_PREFIX}lastSolved`,
  best: `${STORAGE_PREFIX}best`,
} as const;

function store(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const s = store();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, value);
  } catch {
    // Quota or private-mode failures are ignored; the game still runs.
  }
}

export function loadStreak(): StreakState {
  const lastSolved = store()?.getItem(KEYS.lastSolved) ?? null;
  const raw = store()?.getItem(KEYS.streak);
  const parsed = raw != null ? Number(raw) : 0;
  const streak = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  return { streak, lastSolved };
}

export function loadBest(): BestMap {
  const data = readJson<BestMap>(KEYS.best, {});
  if (!data || typeof data !== 'object') return {};
  const cleaned: BestMap = {};
  for (const [key, entry] of Object.entries(data)) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.timeMs === 'number' &&
      typeof entry.hintsUsed === 'number'
    ) {
      cleaned[key] = { timeMs: entry.timeMs, hintsUsed: entry.hintsUsed };
    }
  }
  return cleaned;
}

export type Progress = {
  streak: StreakState;
  best: BestMap;
};

export function loadProgress(): Progress {
  return { streak: loadStreak(), best: loadBest() };
}

export function saveSolve(options: {
  month: number;
  day: number;
  weekday: number;
  timeMs: number;
  hintsUsed: number;
  today?: Date;
}): Progress {
  const today = options.today ?? new Date();
  // A solve only counts toward the daily streak when the puzzle is today's
  // real local month, day, and weekday. Best times are always recorded.
  // Old MM-DD best-time keys are left in the map and ignored.
  const countsForStreak = matchesLocalToday(options.month, options.day, options.weekday, today);
  const streak = countsForStreak ? recordSolve(loadStreak(), localDateKey(today)) : loadStreak();
  const { best } = recordBest(
    loadBest(),
    monthDayWeekdayKey(options.month, options.day, options.weekday),
    options.timeMs,
    options.hintsUsed,
  );
  if (countsForStreak) {
    write(KEYS.streak, String(streak.streak));
    if (streak.lastSolved) write(KEYS.lastSolved, streak.lastSolved);
  }
  write(KEYS.best, JSON.stringify(best));
  return { streak, best };
}

export function bestFor(best: BestMap, month: number, day: number, weekday: number) {
  return best[monthDayWeekdayKey(month, day, weekday)] ?? null;
}
