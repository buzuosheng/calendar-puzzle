import { type Cell, COLS, dateMask, monthCell, dayCell, weekdayCell, sameCellSet } from './board';
import {
  type PieceId,
  ORIENTATIONS,
  PIECE_IDS,
  flipCellsHorizontal,
  placementFromCells,
  rotateCells90CW,
  translate,
} from './pieces';
import {
  type Placement,
  cellsOf,
  isLegalPlacement,
  isSolved,
  occupancyMask,
  originAfterTransform,
} from './placement';
import { type SolvedPiece, canonicalSolution } from './solver';
import { type BestMap, formatTime } from './streak';
import {
  loadProgress,
  saveSolve,
  bestFor,
  saveSession,
  clearSession,
  SESSION_VERSION,
  type SessionState,
} from './storage';

export type PieceLocation = 'tray' | 'board';

export type PieceState = {
  pieceId: PieceId;
  orientationIndex: number;
  location: PieceLocation;
  origin: Cell | null;
};

export type GameMode = 'preview' | 'play';

export type GameSnapshot = {
  month: number;
  day: number;
  weekday: number;
  mode: GameMode;
  pieces: PieceState[];
  selectedId: PieceId | null;
  timerRunning: boolean;
  hintsUsed: number;
  solved: boolean;
  elapsedMs: number;
  streak: number;
  lastSolved: string | null;
  best: { timeMs: number; hintsUsed: number } | null;
};

export type HintResult =
  | { action: 'none' }
  | { action: 'placed'; pieceId: PieceId }
  | { action: 'returned'; pieceId: PieceId };

type UndoEntry = {
  pieces: PieceState[];
  selectedId: PieceId | null;
  hintsUsed: number;
};

export type GameOptions = {
  month?: number;
  day?: number;
  weekday?: number;
  now?: () => number;
  today?: () => Date;
  persist?: boolean;
  previewYesterday?: boolean;
  session?: SessionState;
};

export function calendarParts(date: Date): { month: number; day: number; weekday: number } {
  return { month: date.getMonth() + 1, day: date.getDate(), weekday: date.getDay() };
}

export function previousDate(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
}

function defaultTodayDate(): { month: number; day: number; weekday: number } {
  return calendarParts(new Date());
}

function initialPieces(): PieceState[] {
  return PIECE_IDS.map((pieceId) => ({
    pieceId,
    orientationIndex: 0,
    location: 'tray' as const,
    origin: null,
  }));
}

export class Game {
  month: number;
  day: number;
  weekday: number;
  pieces: PieceState[];
  selectedId: PieceId | null = null;
  timerRunning = false;
  hintsUsed = 0;
  solved = false;
  streak = 0;
  lastSolved: string | null = null;
  bests: BestMap = {};
  mode: GameMode = 'play';

  private startedAt: number | null = null;
  private stoppedMs = 0;
  private readonly now: () => number;
  private readonly today: () => Date;
  private readonly persist: boolean;
  private savedThisAttempt = false;
  private history: UndoEntry[] = [];

  constructor(options: GameOptions = {}) {
    const todayDate = defaultTodayDate();
    this.month = options.month ?? todayDate.month;
    this.day = options.day ?? todayDate.day;
    this.weekday = options.weekday ?? todayDate.weekday;
    this.pieces = initialPieces();
    this.now = options.now ?? (() => Date.now());
    this.today = options.today ?? (() => new Date());
    this.persist = options.persist !== false;
    this.reloadProgress();
    if (options.session) {
      if (!this.applySession(options.session)) {
        if (options.previewYesterday) this.showYesterdaySolution();
      }
    } else if (options.previewYesterday) {
      this.showYesterdaySolution();
    }
  }

  get locked(): boolean {
    return this.solved || this.mode === 'preview';
  }

  get canUndo(): boolean {
    return !this.locked && this.history.length > 0;
  }

  get blocked(): bigint {
    return dateMask(this.month, this.day, this.weekday);
  }

  get dateCells(): { month: Cell; day: Cell; weekday: Cell } {
    return {
      month: monthCell(this.month),
      day: dayCell(this.day),
      weekday: weekdayCell(this.weekday),
    };
  }

  reloadProgress(): void {
    if (!this.persist) {
      this.streak = 0;
      this.lastSolved = null;
      this.bests = {};
      return;
    }
    const progress = loadProgress();
    this.streak = progress.streak.streak;
    this.lastSolved = progress.streak.lastSolved;
    this.bests = progress.best;
  }

