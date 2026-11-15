/** 7×7 DragonFjord calendar board: 43 playable cells, 6 unused. */

export const ROWS = 7;
export const COLS = 7;

export type Cell = { readonly r: number; readonly c: number };

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Days in each month for the 366-date calendar, including Feb 29. */
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Unused (notched) cells, shown as absent wood. */
export const UNUSED_CELLS: readonly Cell[] = [
  { r: 0, c: 6 },
  { r: 1, c: 6 },
  { r: 6, c: 3 },
  { r: 6, c: 4 },
  { r: 6, c: 5 },
  { r: 6, c: 6 },
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

export function labelFor(r: number, c: number): string | null {
  if (!isPlayable(r, c)) return null;
  if (r === 0 && c <= 5) return MONTH_LABELS[c] ?? null;
  if (r === 1 && c <= 5) return MONTH_LABELS[6 + c] ?? null;
  if (r >= 2) {
    const day = (r - 2) * COLS + c + 1;
    if (day >= 1 && day <= 31) return String(day);
  }
  return null;
}

function maskFromCells(cells: readonly Cell[]): bigint {
  let mask = 0n;
  for (const { r, c } of cells) mask |= bitOf(r, c);
  return mask;
}

export const UNUSED_MASK = maskFromCells(UNUSED_CELLS);

/** Bits for all 43 playable squares. */
export const FULL_BOARD_MASK: bigint = ((1n << 49n) - 1n) ^ UNUSED_MASK;

export function dateMask(month: number, day: number): bigint {
  const m = monthCell(month);
  const d = dayCell(day);
  return bitOf(m.r, m.c) | bitOf(d.r, d.c);
}

/** Playable cells that must be covered for a given date (41 bits). */
export function coverMask(month: number, day: number): bigint {
  return FULL_BOARD_MASK & ~dateMask(month, day);
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

export function dateLabel(month: number, day: number): string {
  const name = MONTH_LABELS[month - 1] ?? '???';
  return `${name} ${day}`;
}
