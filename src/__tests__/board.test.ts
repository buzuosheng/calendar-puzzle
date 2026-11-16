import { describe, expect, it } from 'vitest';
import {
  COLS,
  ROWS,
  UNUSED_CELLS,
  PLAYABLE_CELLS,
  FULL_BOARD_MASK,
  allCalendarDates,
  allCalendarPuzzles,
  dayCell,
  dateLabel,
  labelFor,
  monthCell,
  weekdayCell,
  isPlayable,
  isUnused,
} from '../board';

describe('weekday calendar board', () => {
  it('is an 8×7 grid with 50 playable cells and the standard unused notches', () => {
    expect(ROWS).toBe(8);
    expect(COLS).toBe(7);
    let playable = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isPlayable(r, c)) playable += 1;
      }
    }
    expect(playable).toBe(PLAYABLE_CELLS);
    expect(UNUSED_CELLS).toEqual([
      { r: 0, c: 6 },
      { r: 1, c: 6 },
      { r: 7, c: 0 },
      { r: 7, c: 1 },
      { r: 7, c: 2 },
      { r: 7, c: 3 },
    ]);
    expect(isUnused(7, 3)).toBe(true);
    expect(isUnused(6, 3)).toBe(false);
    expect(FULL_BOARD_MASK.toString(2).replace(/0/g, '').length).toBe(50);
  });

  it('maps months, days, and weekdays to the standard cells and labels', () => {
    expect(monthCell(1)).toEqual({ r: 0, c: 0 });
    expect(monthCell(6)).toEqual({ r: 0, c: 5 });
    expect(monthCell(7)).toEqual({ r: 1, c: 0 });
    expect(monthCell(12)).toEqual({ r: 1, c: 5 });
    expect(dayCell(1)).toEqual({ r: 2, c: 0 });
    expect(dayCell(31)).toEqual({ r: 6, c: 2 });
    expect(weekdayCell(0)).toEqual({ r: 6, c: 3 });
    expect(weekdayCell(3)).toEqual({ r: 6, c: 6 });
    expect(weekdayCell(4)).toEqual({ r: 7, c: 4 });
    expect(weekdayCell(6)).toEqual({ r: 7, c: 6 });

    expect(labelFor(0, 0)).toBe('Jan');
    expect(labelFor(1, 5)).toBe('Dec');
    expect(labelFor(6, 2)).toBe('31');
    expect(labelFor(6, 3)).toBe('Sun');
    expect(labelFor(6, 6)).toBe('Wed');
    expect(labelFor(7, 4)).toBe('Thu');
    expect(labelFor(7, 6)).toBe('Sat');
    expect(labelFor(7, 0)).toBeNull();
    expect(dateLabel(11, 15, 0)).toBe('Sun, Nov 15');
  });

  it('enumerates 366 dates and 2562 puzzles, skipping invalid days', () => {
    expect(allCalendarDates()).toHaveLength(366);
    expect(allCalendarPuzzles()).toHaveLength(2562);
    expect(allCalendarDates()).not.toContainEqual({ month: 4, day: 31 });
  });
});