  boardPlacements(): Placement[] {
    const placed: Placement[] = [];
    for (const piece of this.pieces) {
      if (piece.location === 'board' && piece.origin) {
        placed.push({
          pieceId: piece.pieceId,
          orientationIndex: piece.orientationIndex,
          origin: piece.origin,
        });
      }
    }
    return placed;
  }

  occupied(exceptId?: PieceId): bigint {
    return occupancyMask(this.boardPlacements(), exceptId);
  }

  piece(id: PieceId): PieceState {
    const found = this.pieces.find((item) => item.pieceId === id);
    if (!found) throw new Error(`Unknown piece ${id}`);
    return found;
  }

  cellsFor(id: PieceId): Cell[] {
    const piece = this.piece(id);
    const ori = ORIENTATIONS[id][piece.orientationIndex]!;
    if (piece.location !== 'board' || !piece.origin) return translate(ori, { r: 0, c: 0 });
    return translate(ori, piece.origin);
  }

  elapsedMs(at?: number): number {
    if (!this.timerRunning || this.startedAt == null) {
      return this.stoppedMs;
    }
    return Math.max(0, (at ?? this.now()) - this.startedAt);
  }

  private startTimerIfNeeded(): void {
    if (this.locked || this.timerRunning) return;
    this.timerRunning = true;
    this.startedAt = this.now() - this.stoppedMs;
  }

  private stopTimer(): void {
    if (!this.timerRunning) return;
    this.stoppedMs = this.elapsedMs();
    this.timerRunning = false;
  }

  private resetTimer(): void {
    this.timerRunning = false;
    this.startedAt = null;
    this.stoppedMs = 0;
  }

  snapshot(): GameSnapshot {
    return {
      month: this.month,
      day: this.day,
      weekday: this.weekday,
      mode: this.mode,
      pieces: this.pieces.map((piece) => ({ ...piece })),
      selectedId: this.selectedId,
      timerRunning: this.timerRunning,
      hintsUsed: this.hintsUsed,
      solved: this.solved,
      elapsedMs: this.elapsedMs(),
      streak: this.streak,
      lastSolved: this.lastSolved,
      best: bestFor(this.bests, this.month, this.day, this.weekday),
    };
  }

  setDate(month: number, day: number, weekday: number): void {
    this.month = month;
    this.day = day;
    this.weekday = weekday;
    this.resetBoard();
    this.persistSession();
  }

  reset(): void {
    this.resetBoard();
    this.persistSession();
  }

  showYesterdaySolution(): void {
    const parts = calendarParts(previousDate(this.today()));
    this.applyPreview(parts.month, parts.day, parts.weekday);
  }

  startToday(): void {
    const parts = calendarParts(this.today());
    this.setDate(parts.month, parts.day, parts.weekday);
  }

  applyPreview(month: number, day: number, weekday: number): void {
    this.month = month;
    this.day = day;
    this.weekday = weekday;
    this.resetBoard();
    this.mode = 'preview';
    const solution = canonicalSolution(month, day, weekday);
    if (!solution) return;
    for (const placed of solution) {
      const piece = this.piece(placed.pieceId);
      piece.orientationIndex = placed.orientationIndex;
      piece.location = 'board';
      piece.origin = { ...placed.origin };
    }
    this.selectedId = null;
    if (this.persist) clearSession();
  }

  applySession(session: SessionState): boolean {
    if (!this.sessionPlacementsLegal(session)) return false;
    this.month = session.month;
    this.day = session.day;
    this.weekday = session.weekday;
    this.mode = 'play';
    this.pieces = this.clonePieces(session.pieces);
    this.selectedId = session.solved ? null : session.selectedId;
    this.hintsUsed = session.hintsUsed;
    this.solved = false;
    this.savedThisAttempt = false;
    this.clearHistory();
    this.resetTimer();
    this.stoppedMs = Math.round(session.elapsedMs);
    if (session.solved) {
      this.solved = true;
      this.savedThisAttempt = true;
      this.selectedId = null;
      return true;
    }
    if (session.timerRunning) {
      if (typeof session.startedAt === 'number') {
        this.timerRunning = true;
        this.startedAt = session.startedAt;
        this.stoppedMs = 0;
      } else if (this.stoppedMs > 0) {
        this.timerRunning = true;
        this.startedAt = this.now() - this.stoppedMs;
      }
    }
    if (this.isComplete()) this.checkWin();
    return true;
  }

