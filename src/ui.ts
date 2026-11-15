import { COLS, ROWS, MONTH_LABELS, isUnused, labelFor, dateLabel } from './board';
import {
  type PieceId,
  ORIENTATIONS,
  PIECE_COLORS,
  PIECE_IDS,
  boundingBox,
  neighborFlags,
  translate,
} from './pieces';
import { isLegalPlacement } from './placement';
import { Game, formatTime } from './game';

const DRAG_THRESHOLD = 6;

type DragState = {
  id: PieceId;
  pointerId: number;
  startX: number;
  startY: number;
  grabbing: { r: number; c: number };
  fromBoard: boolean;
  originBefore: { r: number; c: number } | null;
  oriBefore: number;
  wasSelected: boolean;
  moved: boolean;
};

export function mountApp(root: HTMLElement): Game {
  const game = new Game();
  root.innerHTML = layout();
  const refs = bindRefs(root);
  let drag: DragState | null = null;
  let ghost: HTMLElement | null = null;
  let tick: number | null = null;
  let cellSize = 56;

  const measure = () => {
    const width = refs.board.clientWidth;
    if (width > 0) {
      cellSize = width / COLS;
      const value = `${cellSize}px`;
      root.style.setProperty('--cell', value);
      document.documentElement.style.setProperty('--cell', value);
    }
    if (!drag) renderPieces();
  };

  const renderDateControls = () => {
    refs.monthSelect.value = String(game.month);
    refs.daySelect.value = String(game.day);
  };

  const renderStats = () => {
    const snap = game.snapshot();
    refs.timer.textContent = formatTime(game.elapsedMs());
    refs.hints.textContent = String(snap.hintsUsed);
    refs.streak.textContent = String(snap.streak);
    refs.best.textContent = snap.best
      ? `${formatTime(snap.best.timeMs)} · ${snap.best.hintsUsed} hint${snap.best.hintsUsed === 1 ? '' : 's'}`
      : '—';
    refs.dateHeading.textContent = dateLabel(game.month, game.day);
  };

  const renderBoard = () => {
    const date = game.dateCells;
    refs.board.querySelectorAll<HTMLElement>('.board-cell').forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const isDate =
        (r === date.month.r && c === date.month.c) || (r === date.day.r && c === date.day.c);
      el.classList.toggle('date-cell', isDate);
      el.classList.remove('preview-valid', 'preview-invalid');
    });
  };

  const clearPreview = () => {
    refs.board.querySelectorAll('.preview-valid, .preview-invalid').forEach((node) => {
      node.classList.remove('preview-valid', 'preview-invalid');
    });
  };

  const renderPieces = () => {
    refs.boardPieces.innerHTML = '';
    refs.tray.innerHTML = '';
    const traySize = trayCellSize();
    for (const id of PIECE_IDS) {
      const piece = game.piece(id);
      const size = piece.location === 'board' ? cellSize : traySize;
      const el = createPieceElement(id, piece.orientationIndex, size);
      el.classList.toggle('selected', game.selectedId === id);
      el.classList.toggle('solved-lock', game.solved);
      el.setAttribute(
        'aria-label',
        `${id} piece${piece.location === 'board' ? ' on the board' : ' in the tray'}`,
      );
      el.tabIndex = game.solved ? -1 : 0;
      if (piece.location === 'board' && piece.origin) {
        el.style.left = `${piece.origin.c * cellSize}px`;
        el.style.top = `${piece.origin.r * cellSize}px`;
        refs.boardPieces.appendChild(el);
      } else {
        refs.tray.appendChild(el);
      }
      attachPointer(el, id);
    }
  };

  const renderSolved = () => {
    const visible = game.solved;
    refs.banner.classList.toggle('visible', visible);
    refs.banner.hidden = !visible;
    if (visible) {
      const hints = game.hintsUsed;
      refs.bannerBody.textContent = `Time ${formatTime(game.elapsedMs())} · ${hints} hint${hints === 1 ? '' : 's'}`;
    }
  };

  const updateButtons = () => {
    const disabled = game.solved || !game.selectedId;
    refs.rotateBtn.disabled = disabled;
    refs.flipBtn.disabled = disabled;
    refs.hintBtn.disabled = game.solved;
  };

  const startTick = () => {
    if (tick != null) return;
    const loop = () => {
      refs.timer.textContent = formatTime(game.elapsedMs());
      if (game.timerRunning && !game.solved) {
        tick = requestAnimationFrame(loop);
      } else {
        tick = null;
        refs.timer.textContent = formatTime(game.elapsedMs());
      }
    };
    tick = requestAnimationFrame(loop);
  };

  const afterAction = () => {
    renderDateControls();
    renderStats();
    renderBoard();
    renderPieces();
    renderSolved();
    updateButtons();
    if (game.timerRunning) startTick();
  };

  function trayCellSize(): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--tray-cell').trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 28;
  }

  function boardCellFromPoint(x: number, y: number): { r: number; c: number } | null {
    const rect = refs.board.getBoundingClientRect();
    const size = rect.width / COLS;
    if (size <= 0) return null;
    const c = Math.floor((x - rect.left) / size);
    const r = Math.floor((y - rect.top) / size);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return { r, c };
  }

  function dryCanPlace(id: PieceId, origin: { r: number; c: number }, oriIndex: number): boolean {
    const ori = ORIENTATIONS[id][oriIndex];
    if (!ori) return false;
    return isLegalPlacement(translate(ori, origin), game.occupied(id), game.blocked);
  }

  function paintPreview(
    id: PieceId,
    origin: { r: number; c: number } | null,
    oriIndex: number,
    legal: boolean,
  ) {
    clearPreview();
    if (!origin) return;
    const ori = ORIENTATIONS[id][oriIndex];
    if (!ori) return;
    const cls = legal ? 'preview-valid' : 'preview-invalid';
    for (const cell of translate(ori, origin)) {
      const node = refs.board.querySelector<HTMLElement>(`[data-r="${cell.r}"][data-c="${cell.c}"]`);
      if (node && !node.classList.contains('unused')) node.classList.add(cls);
    }
  }

  function beginDragVisual(id: PieceId) {
    const piece = game.piece(id);
    ghost = createPieceElement(id, piece.orientationIndex, cellSize);
    ghost.classList.add('ghost', 'piece');
    document.body.appendChild(ghost);
    const el = refs.root.querySelector<HTMLElement>(`.piece[data-piece="${id}"]`);
    if (el) {
      el.classList.add('dragging');
      el.style.visibility = 'hidden';
    }
  }

  function moveDrag(x: number, y: number) {
    if (!drag || !ghost) return;
    const piece = game.piece(drag.id);
    const hover = boardCellFromPoint(x, y);
    let origin: { r: number; c: number } | null = null;
    let legal = false;
    if (hover) {
      origin = { r: hover.r - drag.grabbing.r, c: hover.c - drag.grabbing.c };
      legal = dryCanPlace(drag.id, origin, piece.orientationIndex);
    }
    ghost.classList.toggle('invalid', !legal);
    if (origin && hover) {
      const rect = refs.board.getBoundingClientRect();
      ghost.style.transform = `translate(${rect.left + origin.c * cellSize}px, ${rect.top + origin.r * cellSize}px)`;
    } else {
      ghost.style.transform = `translate(${x - (drag.grabbing.c + 0.5) * cellSize}px, ${y - (drag.grabbing.r + 0.5) * cellSize}px)`;
    }
    paintPreview(drag.id, origin, piece.orientationIndex, legal);
  }

  function finishDrag(event: PointerEvent, cancelled: boolean) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = drag;
    drag = null;
    clearPreview();
    if (ghost) {
      ghost.remove();
      ghost = null;
    }

    if (cancelled) {
      afterAction();
      return;
    }

    if (!current.moved) {
      if (current.wasSelected) {
        game.select(current.id);
        game.rotate(current.id);
      } else {
        game.select(current.id);
      }
      afterAction();
      return;
    }

    const piece = game.piece(current.id);
    const hover = boardCellFromPoint(event.clientX, event.clientY);
    const overTray = isPointIn(refs.trayPanel, event.clientX, event.clientY);

    if (overTray || !hover) {
      if (current.fromBoard) game.returnToTray(current.id);
      afterAction();
      return;
    }

    const origin = { r: hover.r - current.grabbing.r, c: hover.c - current.grabbing.c };
    const placed = game.tryPlace(current.id, origin, piece.orientationIndex);
    if (!placed) {
      if (current.fromBoard && current.originBefore) {
        game.tryPlace(current.id, current.originBefore, current.oriBefore);
      } else {
        game.returnToTray(current.id);
      }
    }
    afterAction();
  }

  function attachPointer(el: HTMLElement, id: PieceId) {
    el.addEventListener('pointerdown', (event: PointerEvent) => {
      if (game.solved) return;
      if (event.button !== 0) return;
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      const piece = game.piece(id);
      const ori = ORIENTATIONS[id][piece.orientationIndex]!;
      const size = piece.location === 'board' ? cellSize : trayCellSize();
      const rect = el.getBoundingClientRect();
      const grabC = Math.floor((event.clientX - rect.left) / size);
      const grabR = Math.floor((event.clientY - rect.top) / size);
      drag = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        grabbing: nearestFilled({ r: grabR, c: grabC }, ori),
        fromBoard: piece.location === 'board',
        originBefore: piece.origin ? { ...piece.origin } : null,
        oriBefore: piece.orientationIndex,
        wasSelected: game.selectedId === id,
        moved: false,
      };
      game.select(id);
      el.classList.add('selected');
    });

    el.addEventListener('pointermove', (event: PointerEvent) => {
      if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        beginDragVisual(id);
      }
      moveDrag(event.clientX, event.clientY);
    });

    el.addEventListener('pointerup', (event: PointerEvent) => finishDrag(event, false));
    el.addEventListener('pointercancel', (event: PointerEvent) => finishDrag(event, true));
  }

  refs.monthSelect.addEventListener('change', () => {
    game.setDate(Number(refs.monthSelect.value), Number(refs.daySelect.value));
    afterAction();
  });
  refs.daySelect.addEventListener('change', () => {
    game.setDate(Number(refs.monthSelect.value), Number(refs.daySelect.value));
    afterAction();
  });
  refs.todayBtn.addEventListener('click', () => {
    const now = new Date();
    game.setDate(now.getMonth() + 1, now.getDate());
    afterAction();
  });
  refs.resetBtn.addEventListener('click', () => {
    game.reset();
    afterAction();
  });
  refs.hintBtn.addEventListener('click', () => {
    game.hint();
    afterAction();
  });
  refs.rotateBtn.addEventListener('click', () => {
    game.rotate();
    afterAction();
  });
  refs.flipBtn.addEventListener('click', () => {
    game.flip();
    afterAction();
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'r') {
      event.preventDefault();
      game.rotate();
      afterAction();
    } else if (key === 'f') {
      event.preventDefault();
      game.flip();
      afterAction();
    } else if (key === 'h') {
      event.preventDefault();
      game.hint();
      afterAction();
    } else if (key === 'Escape') {
      event.preventDefault();
      game.select(null);
      afterAction();
    }
  });

  const ro = new ResizeObserver(() => measure());
  ro.observe(refs.boardWrap);

  renderBoardSkeleton(refs.board);
  afterAction();
  measure();
  return game;
}

