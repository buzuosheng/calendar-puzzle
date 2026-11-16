import { COLS, ROWS, MONTH_LABELS, WEEKDAY_FULL_LABELS, isUnused, labelFor, dateLabel } from './board';
import {
  type PieceId,
  ORIENTATIONS,
  PIECE_IDS,
  boundingBox,
  translate,
} from './pieces';
import { roundedPolyominoPath } from './piecePath';
import { isLegalPlacement } from './placement';
import { Game, formatTime } from './game';

const DRAG_THRESHOLD = 6;

let pieceShapeSeq = 0;

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
  const game = new Game({ previewYesterday: true });
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
    }
    if (!drag) renderPieces();
  };

  const renderDateControls = () => {
    refs.monthSelect.value = String(game.month);
    refs.daySelect.value = String(game.day);
    refs.weekdaySelect.value = String(game.weekday);
  };

  const renderStats = () => {
    const snap = game.snapshot();
    const preview = snap.mode === 'preview';
    refs.timer.textContent = preview ? '—' : formatTime(game.elapsedMs());
    refs.hints.textContent = preview ? '—' : String(snap.hintsUsed);
    refs.streak.textContent = String(snap.streak);
    refs.best.textContent = snap.best
      ? `${formatTime(snap.best.timeMs)} · ${snap.best.hintsUsed} hint${snap.best.hintsUsed === 1 ? '' : 's'}`
      : '—';
    refs.dateHeading.textContent = dateLabel(game.month, game.day, game.weekday);
  };

  const renderBoard = () => {
    const date = game.dateCells;
    refs.board.querySelectorAll<HTMLElement>('.board-cell').forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const isDate =
        (r === date.month.r && c === date.month.c) ||
        (r === date.day.r && c === date.day.c) ||
        (r === date.weekday.r && c === date.weekday.c);
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
      el.classList.toggle('solved-lock', game.locked);
      el.setAttribute(
        'aria-label',
        `${id} piece${piece.location === 'board' ? ' on the board' : ' in the tray'}`,
      );
      el.tabIndex = game.locked ? -1 : 0;
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
    const preview = game.mode === 'preview';
    refs.root.classList.toggle('is-preview', preview);
    const visible = game.solved;
    refs.root.classList.toggle('is-solved', visible);
    refs.banner.classList.toggle('visible', visible);
    refs.banner.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      const hints = game.hintsUsed;
      refs.bannerBody.textContent = `Time ${formatTime(game.elapsedMs())} · ${hints} hint${hints === 1 ? '' : 's'}`;
    }
  };

  const updateButtons = () => {
    const disabled = game.locked || !game.selectedId;
    refs.rotateBtn.disabled = disabled;
    refs.flipBtn.disabled = disabled;
    refs.hintBtn.disabled = game.locked;
    refs.undoBtn.disabled = !game.canUndo;
    refs.resetBtn.disabled = game.mode === 'preview';
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
      if (game.locked) return;
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
    game.setDate(
      Number(refs.monthSelect.value),
      Number(refs.daySelect.value),
      Number(refs.weekdaySelect.value),
    );
    afterAction();
  });
  refs.daySelect.addEventListener('change', () => {
    game.setDate(
      Number(refs.monthSelect.value),
      Number(refs.daySelect.value),
      Number(refs.weekdaySelect.value),
    );
    afterAction();
  });
  refs.weekdaySelect.addEventListener('change', () => {
    game.setDate(
      Number(refs.monthSelect.value),
      Number(refs.daySelect.value),
      Number(refs.weekdaySelect.value),
    );
    afterAction();
  });
  refs.todayBtn.addEventListener('click', () => {
    game.startToday();
    afterAction();
  });
  refs.startTodayBtn.addEventListener('click', () => {
    game.startToday();
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
  refs.undoBtn.addEventListener('click', () => {
    game.undo();
    afterAction();
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    const isUndoKey =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'z';
    if (isUndoKey) {
      if (game.locked) return;
      event.preventDefault();
      game.undo();
      afterAction();
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
  renderBoardPlate(refs.boardWrap);
  afterAction();
  measure();
  return game;
}

function layout(): string {
  const months = MONTH_LABELS.map((label, i) => `<option value="${i + 1}">${label}</option>`).join('');
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const weekdays = WEEKDAY_FULL_LABELS.map((label, i) => `<option value="${i}">${label}</option>`).join('');
  return `
    <div class="app">
      <div class="sidebar">
      <section class="controls" aria-label="Puzzle controls">
        <div class="title-block">
          <h1>Calendar Puzzle</h1>
          <div class="title-date-row">
            <strong id="date-heading" class="date-heading"></strong>
            <button type="button" class="btn secondary" id="today-btn">Today</button>
          </div>
        </div>
        <div class="date-fields">
          <label class="field">Month
            <select id="month-select" aria-label="Month">${months}</select>
          </label>
          <label class="field">Day
            <select id="day-select" aria-label="Day">${days}</select>
          </label>
          <label class="field">Weekday
            <select id="weekday-select" aria-label="Weekday">${weekdays}</select>
          </label>
        </div>
        <div class="stats">
          <div class="stat"><span class="stat-label">Time</span><span class="stat-value" id="stat-timer">0:00</span></div>
          <div class="stat"><span class="stat-label">Hints</span><span class="stat-value" id="stat-hints">0</span></div>
          <div class="stat"><span class="stat-label">Streak</span><span class="stat-value" id="stat-streak">0</span></div>
          <div class="stat"><span class="stat-label">Best</span><span class="stat-value" id="stat-best">—</span></div>
        </div>
        <div class="actions">
          <button type="button" class="btn" id="start-today-btn">Start today</button>
          <button type="button" class="btn secondary" id="rotate-btn">Rotate</button>
          <button type="button" class="btn secondary" id="flip-btn">Flip</button>
          <button type="button" class="btn" id="hint-btn">Hint</button>
          <button type="button" class="btn secondary" id="undo-btn">Undo</button>
          <button type="button" class="btn secondary" id="reset-btn">Reset</button>
        </div>
      </section>
      <div class="status-slot">
        <p class="howto" data-howto="play">
          Leave the month, day, and weekday uncovered. Drag to place, or use <kbd>R</kbd>, <kbd>F</kbd>, <kbd>H</kbd>, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>.
        </p>
        <p class="howto" data-howto="preview">
          Yesterday's solution. Start today's challenge when you're ready.
        </p>
        <div class="solved-banner" id="solved-banner" aria-hidden="true">
          <strong>Solved</strong>
          <p id="solved-body"></p>
        </div>
      </div>
      </div>
      <div class="play-area">
        <div class="board-wrap" id="board-wrap">
          <div class="board" id="board" role="grid" aria-label="Calendar board"></div>
          <p class="board-caption board-caption-tr">Date</p>
          <p class="board-caption board-caption-bl">Leave these open</p>
          <div class="board-pieces" id="board-pieces"></div>
        </div>
        <aside class="tray-panel" id="tray-panel">
          <h2>Pieces</h2>
          <div class="tray" id="tray" aria-label="Piece tray"></div>
        </aside>
      </div>
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
    weekdaySelect: byId<HTMLSelectElement>('weekday-select'),
    todayBtn: byId<HTMLButtonElement>('today-btn'),
    startTodayBtn: byId<HTMLButtonElement>('start-today-btn'),
    dateHeading: byId<HTMLElement>('date-heading'),
    timer: byId<HTMLElement>('stat-timer'),
    hints: byId<HTMLElement>('stat-hints'),
    streak: byId<HTMLElement>('stat-streak'),
    best: byId<HTMLElement>('stat-best'),
    rotateBtn: byId<HTMLButtonElement>('rotate-btn'),
    flipBtn: byId<HTMLButtonElement>('flip-btn'),
    hintBtn: byId<HTMLButtonElement>('hint-btn'),
    undoBtn: byId<HTMLButtonElement>('undo-btn'),
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

function renderBoardPlate(wrap: HTMLElement) {
  wrap.querySelector('.board-plate')?.remove();
  const svg = svgEl('svg', {
    class: 'board-plate',
    viewBox: `0 0 ${COLS} ${ROWS}`,
    'aria-hidden': 'true',
  });
  const rectAttrs = {
    x: '0',
    y: '0',
    width: String(COLS),
    height: String(ROWS),
    rx: '0.14',
    ry: '0.14',
  };
  svg.append(
    svgEl('rect', { class: 'board-frame-edge', ...rectAttrs }),
    svgEl('rect', { class: 'board-frame-stroke', ...rectAttrs }),
    svgEl('rect', { class: 'board-well', ...rectAttrs }),
  );
  wrap.insertBefore(svg, wrap.firstChild);
}


function svgEl(name: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}


function pieceGridLines(
  cells: readonly { r: number; c: number }[],
  size: number,
  box: { minR: number; minC: number },
): SVGElement {
  const filled = new Set(cells.map((cell) => `${cell.r - box.minR},${cell.c - box.minC}`));
  const has = (r: number, c: number) => filled.has(`${r},${c}`);
  const group = svgEl('g', { class: 'piece-grid' });
  for (const key of filled) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    if (has(r, c + 1)) {
      const x = (c + 1) * size;
      group.append(
        svgEl('line', {
          class: 'piece-grid-line',
          x1: String(x),
          y1: String(r * size),
          x2: String(x),
          y2: String((r + 1) * size),
        }),
      );
    }
    if (has(r + 1, c)) {
      const y = (r + 1) * size;
      group.append(
        svgEl('line', {
          class: 'piece-grid-line',
          x1: String(c * size),
          y1: String(y),
          x2: String((c + 1) * size),
          y2: String(y),
        }),
      );
    }
  }
  return group;
}

function createPieceElement(id: PieceId, orientationIndex: number, size: number): HTMLElement {
  const ori = ORIENTATIONS[id][orientationIndex]!;
  const box = boundingBox(ori);
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.piece = id;
  const width = box.width * size;
  const height = box.height * size;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  const d = roundedPolyominoPath(ori, size);
  const uid = `ps${pieceShapeSeq++}`;
  const svg = svgEl('svg', {
    class: 'piece-svg',
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
    'aria-hidden': 'true',
  });
  const defs = svgEl('defs');
  const wood = svgEl('linearGradient', {
    id: `${uid}-wood`,
    x1: '0',
    y1: '0',
    x2: '0',
    y2: '1',
  });
  wood.append(
    svgEl('stop', { offset: '0%', 'stop-color': 'var(--piece-highlight)' }),
    svgEl('stop', { offset: '50%', 'stop-color': 'var(--piece-fill)' }),
    svgEl('stop', { offset: '100%', 'stop-color': 'var(--piece-deep)' }),
  );
  defs.append(wood);
  svg.append(
    defs,
    svgEl('path', {
      class: 'piece-shape',
      d,
      fill: `url(#${uid}-wood)`,
      stroke: 'var(--piece-stroke)',
      'stroke-width': '1',
      'stroke-linejoin': 'round',
    }),
    pieceGridLines(ori, size, box),
  );
  el.appendChild(svg);
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