  private sessionPlacementsLegal(session: SessionState): boolean {
    const blocked = dateMask(session.month, session.day, session.weekday);
    const placements: Placement[] = [];
    for (const piece of session.pieces) {
      if (piece.location !== 'board' || !piece.origin) continue;
      placements.push({
        pieceId: piece.pieceId,
        orientationIndex: piece.orientationIndex,
        origin: { ...piece.origin },
      });
    }
    for (const placed of placements) {
      const cells = cellsOf(placed);
      if (!isLegalPlacement(cells, occupancyMask(placements, placed.pieceId), blocked)) {
        return false;
      }
    }
    if (session.solved && !isSolved(placements, session.month, session.day, session.weekday)) {
      return false;
    }
    return true;
  }

  private persistSession(): void {
    if (!this.persist) return;
    if (this.mode === 'preview') {
      clearSession();
      return;
    }
    saveSession({
      version: SESSION_VERSION,
      month: this.month,
      day: this.day,
      weekday: this.weekday,
      pieces: this.clonePieces(this.pieces),
      selectedId: this.selectedId,
      hintsUsed: this.hintsUsed,
      solved: this.solved,
      elapsedMs: this.elapsedMs(),
      timerRunning: this.timerRunning,
      startedAt: this.timerRunning ? this.startedAt : null,
      savedThisAttempt: this.savedThisAttempt,
    });
  }

    private resetBoard(): void {
    this.mode = 'play';
    this.pieces = initialPieces();
    this.selectedId = null;
    this.hintsUsed = 0;
    this.solved = false;
    this.savedThisAttempt = false;
    this.resetTimer();
    this.clearHistory();
    this.reloadProgress();
  }

  private clonePieces(pieces: PieceState[]): PieceState[] {
    return pieces.map((piece) => ({
      ...piece,
      origin: piece.origin ? { ...piece.origin } : null,
    }));
  }

  private pushHistory(): void {
    this.history.push({
      pieces: this.clonePieces(this.pieces),
      selectedId: this.selectedId,
      hintsUsed: this.hintsUsed,
    });
  }

  private clearHistory(): void {
    this.history = [];
  }

  undo(): void {
    if (this.locked) return;
    const entry = this.history.pop();
    if (!entry) return;
    this.pieces = this.clonePieces(entry.pieces);
    this.selectedId = entry.selectedId;
    this.hintsUsed = entry.hintsUsed;
    this.persistSession();
  }

  select(id: PieceId | null): void {
    this.selectedId = id;
  }

  /** Successful placement. Invalid moves are rejected and not committed. */
  tryPlace(id: PieceId, origin: Cell, orientationIndex?: number): boolean {
    if (this.locked) return false;
    const piece = this.piece(id);
    const oriIndex = orientationIndex ?? piece.orientationIndex;
    if (!ORIENTATIONS[id][oriIndex]) return false;
    const cells = translate(ORIENTATIONS[id][oriIndex]!, origin);
    if (!isLegalPlacement(cells, this.occupied(id), this.blocked)) return false;
    const samePlace =
      piece.location === 'board' &&
      piece.orientationIndex === oriIndex &&
      piece.origin != null &&
      piece.origin.r === origin.r &&
      piece.origin.c === origin.c;
    if (!samePlace) this.pushHistory();
    piece.orientationIndex = oriIndex;
    piece.location = 'board';
    piece.origin = { ...origin };
    this.selectedId = id;
    this.startTimerIfNeeded();
    this.checkWin();
    this.persistSession();
    return true;
  }

  returnToTray(id: PieceId): void {
    if (this.locked) return;
    const piece = this.piece(id);
    if (piece.location === 'tray' && piece.origin == null) {
      this.selectedId = id;
      return;
    }
    this.pushHistory();
    this.moveToTray(id);
    this.persistSession();
  }

  private moveToTray(id: PieceId): void {
    const piece = this.piece(id);
    piece.location = 'tray';
    piece.origin = null;
    this.selectedId = id;
  }

  /**
   * Rotate the selected piece 90° clockwise. If it is on the board and the
   * new shape no longer fits, it returns to the tray.
   */
  rotate(id?: PieceId): void {
    const target = id ?? this.selectedId;
    if (!target || this.locked) return;
    const piece = this.piece(target);
    const current = this.cellsFor(target);
    const rotated = rotateCells90CW(current);
    const found = placementFromCells(target, rotated);
    if (!found) return;
    this.pushHistory();
    this.startTimerIfNeeded();
    if (piece.location === 'tray') {
      piece.orientationIndex = found.orientationIndex;
      this.persistSession();
      return;
    }
    this.applyTransform(piece, found.orientationIndex, current);
    this.persistSession();
  }

