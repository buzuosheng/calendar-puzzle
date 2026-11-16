import { describe, expect, it } from 'vitest';
import {
  DESKTOP_VIEWPORTS,
  PHONE_VIEWPORTS,
  layoutFor,
} from '../layout';

describe('one-screen layout formula', () => {
  it.each([...PHONE_VIEWPORTS])(
    'fits the full UI on one screen at $name with the board and tray both on screen',
    ({ width, height }) => {
      const layout = layoutFor(width, height);
      expect(layout.cell).toBeGreaterThanOrEqual(24);
      expect(layout.boardWidth).toBeGreaterThan(0);
      expect(layout.boardHeight).toBeGreaterThan(0);
      expect(layout.trayWidth).toBeGreaterThan(0);
      expect(layout.trayHeight).toBeGreaterThanOrEqual(80);
      expect(layout.totalWidth).toBeLessThanOrEqual(width + 0.51);
      expect(layout.totalHeight).toBeLessThanOrEqual(height + 0.51);
      expect(layout.fits).toBe(true);
      if (layout.sideTray) {
        expect(layout.boardWidth + layout.playGap + layout.trayWidth).toBeLessThanOrEqual(
          width - 2 * layout.pageX + 0.51,
        );
        expect(layout.boardHeight).toBeLessThanOrEqual(height - layout.uiChrome + 0.51);
      } else {
        expect(layout.uiChrome + layout.boardHeight + layout.trayStack).toBeLessThanOrEqual(
          height + 0.51,
        );
      }
    },
  );

  it.each([...DESKTOP_VIEWPORTS])(
    'keeps the desktop sidebar layout on one screen at $name',
    ({ width, height }) => {
      const layout = layoutFor(width, height);
      expect(layout.sideTray).toBe(true);
      expect(layout.sidebarWidth).toBe(17 * 16);
      expect(layout.cell).toBe(70);
      expect(layout.fits).toBe(true);
    },
  );
});
