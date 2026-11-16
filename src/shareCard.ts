import {
  COLS,
  ROWS,
  dateLabel,
  dayCell,
  isUnused,
  labelFor,
  monthCell,
  weekdayCell,
} from './board';
import { type Locale, formatSolveStats, t } from './i18n';
import { ORIENTATIONS, boundingBox } from './pieces';
import { roundedPolyominoPath } from './piecePath';
import { formatTime } from './streak';
import type { GameMode, PieceState } from './game';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

const COLORS = {
  plaster: '#E2E5DF',
  ink: '#1C2118',
  muted: '#5E675C',
  stamp: '#8A2E2A',
  maple: '#EED9A8',
  frame: '#D4B07A',
  frameEdge: '#c49a62',
  plaque: '#C4A06A',
  plaqueInk: 'rgba(90, 61, 28, 0.72)',
  dateCell: 'rgba(247, 233, 200, 0.85)',
  dateInk: '#5A3D1C',
  pieceFill: '#F3E2B8',
  pieceStroke: '#C49A62',
  grid: 'rgba(90, 61, 28, 0.16)',
  pieceGrid: 'rgba(90, 61, 28, 0.2)',
} as const;

const FONT_SANS =
  '600 32px "IBM Plex Sans", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif';
const FONT_TITLE =
  '600 72px "Iowan Old Style", Palatino, Georgia, "Songti SC", "STSong", "Noto Serif SC", serif';
const FONT_DATE =
  '600 40px "Iowan Old Style", Palatino, Georgia, "Songti SC", "STSong", "Noto Serif SC", serif';
const FONT_BOARD =
  '600 28px "Iowan Old Style", Palatino, Georgia, "Songti SC", "STSong", "Noto Serif SC", serif';
const FONT_PLAQUE =
  '600 22px "Iowan Old Style", Palatino, Georgia, "Songti SC", "STSong", "Noto Serif SC", serif';

export type ShareCardInput = {
  mode: GameMode;
  solved: boolean;
  month: number;
  day: number;
  weekday: number;
  pieces: readonly PieceState[];
  elapsedMs: number;
  hintsUsed: number;
  streak?: number;
  locale: Locale;
};

export type ShareCardResult = {
  blob: Blob;
  width: number;
  height: number;
  filename: string;
};

export type ShareCanvas = {
  width: number;
  height: number;
  getContext: (type: '2d') => ShareContext | null;
  toBlob: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
};

/** Minimal 2D context used while drawing the card. */
export type ShareContext = {
  fillStyle: string;
  strokeStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  lineDashOffset?: number;
  globalAlpha?: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  fill: () => void;
  stroke: () => void;
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  rotate: (angle: number) => void;
  setLineDash?: (segments: number[]) => void;
  roundRect?: (x: number, y: number, w: number, h: number, r?: number | number[]) => void;
};

export type CreateShareCanvas = (width: number, height: number) => ShareCanvas;

export function shareFilename(month: number, day: number, weekday: number): string {
  return `calendar-puzzle-${month}-${day}-${weekday}.png`;
}

export function canBuildShareCard(input: Pick<ShareCardInput, 'mode' | 'solved'>): boolean {
  return input.solved && input.mode !== 'preview';
}

function defaultCreateCanvas(width: number, height: number): ShareCanvas {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is not available');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as ShareCanvas;
}

function roundedRect(
  ctx: ShareContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRound(ctx: ShareContext, x: number, y: number, w: number, h: number, r: number): void {
  roundedRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function canvasToBlob(canvas: ShareCanvas, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode share image'));
    }, type);
  });
}

