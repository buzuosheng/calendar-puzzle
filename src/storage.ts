import {
  type BestMap,
  type StreakState,
  localDateKey,
  matchesLocalToday,
  monthDayWeekdayKey,
  recordBest,
  recordSolve,
} from './streak';
import { PIECE_IDS, type PieceId, ORIENTATIONS } from './pieces';

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


export const SESSION_KEY = `${STORAGE_PREFIX}session`;
export const SESSION_VERSION = 1 as const;

export type SessionPiece = {
  pieceId: PieceId;
  orientationIndex: number;
  location: 'tray' | 'board';
  origin: { r: number; c: number } | null;
};

export type SessionState = {
  version: typeof SESSION_VERSION;
  month: number;
  day: number;
  weekday: number;
  pieces: SessionPiece[];
  selectedId: PieceId | null;
  hintsUsed: number;
  solved: boolean;
  elapsedMs: number;
  timerRunning: boolean;
  startedAt?: number | null;
  savedThisAttempt: boolean;
};

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isValidSession(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SessionState>;
  if (data.version !== SESSION_VERSION) return false;
  if (!isIntInRange(data.month, 1, 12)) return false;
  if (!isIntInRange(data.day, 1, 31)) return false;
  if (!isIntInRange(data.weekday, 0, 6)) return false;
  if (!isIntInRange(data.hintsUsed, 0, 10_000)) return false;
  if (typeof data.elapsedMs !== 'number' || !Number.isFinite(data.elapsedMs) || data.elapsedMs < 0) {
    return false;
  }
  if (typeof data.solved !== 'boolean' || typeof data.timerRunning !== 'boolean') return false;
  if (data.startedAt != null && (typeof data.startedAt !== 'number' || !Number.isFinite(data.startedAt))) {
    return false;
  }
  if (typeof data.savedThisAttempt !== 'boolean') return false;
  if (data.selectedId != null && !PIECE_IDS.includes(data.selectedId as PieceId)) return false;
  if (!Array.isArray(data.pieces) || data.pieces.length !== PIECE_IDS.length) return false;
  const seen = new Set<string>();
  for (const piece of data.pieces) {
    if (!piece || typeof piece !== 'object') return false;
    if (!PIECE_IDS.includes(piece.pieceId as PieceId) || seen.has(piece.pieceId)) return false;
    seen.add(piece.pieceId);
    if (!isIntInRange(piece.orientationIndex, 0, 15)) return false;
    if (!ORIENTATIONS[piece.pieceId as PieceId]?.[piece.orientationIndex]) return false;
    if (piece.location !== 'tray' && piece.location !== 'board') return false;
    if (piece.location === 'tray') {
      if (piece.origin != null) return false;
    } else {
      const origin = piece.origin;
      if (!origin || typeof origin !== 'object') return false;
      if (!isIntInRange(origin.r, 0, 7) || !isIntInRange(origin.c, 0, 6)) return false;
    }
  }
  return seen.size === PIECE_IDS.length;
}

export function loadSession(): SessionState | null {
  const data = readJson<unknown>(SESSION_KEY, null);
  return isValidSession(data) ? data : null;
}

export function saveSession(session: SessionState): void {
  write(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(SESSION_KEY);
  } catch {
    // Private-mode failures are ignored.
  }
}
