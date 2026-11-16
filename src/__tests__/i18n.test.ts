import { describe, expect, it } from 'vitest';
import { dateLabel, labelFor } from '../board';
import {
  LANG_KEY,
  formatDateHeading,
  formatSolveStats,
  loadLocale,
  resolveLocale,
  saveLocale,
  t,
} from '../i18n';

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('locale resolution', () => {
  it('lets a saved preference win over the browser language', () => {
    expect(resolveLocale('en', 'zh-CN')).toBe('en');
    expect(resolveLocale('zh-Hans', 'en-US')).toBe('zh-Hans');
  });

  it('defaults any zh* browser tag to zh-Hans, otherwise en', () => {
    expect(resolveLocale(null, 'zh')).toBe('zh-Hans');
    expect(resolveLocale(null, 'zh-CN')).toBe('zh-Hans');
    expect(resolveLocale(null, 'zh-Hans')).toBe('zh-Hans');
    expect(resolveLocale(null, 'zh-TW')).toBe('zh-Hans');
    expect(resolveLocale(undefined, 'zh_HK')).toBe('zh-Hans');
    expect(resolveLocale(null, 'en')).toBe('en');
    expect(resolveLocale(null, 'en-US')).toBe('en');
    expect(resolveLocale(null, 'ja-JP')).toBe('en');
    expect(resolveLocale(null, undefined)).toBe('en');
    expect(resolveLocale('fr', 'en-US')).toBe('en');
  });

  it('loads a saved locale from storage and can persist a new choice', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    expect(loadLocale(storage, 'en-US')).toBe('en');
    storage.setItem(LANG_KEY, 'zh-Hans');
    expect(loadLocale(storage, 'en-US')).toBe('zh-Hans');
    saveLocale('en', storage);
    expect(storage.getItem(LANG_KEY)).toBe('en');
    expect(loadLocale(storage, 'zh-CN')).toBe('en');
  });
});

describe('locked locale copy', () => {
  it('exposes the locked English labels, including board and heading formats', () => {
    const copy = t('en');
    expect(copy.title).toBe('Calendar Puzzle');
    expect(copy.today).toBe('Today');
    expect(copy.startToday).toBe('Start today');
    expect(copy.month).toBe('Month');
    expect(copy.day).toBe('Day');
    expect(copy.weekday).toBe('Weekday');
    expect(copy.time).toBe('Time');
    expect(copy.hints).toBe('Hints');
    expect(copy.streak).toBe('Streak');
    expect(copy.best).toBe('Best');
    expect(copy.rotate).toBe('Rotate');
    expect(copy.flip).toBe('Flip');
    expect(copy.hint).toBe('Hint');
    expect(copy.undo).toBe('Undo');
    expect(copy.reset).toBe('Reset');
    expect(copy.pieces).toBe('Pieces');
    expect(copy.date).toBe('Date');
    expect(copy.leaveOpen).toBe('Leave these open');
    expect(copy.solved).toBe('Solved');
    expect(copy.share).toBe('Share');
    expect(copy.saveImage).toBe('Save image');
    expect(copy.months).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    expect(copy.weekdaysBoard).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(copy.weekdaysPicker).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
    expect(copy.playHowToHtml).toContain('Leave the month, day, and weekday uncovered');
    expect(copy.previewHowToHtml).toBe("Yesterday's solution. Start today's challenge when you're ready.");
    expect(labelFor(0, 0)).toBe('Jan');
    expect(labelFor(1, 5)).toBe('Dec');
    expect(labelFor(6, 3)).toBe('Sun');
    expect(labelFor(7, 6)).toBe('Sat');
    expect(dateLabel(11, 15, 0)).toBe('Sun, Nov 15');
    expect(formatDateHeading('en', 11, 15, 0)).toBe('Sun, Nov 15');
    expect(formatSolveStats('en', '1:23', 2)).toBe('Time 1:23 · 2 hints');
    expect(formatSolveStats('en', '1:23', 1)).toBe('Time 1:23 · 1 hint');
  });

  it('exposes the locked Simplified Chinese labels, including board and heading formats', () => {
    const copy = t('zh-Hans');
    expect(copy.title).toBe('日历拼图');
    expect(copy.today).toBe('今天');
    expect(copy.startToday).toBe('开始今日挑战');
    expect(copy.month).toBe('月份');
    expect(copy.day).toBe('日');
    expect(copy.weekday).toBe('星期');
    expect(copy.time).toBe('用时');
    expect(copy.hints).toBe('提示');
    expect(copy.streak).toBe('连续');
    expect(copy.best).toBe('最佳');
    expect(copy.rotate).toBe('旋转');
    expect(copy.flip).toBe('翻转');
    expect(copy.hint).toBe('提示');
    expect(copy.undo).toBe('撤销');
    expect(copy.reset).toBe('重置');
    expect(copy.pieces).toBe('木片');
    expect(copy.date).toBe('日期');
    expect(copy.leaveOpen).toBe('请留空');
    expect(copy.solved).toBe('已完成');
    expect(copy.share).toBe('分享');
    expect(copy.saveImage).toBe('保存图片');
    expect(copy.months).toEqual([
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月',
    ]);
    expect(copy.weekdaysBoard).toEqual(['日', '一', '二', '三', '四', '五', '六']);
    expect(copy.weekdaysPicker).toEqual([
      '星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六',
    ]);
    expect(copy.playHowToHtml).toBe(
      '将月份、日期和星期三个格子留空。拖动木片放置，或使用 <kbd>R</kbd>、<kbd>F</kbd>、<kbd>H</kbd>，以及 <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>。',
    );
    expect(copy.previewHowToHtml).toBe('这是昨天的解答。准备好后，开始今日挑战。');
    expect(labelFor(0, 0, 'zh-Hans')).toBe('1月');
    expect(labelFor(1, 5, 'zh-Hans')).toBe('12月');
    expect(labelFor(6, 2, 'zh-Hans')).toBe('31');
    expect(labelFor(6, 3, 'zh-Hans')).toBe('日');
    expect(labelFor(6, 6, 'zh-Hans')).toBe('三');
    expect(labelFor(7, 4, 'zh-Hans')).toBe('四');
    expect(labelFor(7, 6, 'zh-Hans')).toBe('六');
    expect(dateLabel(11, 15, 0, 'zh-Hans')).toBe('周日，11月15日');
    expect(formatDateHeading('zh-Hans', 11, 15, 0)).toBe('周日，11月15日');
    expect(formatSolveStats('zh-Hans', '1:23', 2)).toBe('用时 1:23 · 2 次提示');
    expect(formatSolveStats('zh-Hans', '1:23', 1)).toBe('用时 1:23 · 1 次提示');
  });
});
