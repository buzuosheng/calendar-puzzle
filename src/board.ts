/** 8×7 weekday calendar board: 50 playable cells, 6 unused. */

import {
  type Locale,
  EN_MONTH_LABELS,
  EN_WEEKDAY_LABELS,
  EN_WEEKDAY_FULL_LABELS,
  formatDateHeading,
  monthLabels,
  weekdayLabels,
} from './i18n';

export const ROWS = 8;
export const COLS = 7;
export const PLAYABLE_CELLS = 50;
export const COVER_CELLS = 47;

export type Cell = { readonly r: number; readonly c: number };

/** English month labels; prefer monthLabels(locale) for UI. */
export const MONTH_LABELS = EN_MONTH_LABELS;

/** Short English weekday labels, index-aligned with Date#getDay() (0 = Sunday). */
export const WEEKDAY_LABELS = EN_WEEKDAY_LABELS;

/** Full English weekday names for the date picker, same index order. */
export const WEEKDAY_FULL_LABELS = EN_WEEKDAY_FULL_LABELS;

/** Days in each month for the 366-date calendar, including Feb 29. */
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Unused cells: unplayable, shown as continuous wood with recessed plaques. */
export const UNUSED_CELLS: readonly Cell[] = [
  { r: 0, c: 6 },
  { r: 1, c: 6 },
  { r: 7, c: 0 },
  { r: 7, c: 1 },
  { r: 7, c: 2 },
  { r: 7, c: 3 },
];

const unusedSet = new Set(UNUSED_CELLS.map(cellKey));

export function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

export function cellIndex(r: number, c: number): number {
  return r * COLS + c;
}

export function cellFromIndex(index: number): Cell {
  return { r: Math.floor(index / COLS), c: index % COLS };
}

export function bitOf(r: number, c: number): bigint {
  return 1n << BigInt(cellIndex(r, c));
}

export function isInBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

export function isUnused(r: number, c: number): boolean {
  return unusedSet.has(`${r},${c}`);
}

export function isPlayable(r: number, c: number): boolean {
  return isInBounds(r, c) && !isUnused(r, c);
}

/** Month 1–12 → board cell (Jan–Jun on row 0, Jul–Dec on row 1). */
export function monthCell(month: number): Cell {
  const i = month - 1;
  if (i < 0 || i > 11) {
    throw new RangeError(`month must be 1–12, got ${month}`);
  }
  return i < 6 ? { r: 0, c: i } : { r: 1, c: i - 6 };
}

/** Day 1–31 → board cell, row-major starting at (2, 0). */
export function dayCell(day: number): Cell {
  if (day < 1 || day > 31) {
    throw new RangeError(`day must be 1–31, got ${day}`);
  }
  const i = day - 1;
  return { r: 2 + Math.floor(i / COLS), c: i % COLS };
}

/**
 * Weekday 0–6 (Sunday–Saturday, same as Date#getDay()) → board cell.
 * Sun–Wed sit on row 6 after day 31; Thu–Sat occupy the last three cells of row 7.
 */
export function weekdayCell(weekday: number): Cell {
  if (weekday < 0 || weekday > 6) {
    throw new RangeError(`weekday must be 0–6, got ${weekday}`);
  }
  if (weekday <= 3) return { r: 6, c: 3 + weekday };
  return { r: 7, c: weekday };
}

export function labelFor(r: number, c: number, locale: Locale = 'en'): string | null {
  if (!isPlayable(r, c)) return null;
  const months = monthLabels(locale);
  const weekdays = weekdayLabels(locale);
  if (r === 0 && c <= 5) return months[c] ?? null;
  if (r === 1 && c <= 5) return months[6 + c] ?? null;
  if (r >= 2 && r <= 6) {
    const day = (r - 2) * COLS + c + 1;
    if (day >= 1 && day <= 31) return String(day);
  }
  if (r === 6 && c >= 3 && c <= 6) return weekdays[c - 3] ?? null;
  if (r === 7 && c >= 4 && c <= 6) return weekdays[c] ?? null;
  return null;
}

function maskFromCells(cells: readonly Cell[]): bigint {
  let mask = 0n;
  for (const { r, c } of cells) mask |= bitOf(r, c);
  return mask;
}

export const UNUSED_MASK = maskFromCells(UNUSED_CELLS);

/** Bits for all 50 playable squares (8×7 = 56 bits, minus 6 unused). */
export const FULL_BOARD_MASK: bigint = ((1n << BigInt(ROWS * COLS)) - 1n) ^ UNUSED_MASK;

export function dateMask(month: number, day: number, weekday: number): bigint {
  const m = monthCell(month);
  const d = dayCell(day);
  const w = weekdayCell(weekday);
  return bitOf(m.r, m.c) | bitOf(d.r, d.c) | bitOf(w.r, w.c);
}

/** Playable cells that must be covered for a given date (47 bits). */
export function coverMask(month: number, day: number, weekday: number): bigint {
  return FULL_BOARD_MASK & ~dateMask(month, day, weekday);
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

export function sameCellSet(a: readonly Cell[], b: readonly Cell[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(cellKey));
  return b.every((cell) => keys.has(cellKey(cell)));
}

export type CalendarDate = { month: number; day: number };

export type CalendarPuzzle = { month: number; day: number; weekday: number };

/** All 366 calendar dates, including Feb 29. */
export function allCalendarDates(): CalendarDate[] {
  const dates: CalendarDate[] = [];
  for (let month = 1; month <= 12; month++) {
    const days = DAYS_IN_MONTH[month - 1] ?? 0;
    for (let day = 1; day <= days; day++) {
      dates.push({ month, day });
    }
  }
  return dates;
}

/** All 366 × 7 = 2562 month/day/weekday combinations, including Feb 29. */
export function allCalendarPuzzles(): CalendarPuzzle[] {
  const puzzles: CalendarPuzzle[] = [];
  for (const { month, day } of allCalendarDates()) {
    for (let weekday = 0; weekday < 7; weekday++) {
      puzzles.push({ month, day, weekday });
    }
  }
  return puzzles;
}

/** Heading style: short weekday, short month, day — e.g. "Sun, Nov 15". */
export function dateLabel(
  month: number,
  day: number,
  weekday: number,
  locale: Locale = 'en',
): string {
  return formatDateHeading(locale, month, day, weekday);
}
