/** Pure streak and best-time helpers. Clock is injectable for tests. */

export type StreakState = {
  streak: number;
  lastSolved: string | null; // YYYY-MM-DD in the player's local timezone
};

export type BestEntry = {
  timeMs: number;
  hintsUsed: number;
};

export type BestMap = Record<string, BestEntry>; // key = MM-DD-W (W = 0–6 weekday)

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localMonthDay(date: Date): { month: number; day: number } {
  return { month: date.getMonth() + 1, day: date.getDate() };
}

/** Puzzle / best-time key, e.g. "10-06". */
export function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Puzzle / best-time key including weekday, e.g. "10-06-0" for Sunday 6 Oct. */
export function monthDayWeekdayKey(month: number, day: number, weekday: number): string {
  return `${monthDayKey(month, day)}-${weekday}`;
}

export function localMonthDayWeekday(date: Date): { month: number; day: number; weekday: number } {
  return { month: date.getMonth() + 1, day: date.getDate(), weekday: date.getDay() };
}

/** True when the puzzle's month, day, and weekday all match the given local date. */
export function matchesLocalToday(
  month: number,
  day: number,
  weekday: number,
  today: Date,
): boolean {
  return month === today.getMonth() + 1 && day === today.getDate() && weekday === today.getDay();
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new RangeError(`Invalid date key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Add a whole number of calendar days to a YYYY-MM-DD key (local-date arithmetic). */
export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  // Noon UTC is not local-safe across DST; construct a local Date instead.
  const date = new Date(year, month - 1, day + days);
  return localDateKey(date);
}

export function isConsecutiveDay(prev: string, today: string): boolean {
  return addDays(prev, 1) === today;
}

/**
 * Update the daily streak after a solve on `today` (YYYY-MM-DD, local).
 * Same day again leaves the streak unchanged. The next calendar day increments.
 * Any gap resets the streak to 1.
 */
export function recordSolve(prev: StreakState, today: string): StreakState {
  if (prev.lastSolved === today) {
    return { streak: Math.max(prev.streak, 1), lastSolved: today };
  }
  if (prev.lastSolved && isConsecutiveDay(prev.lastSolved, today)) {
    return { streak: prev.streak + 1, lastSolved: today };
  }
  return { streak: 1, lastSolved: today };
}

/**
 * Keep a best time only when the new time is strictly faster.
 * The hint count stored is the count from that faster attempt.
 */
export function recordBest(
  best: BestMap,
  dateKey: string,
  timeMs: number,
  hintsUsed: number,
): { best: BestMap; updated: boolean } {
  const previous = best[dateKey];
  if (previous && timeMs >= previous.timeMs) {
    return { best, updated: false };
  }
  return {
    best: { ...best, [dateKey]: { timeMs, hintsUsed } },
    updated: true,
  };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