function layout(): string {
  const months = MONTH_LABELS.map((label, i) => `<option value="${i + 1}">${label}</option>`).join('');
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  return `
    <div class="app">
      <header class="header">
        <div class="title-row">
          <h1>Calendar Puzzle</h1>
          <p class="tagline">A daily polyomino calendar</p>
        </div>
        <p class="howto">
          Leave the month and the day uncovered, then fit all eight pieces onto the remaining squares.
          Drag to place. Press <kbd>R</kbd> or click a selected piece to rotate, <kbd>F</kbd> to flip,
          and <kbd>H</kbd> for a hint.
        </p>
      </header>
      <section class="controls" aria-label="Puzzle controls">
        <div class="panel date-block">
          <label class="field">Month
            <select id="month-select" aria-label="Month">${months}</select>
          </label>
          <label class="field">Day
            <select id="day-select" aria-label="Day">${days}</select>
          </label>
          <button type="button" class="btn secondary" id="today-btn">Today</button>
          <strong id="date-heading" class="stat-value"></strong>
        </div>
        <div class="panel stats">
          <div class="stat"><span class="stat-label">Time</span><span class="stat-value" id="stat-timer">0:00</span></div>
          <div class="stat"><span class="stat-label">Hints</span><span class="stat-value" id="stat-hints">0</span></div>
          <div class="stat"><span class="stat-label">Streak</span><span class="stat-value" id="stat-streak">0</span></div>
          <div class="stat"><span class="stat-label">Best</span><span class="stat-value" id="stat-best">—</span></div>
        </div>
        <div class="panel actions">
          <button type="button" class="btn secondary" id="rotate-btn">Rotate</button>
          <button type="button" class="btn secondary" id="flip-btn">Flip</button>
          <button type="button" class="btn" id="hint-btn">Hint</button>
          <button type="button" class="btn secondary" id="reset-btn">Reset</button>
        </div>
      </section>
      <div class="play-area">
        <div class="board-wrap" id="board-wrap">
          <div class="board" id="board" role="grid" aria-label="Calendar board"></div>
          <div class="board-pieces" id="board-pieces"></div>
        </div>
        <aside class="tray-panel" id="tray-panel">
          <h2>Pieces</h2>
          <div class="tray" id="tray" aria-label="Piece tray"></div>
        </aside>
      </div>
      <div class="solved-banner" id="solved-banner" hidden>
        <strong>Solved</strong>
        <p id="solved-body"></p>
      </div>
      <footer class="footer">
        <p>Eight pieces. Forty-one squares. One date left open.</p>
      </footer>
    </div>
  `;
}