function drawBoard(
  ctx: ShareContext,
  input: ShareCardInput,
  originX: number,
  originY: number,
  cell: number,
): void {
  const boardW = COLS * cell;
  const boardH = ROWS * cell;
  const radius = cell * 0.14;

  ctx.fillStyle = COLORS.maple;
  ctx.strokeStyle = COLORS.frameEdge;
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  fillRound(ctx, originX, originY, boardW, boardH, radius);
  roundedRect(ctx, originX, originY, boardW, boardH, radius);
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 61, 28, 0.16)';
  ctx.lineWidth = 2;
  roundedRect(ctx, originX, originY, boardW, boardH, radius);
  ctx.stroke();

  const date = {
    month: monthCell(input.month),
    day: dayCell(input.day),
    weekday: weekdayCell(input.weekday),
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isUnused(r, c)) continue;
      const x = originX + c * cell;
      const y = originY + r * cell;
      const isDate =
        (r === date.month.r && c === date.month.c) ||
        (r === date.day.r && c === date.day.c) ||
        (r === date.weekday.r && c === date.weekday.c);
      if (isDate) {
        ctx.fillStyle = COLORS.dateCell;
        fillRound(ctx, x + 3, y + 3, cell - 6, cell - 6, 10);
      }
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cell, y);
      ctx.lineTo(x + cell, y + cell);
      ctx.lineTo(x, y + cell);
      ctx.stroke();
    }
  }

  // Recessed plaques over unused regions.
  const copy = t(input.locale);
  ctx.fillStyle = COLORS.plaque;
  fillRound(ctx, originX + 6 * cell + 6, originY + 6, cell - 12, cell * 2 - 12, 10);
  fillRound(ctx, originX + 6, originY + 7 * cell + 6, cell * 4 - 12, cell - 12, 10);

  ctx.fillStyle = COLORS.plaqueInk;
  ctx.font = FONT_PLAQUE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(originX + 6 * cell + cell / 2, originY + cell);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(copy.date, 0, 0, cell * 2 - 20);
  ctx.restore();
  ctx.fillText(
    copy.leaveOpen,
    originX + 2 * cell,
    originY + 7 * cell + cell / 2,
    cell * 4 - 20,
  );

  // Board labels under pieces will be hard to read; draw labels first, pieces after.
  ctx.font = FONT_BOARD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const text = labelFor(r, c, input.locale);
      if (!text) continue;
      const isDate =
        (r === date.month.r && c === date.month.c) ||
        (r === date.day.r && c === date.day.c) ||
        (r === date.weekday.r && c === date.weekday.c);
      ctx.fillStyle = isDate ? COLORS.dateInk : COLORS.plaqueInk;
      ctx.fillText(text, originX + c * cell + cell / 2, originY + r * cell + cell / 2, cell - 8);
    }
  }

  for (const piece of input.pieces) {
    if (piece.location !== 'board' || !piece.origin) continue;
    const ori = ORIENTATIONS[piece.pieceId][piece.orientationIndex];
    if (!ori) continue;
    const box = boundingBox(ori);
    const x = originX + piece.origin.c * cell;
    const y = originY + piece.origin.r * cell;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.pieceFill;
    ctx.strokeStyle = COLORS.pieceStroke;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    fillAndStrokePiece(ctx, roundedPolyominoPath(ori, cell), ori, cell);
    drawPieceGrid(ctx, ori, cell, box);
    ctx.restore();
  }
}

function drawPieceGrid(
  ctx: ShareContext,
  cells: readonly { r: number; c: number }[],
  size: number,
  box: { minR: number; minC: number },
): void {
  const filled = new Set(cells.map((cell) => `${cell.r - box.minR},${cell.c - box.minC}`));
  const has = (r: number, c: number) => filled.has(`${r},${c}`);
  ctx.strokeStyle = COLORS.pieceGrid;
  ctx.lineWidth = 1;
  ctx.setLineDash?.([3, 3]);
  ctx.beginPath();
  for (const key of filled) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    if (has(r, c + 1)) {
      ctx.moveTo((c + 1) * size, r * size);
      ctx.lineTo((c + 1) * size, (r + 1) * size);
    }
    if (has(r + 1, c)) {
      ctx.moveTo(c * size, (r + 1) * size);
      ctx.lineTo((c + 1) * size, (r + 1) * size);
    }
  }
  ctx.stroke();
  ctx.setLineDash?.([]);
}

