export type PuzzleDate = {
  month: number;
  day: number;
  weekday: number;
};

function parseIntField(raw: string | null, min: number, max: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  if (!/^-?\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

/** Parse `?m=11&d=16&w=1`, or `?date=2026-11-16` (weekday from that local calendar date). */
export function parsePuzzleParams(search: string): PuzzleDate | null {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);

  const month = parseIntField(params.get('m'), 1, 12);
  const day = parseIntField(params.get('d'), 1, 31);
  const weekday = parseIntField(params.get('w'), 0, 6);
  if (month != null && day != null && weekday != null) {
    return { month, day, weekday };
  }

  const iso = params.get('date');
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  const dayNum = Number(match[3]);
  const date = new Date(year, monthNum - 1, dayNum);
  if (date.getFullYear() !== year || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
    return null;
  }
  return { month: date.getMonth() + 1, day: date.getDate(), weekday: date.getDay() };
}

export function puzzleSearch(date: PuzzleDate, mode: 'preview' | 'play'): string {
  if (mode === 'preview') return '';
  return `?m=${date.month}&d=${date.day}&w=${date.weekday}`;
}

export function replacePuzzleUrl(
  date: PuzzleDate,
  mode: 'preview' | 'play',
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
  hist: Pick<History, 'replaceState'> = window.history,
): void {
  const next = `${loc.pathname}${puzzleSearch(date, mode)}${loc.hash}`;
  const current = `${loc.pathname}${loc.search}${loc.hash}`;
  if (next !== current) {
    hist.replaceState(null, '', next);
  }
}

export function samePuzzleDate(a: PuzzleDate, b: PuzzleDate): boolean {
  return a.month === b.month && a.day === b.day && a.weekday === b.weekday;
}