function bindRefs(root: HTMLElement) {
  const byId = <T extends HTMLElement>(id: string) => {
    const el = root.querySelector(`#${id}`);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
  };
  return {
    root,
    monthSelect: byId<HTMLSelectElement>('month-select'),
    daySelect: byId<HTMLSelectElement>('day-select'),
    todayBtn: byId<HTMLButtonElement>('today-btn'),
    dateHeading: byId<HTMLElement>('date-heading'),
    timer: byId<HTMLElement>('stat-timer'),
    hints: byId<HTMLElement>('stat-hints'),
    streak: byId<HTMLElement>('stat-streak'),
    best: byId<HTMLElement>('stat-best'),
    rotateBtn: byId<HTMLButtonElement>('rotate-btn'),
    flipBtn: byId<HTMLButtonElement>('flip-btn'),
    hintBtn: byId<HTMLButtonElement>('hint-btn'),
    resetBtn: byId<HTMLButtonElement>('reset-btn'),
    boardWrap: byId<HTMLElement>('board-wrap'),
    board: byId<HTMLElement>('board'),
    boardPieces: byId<HTMLElement>('board-pieces'),
    trayPanel: byId<HTMLElement>('tray-panel'),
    tray: byId<HTMLElement>('tray'),
    banner: byId<HTMLElement>('solved-banner'),
    bannerBody: byId<HTMLElement>('solved-body'),
  };
}