  /** Horizontally mirror the selected piece. */
  flip(id?: PieceId): void {
    const target = id ?? this.selectedId;
    if (!target || this.locked) return;
    const piece = this.piece(target);
    const current = this.cellsFor(target);
    const flipped = flipCellsHorizontal(current);
    const found = placementFromCells(target, flipped);
    if (!found) return;
    this.pushHistory();
    this.startTimerIfNeeded();
    if (piece.location === 'tray') {
      piece.orientationIndex = found.orientationIndex;
      this.persistSession();
      return;
    }
    this.applyTransform(piece, found.orientationIndex, current);
    this.persistSession();
  }

  private applyTransform(piece: PieceState, orientationIndex: number, previousCells: Cell[]): void {
    const origin = originAfterTransform(
      piece.pieceId,
      orientationIndex,
      previousCells,
      this.occupied(piece.pieceId),
      this.blocked,
    );
    piece.orientationIndex = orientationIndex;
    if (!origin) {
      piece.location = 'tray';
      piece.origin = null;
      return;
    }
    piece.location = 'board';
    piece.origin = origin;
    this.checkWin();
  }

  isComplete(): boolean {
    return isSolved(this.boardPlacements(), this.month, this.day, this.weekday);
  }

  private checkWin(): void {
    if (this.solved || !this.isComplete()) return;
    this.stopTimer();
    this.solved = true;
    this.selectedId = null;
    if (this.persist && !this.savedThisAttempt) {
      const progress = saveSolve({
        month: this.month,
        day: this.day,
        weekday: this.weekday,
        timeMs: this.elapsedMs(),
        hintsUsed: this.hintsUsed,
        today: this.today(),
      });
      this.streak = progress.streak.streak;
      this.lastSolved = progress.streak.lastSolved;
      this.bests = progress.best;
      this.savedThisAttempt = true;
    }
    this.persistSession();
  }

  /**
   * Place exactly one not-yet-correct piece into the canonical solution,
   * or return a blocking piece if the target cells are occupied.
   */
  hint(): HintResult {
    if (this.locked) return { action: 'none' };
    const solution = canonicalSolution(this.month, this.day, this.weekday);
    if (!solution) return { action: 'none' };

    for (const target of solution) {
      const piece = this.piece(target.pieceId);
      if (isCorrectlyPlaced(piece, target)) continue;

      const blocker = this.firstBlocker(target, piece.pieceId);
      this.pushHistory();
      this.startTimerIfNeeded();
      this.hintsUsed += 1;
      if (blocker) {
        this.moveToTray(blocker);
        this.persistSession();
        return { action: 'returned', pieceId: blocker };
      }

      piece.orientationIndex = target.orientationIndex;
      piece.location = 'board';
      piece.origin = { ...target.origin };
      this.selectedId = piece.pieceId;
      this.checkWin();
      this.persistSession();
      return { action: 'placed', pieceId: piece.pieceId };
    }

    this.checkWin();
    return { action: 'none' };
  }

  private firstBlocker(target: SolvedPiece, self: PieceId): PieceId | null {
    const wanted = new Set(target.cells.map((cell) => `${cell.r},${cell.c}`));
    // Scan board pieces in piece-id order, then by top-left cell.
    const occupied: { id: PieceId; minIndex: number }[] = [];
    for (const piece of this.pieces) {
      if (piece.pieceId === self || piece.location !== 'board' || !piece.origin) continue;
      const cells = cellsOf({
        pieceId: piece.pieceId,
        orientationIndex: piece.orientationIndex,
        origin: piece.origin,
      });
      const hits = cells.filter((cell) => wanted.has(`${cell.r},${cell.c}`));
      if (hits.length === 0) continue;
      const minIndex = Math.min(...hits.map((cell) => cell.r * COLS + cell.c));
      occupied.push({ id: piece.pieceId, minIndex });
    }
    occupied.sort((a, b) => a.minIndex - b.minIndex);
    return occupied[0]?.id ?? null;
  }
}

function isCorrectlyPlaced(piece: PieceState, target: SolvedPiece): boolean {
  if (piece.location !== 'board' || !piece.origin) return false;
  const cells = cellsOf({
    pieceId: piece.pieceId,
    orientationIndex: piece.orientationIndex,
    origin: piece.origin,
  });
  return sameCellSet(cells, target.cells);
}

export { formatTime, isSolved };