function fillAndStrokePiece(
  ctx: ShareContext,
  d: string,
  ori: readonly { r: number; c: number }[],
  cell: number,
): void {
  const PathCtor = (globalThis as unknown as { Path2D?: new (path: string) => object }).Path2D;
  const rich = ctx as ShareContext & { fill: (path?: object) => void; stroke: (path?: object) => void };
  if (PathCtor && d) {
    const path = new PathCtor(d);
    rich.fill(path);
    rich.stroke(path);
    return;
  }
  for (const pos of ori) {
    fillRound(ctx, pos.c * cell + 1, pos.r * cell + 1, cell - 2, cell - 2, cell * 0.16);
    ctx.strokeStyle = COLORS.pieceStroke;
    roundedRect(ctx, pos.c * cell + 1, pos.r * cell + 1, cell - 2, cell - 2, cell * 0.16);
    ctx.stroke();
  }
}

export function drawShareCard(ctx: ShareContext, input: ShareCardInput): void {
  const copy = t(input.locale);
  ctx.fillStyle = COLORS.plaster;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  ctx.fillStyle = COLORS.stamp;
  ctx.font = FONT_TITLE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(copy.title, SHARE_WIDTH / 2, 132, SHARE_WIDTH - 120);

  ctx.fillStyle = COLORS.ink;
  ctx.font = FONT_DATE;
  ctx.fillText(
    dateLabel(input.month, input.day, input.weekday, input.locale),
    SHARE_WIDTH / 2,
    198,
    SHARE_WIDTH - 120,
  );

  const cell = 108;
  const boardW = COLS * cell;
  const boardH = ROWS * cell;
  const boardX = Math.round((SHARE_WIDTH - boardW) / 2);
  const boardY = 248;
  drawBoard(ctx, input, boardX, boardY, cell);

  ctx.fillStyle = COLORS.stamp;
  fillRound(ctx, SHARE_WIDTH / 2 - 48, boardY + boardH + 56, 96, 6, 3);

  let stats = formatSolveStats(input.locale, formatTime(input.elapsedMs), input.hintsUsed);
  if (input.streak != null && input.streak > 0) {
    stats +=
      input.locale === 'zh-Hans'
        ? ` · ${copy.streak} ${input.streak}`
        : ` · ${copy.streak} ${input.streak}`;
  }
  ctx.fillStyle = COLORS.ink;
  ctx.font = FONT_SANS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(stats, SHARE_WIDTH / 2, boardY + boardH + 120, SHARE_WIDTH - 120);
}

export async function buildShareCard(
  input: ShareCardInput,
  createCanvas: CreateShareCanvas = defaultCreateCanvas,
): Promise<ShareCardResult | null> {
  if (!canBuildShareCard(input)) return null;
  const canvas = createCanvas(SHARE_WIDTH, SHARE_HEIGHT);
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is not available');
  drawShareCard(ctx, input);
  const blob = await canvasToBlob(canvas, 'image/png');
  return {
    blob,
    width: SHARE_WIDTH,
    height: SHARE_HEIGHT,
    filename: shareFilename(input.month, input.day, input.weekday),
  };
}

export function downloadShareImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function shareOrDownload(
  card: ShareCardResult,
  options: { title?: string; text?: string } = {},
): Promise<'shared' | 'downloaded'> {
  const file = new File([card.blob], card.filename, { type: 'image/png' });
  const payload = { files: [file], title: options.title, text: options.text };
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const canShare = typeof navigator.canShare !== 'function' || navigator.canShare(payload);
      if (canShare) {
        await navigator.share(payload);
        return 'shared';
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'shared';
  }
  downloadShareImage(card.blob, card.filename);
  return 'downloaded';
}