function renderBoardSkeleton(board: HTMLElement) {
  board.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.setAttribute('role', 'gridcell');
      if (isUnused(r, c)) {
        cell.classList.add('unused');
        cell.setAttribute('aria-hidden', 'true');
      } else {
        cell.textContent = labelFor(r, c);
      }
      board.appendChild(cell);
    }
  }
}

function createPieceElement(id: PieceId, orientationIndex: number, size: number): HTMLElement {
  const ori = ORIENTATIONS[id][orientationIndex]!;
  const box = boundingBox(ori);
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.piece = id;
  el.style.width = `${box.width * size}px`;
  el.style.height = `${box.height * size}px`;
  const color = PIECE_COLORS[id];
  el.style.setProperty('--piece-fill', color.fill);
  el.style.setProperty('--piece-stroke', color.stroke);
  el.style.setProperty('--piece-highlight', color.highlight);
  const flags = neighborFlags(ori);
  for (const cell of ori) {
    const node = document.createElement('div');
    node.className = 'piece-cell';
    node.style.left = `${cell.c * size}px`;
    node.style.top = `${cell.r * size}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    const n = flags.get(`${cell.r},${cell.c}`);
    if (n?.n) node.classList.add('n');
    if (n?.e) node.classList.add('e');
    if (n?.s) node.classList.add('s');
    if (n?.w) node.classList.add('w');
    el.appendChild(node);
  }
  return el;
}

function nearestFilled(guess: { r: number; c: number }, cells: readonly { r: number; c: number }[]) {
  let best = cells[0]!;
  let bestDist = Infinity;
  for (const cell of cells) {
    const dist = (cell.r - guess.r) ** 2 + (cell.c - guess.c) ** 2;
    if (dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  }
  return best;
}

function isPointIn(el: HTMLElement, x: number, y: number): boolean {
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
