/**
 * One-screen layout budgets used by the CSS `--cell` formula.
 * Keep these tokens in sync with `src/style.css`.
 *
 * --cell: min(
 *   --cell-max,
 *   (100vw - 2*--page-x - --sidebar-width - --sidebar-gap
 *           - --tray-col - --play-gap - 2*--board-pad) / 7,
 *   (100dvh - --ui-chrome - --tray-stack - 2*--board-pad) / 8
 * )
 *
 * Breakpoints:
 * - width < 600: stacked board then tray (portrait phones).
 * - width 600–899: board | tray; chrome stays compact at the top.
 * - width 600–899 and height <= 500: short landscape, tighter chrome,
 *   howto sits beside the controls.
 * - width >= 900: left sidebar, right play area (desktop).
 */

export type LayoutTokens = {
  pageX: number;
  boardPad: number;
  playGap: number;
  cellMax: number;
  uiChrome: number;
  trayStack: number;
  sidebarWidth: number;
  sidebarGap: number;
  trayCol: number;
  sideTray: boolean;
};

export type LayoutBudget = LayoutTokens & {
  width: number;
  height: number;
  cell: number;
  boardWidth: number;
  boardHeight: number;
  trayWidth: number;
  trayHeight: number;
  totalWidth: number;
  totalHeight: number;
  fits: boolean;
};

export const PHONE_VIEWPORTS = [
  { width: 375, height: 667, name: '375×667 portrait' },
  { width: 390, height: 844, name: '390×844 portrait' },
  { width: 667, height: 375, name: '667×375 landscape' },
  { width: 844, height: 390, name: '844×390 landscape' },
] as const;

export const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 800, name: '1280×800 desktop' },
  { width: 1440, height: 900, name: '1440×900 desktop' },
  { width: 1728, height: 1117, name: '1728×1117 16-inch laptop' },
] as const;

const SIDEBAR_WIDTH_900 = 17 * 16; // 17rem at the 16px root font size

export function tokensFor(width: number, height: number): LayoutTokens {
  if (width >= 900) {
    const pageX = width >= 1024 ? 32 : 24;
    const boardPad = width >= 1100 ? 18 : 16;
    return {
      pageX,
      boardPad,
      playGap: 24,
      cellMax: 70,
      uiChrome: 48,
      trayStack: 0,
      sidebarWidth: SIDEBAR_WIDTH_900,
      sidebarGap: 40,
      trayCol: 168,
      sideTray: true,
    };
  }

  if (width >= 600 && height <= 500) {
    return {
      pageX: 10,
      boardPad: 8,
      playGap: 12,
      cellMax: 56,
      uiChrome: 120,
      trayStack: 0,
      sidebarWidth: 0,
      sidebarGap: 0,
      trayCol: 120,
      sideTray: true,
    };
  }

  if (width >= 600) {
    const cellMax = width >= 768 ? 56 : 44;
    const pageX = width >= 768 ? 24 : 12;
    const boardPad = width >= 768 ? 16 : 10;
    return {
      pageX,
      boardPad,
      playGap: 16,
      cellMax,
      uiChrome: 296,
      trayStack: 0,
      sidebarWidth: 0,
      sidebarGap: 0,
      trayCol: 120,
      sideTray: true,
    };
  }

  // Portrait phones: stacked board then tray.
  // playGap is 0 in the width formula; the 8px stack gap lives in trayStack.
  return {
    pageX: 12,
    boardPad: 10,
    playGap: 0,
    cellMax: 56,
    uiChrome: 296,
    trayStack: 120,
    sidebarWidth: 0,
    sidebarGap: 0,
    trayCol: 0,
    sideTray: false,
  };
}

export function layoutFor(width: number, height: number): LayoutBudget {
  const tokens = tokensFor(width, height);
  const cellWidth =
    (width -
      2 * tokens.pageX -
      tokens.sidebarWidth -
      tokens.sidebarGap -
      tokens.trayCol -
      tokens.playGap -
      2 * tokens.boardPad) /
    7;
  const cellHeight = (height - tokens.uiChrome - tokens.trayStack - 2 * tokens.boardPad) / 8;
  const cell = Math.min(tokens.cellMax, cellWidth, cellHeight);
  const boardWidth = cell * 7 + 2 * tokens.boardPad;
  const boardHeight = cell * 8 + 2 * tokens.boardPad;
  const trayWidth = tokens.sideTray ? tokens.trayCol : width - 2 * tokens.pageX;
  const stackGap = tokens.sideTray ? 0 : 8;
  const trayHeight = tokens.sideTray ? boardHeight : Math.max(0, tokens.trayStack - stackGap);
  const totalWidth = tokens.sideTray
    ? 2 * tokens.pageX +
      tokens.sidebarWidth +
      tokens.sidebarGap +
      boardWidth +
      tokens.playGap +
      tokens.trayCol
    : Math.max(boardWidth, trayWidth) + 2 * tokens.pageX;
  const totalHeight = tokens.uiChrome + boardHeight + tokens.trayStack;
  const fits = totalWidth <= width + 0.51 && totalHeight <= height + 0.51 && cell > 0;
  return {
    ...tokens,
    width,
    height,
    cell,
    boardWidth,
    boardHeight,
    trayWidth,
    trayHeight,
    totalWidth,
    totalHeight,
    fits,
  };
}
