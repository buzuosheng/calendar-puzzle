/** English and Simplified Chinese copy for the Calendar Puzzle UI. */

export type Locale = 'en' | 'zh-Hans';

export const LANG_KEY = 'calendar-puzzle:lang';

export const LOCALES: readonly Locale[] = ['en', 'zh-Hans'] as const;

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-Hans';
}

/** True when a BCP 47 (or underscore) tag has primary subtag `zh`. */
export function isZhTag(tag: string): boolean {
  const primary = tag.trim().replace(/_/g, '-').split('-')[0]?.toLowerCase();
  return primary === 'zh';
}

/**
 * Resolve the active locale. A saved `en` | `zh-Hans` preference wins.
 * Otherwise any `zh*` browser language defaults to `zh-Hans`, else `en`.
 */
export function resolveLocale(
  saved: string | null | undefined,
  browserLanguage: string | null | undefined,
): Locale {
  if (isLocale(saved)) return saved;
  if (browserLanguage && isZhTag(browserLanguage)) return 'zh-Hans';
  return 'en';
}

function storageOr(explicit?: Storage | null): Storage | null {
  if (explicit !== undefined) return explicit;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadLocale(
  storage?: Storage | null,
  browserLanguage?: string | null,
): Locale {
  let saved: string | null = null;
  try {
    saved = storageOr(storage)?.getItem(LANG_KEY) ?? null;
  } catch {
    saved = null;
  }
  const lang =
    browserLanguage !== undefined
      ? browserLanguage
      : typeof navigator !== 'undefined'
        ? navigator.language
        : undefined;
  return resolveLocale(saved, lang);
}

export function saveLocale(locale: Locale, storage?: Storage | null): void {
  try {
    storageOr(storage)?.setItem(LANG_KEY, locale);
  } catch {
    // Quota or private-mode failures are ignored; the UI still switches.
  }
}

export const EN_MONTH_LABELS = [
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

export const ZH_MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
] as const;

/** Short weekday labels on the board, Sunday-first. */
export const EN_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const ZH_WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** Full weekday names in the date picker, Sunday-first. */
export const EN_WEEKDAY_FULL_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const ZH_WEEKDAY_FULL_LABELS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
] as const;

/** Short weekday used in the date heading, e.g. 周日. */
export const ZH_HEADING_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const KBD = {
  r: '<kbd>R</kbd>',
  f: '<kbd>F</kbd>',
  h: '<kbd>H</kbd>',
  ctrl: '<kbd>Ctrl</kbd>',
  cmd: '<kbd>⌘</kbd>',
  z: '<kbd>Z</kbd>',
} as const;

export type Messages = {
  title: string;
  today: string;
  startToday: string;
  month: string;
  day: string;
  weekday: string;
  time: string;
  hints: string;
  streak: string;
  best: string;
  rotate: string;
  flip: string;
  hint: string;
  undo: string;
  reset: string;
  pieces: string;
  date: string;
  leaveOpen: string;
  solved: string;
  share: string;
  saveImage: string;
  language: string;
  playHowToHtml: string;
  previewHowToHtml: string;
  months: readonly string[];
  weekdaysBoard: readonly string[];
  weekdaysPicker: readonly string[];
  boardAria: string;
  trayAria: string;
  controlsAria: string;
};

const EN: Messages = {
  title: 'Calendar Puzzle',
  today: 'Today',
  startToday: 'Start today',
  month: 'Month',
  day: 'Day',
  weekday: 'Weekday',
  time: 'Time',
  hints: 'Hints',
  streak: 'Streak',
  best: 'Best',
  rotate: 'Rotate',
  flip: 'Flip',
  hint: 'Hint',
  undo: 'Undo',
  reset: 'Reset',
  pieces: 'Pieces',
  date: 'Date',
  leaveOpen: 'Leave these open',
  solved: 'Solved',
  share: 'Share',
  saveImage: 'Save image',
  language: 'Language',
  playHowToHtml: `Leave the month, day, and weekday uncovered. Drag to place, or use ${KBD.r}, ${KBD.f}, ${KBD.h}, and ${KBD.ctrl}/${KBD.cmd}+${KBD.z}.`,
  previewHowToHtml: "Yesterday's solution. Start today's challenge when you're ready.",
  months: EN_MONTH_LABELS,
  weekdaysBoard: EN_WEEKDAY_LABELS,
  weekdaysPicker: EN_WEEKDAY_FULL_LABELS,
  boardAria: 'Calendar board',
  trayAria: 'Piece tray',
  controlsAria: 'Puzzle controls',
};

const ZH: Messages = {
  title: '日历拼图',
  today: '今天',
  startToday: '开始今日挑战',
  month: '月份',
  day: '日',
  weekday: '星期',
  time: '用时',
  hints: '提示',
  streak: '连续',
  best: '最佳',
  rotate: '旋转',
  flip: '翻转',
  hint: '提示',
  undo: '撤销',
  reset: '重置',
  pieces: '木片',
  date: '日期',
  leaveOpen: '请留空',
  solved: '已完成',
  share: '分享',
  saveImage: '保存图片',
  language: '语言',
  playHowToHtml: `将月份、日期和星期三个格子留空。拖动木片放置，或使用 ${KBD.r}、${KBD.f}、${KBD.h}，以及 ${KBD.ctrl}/${KBD.cmd}+${KBD.z}。`,
  previewHowToHtml: '这是昨天的解答。准备好后，开始今日挑战。',
  months: ZH_MONTH_LABELS,
  weekdaysBoard: ZH_WEEKDAY_LABELS,
  weekdaysPicker: ZH_WEEKDAY_FULL_LABELS,
  boardAria: '日历棋盘',
  trayAria: '木片托盘',
  controlsAria: '拼图控制',
};

export function t(locale: Locale): Messages {
  return locale === 'zh-Hans' ? ZH : EN;
}

export function monthLabels(locale: Locale): readonly string[] {
  return t(locale).months;
}

export function weekdayLabels(locale: Locale): readonly string[] {
  return t(locale).weekdaysBoard;
}

export function weekdayFullLabels(locale: Locale): readonly string[] {
  return t(locale).weekdaysPicker;
}

/** Heading: "Sun, Nov 15" or "周日，11月15日". */
export function formatDateHeading(
  locale: Locale,
  month: number,
  day: number,
  weekday: number,
): string {
  if (locale === 'zh-Hans') {
    const week = ZH_HEADING_WEEKDAYS[weekday] ?? '???';
    return `${week}，${month}月${day}日`;
  }
  const week = EN_WEEKDAY_LABELS[weekday] ?? '???';
  const name = EN_MONTH_LABELS[month - 1] ?? '???';
  return `${week}, ${name} ${day}`;
}

/** Solved banner and best-time body, e.g. "Time 1:23 · 2 hints". */
export function formatSolveStats(locale: Locale, timeLabel: string, hintsUsed: number): string {
  if (locale === 'zh-Hans') {
    return `用时 ${timeLabel} · ${hintsUsed} 次提示`;
  }
  const hintWord = hintsUsed === 1 ? 'hint' : 'hints';
  return `Time ${timeLabel} · ${hintsUsed} ${hintWord}`;
}

export function documentLang(locale: Locale): string {
  return locale === 'zh-Hans' ? 'zh-Hans' : 'en';
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = documentLang(locale);
  document.title = t(locale).title;
}
