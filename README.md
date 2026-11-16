# Calendar Puzzle

A pure-frontend, English-only daily calendar polyomino puzzle. Leave the month, the day, and the weekday uncovered, then fit all ten pieces on the remaining 47 squares. Pieces may be rotated and flipped.

This is an original web implementation of the well-known weekday (DOTY-style) calendar puzzle: an 8×7 board with 50 playable cells. It is not an official product of any commercial puzzle brand.

## How to run

```bash
npm install
npm test
npm run dev
npm run build
npm run preview
```

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite (including a solvability check of all 2,562 month/day/weekday combinations).
- `npm run build` type-checks and writes a static site to `dist/`.
- `npm run preview` serves the production build locally.

## Rules

The board is a full regular 8×7 rectangle with 50 playable cells (12 months, 31 days, and 7 weekdays) and 6 unused cells. Unused cells are not notched out of the plate; they stay unplayable and are marked with darker recessed plaques: a vertical **Date** plaque in the top-right unused region, and **Leave these open** across the unused cells on the bottom row.

```
Jan Feb Mar Apr May Jun  .
Jul Aug Sep Oct Nov Dec  .
 1   2   3   4   5   6   7
 8   9  10  11  12  13  14
15  16  17  18  19  20  21
22  23  24  25  26  27  28
29  30  31 Sun Mon Tue Wed
 .   .   .   .  Thu Fri Sat
```

For a chosen month, day, and weekday, those three cells stay uncovered. Place all 10 pieces so they cover the other 47 cells, do not overlap, and do not cover unused cells or the three date cells.

On load, the board shows yesterday’s complete canonical solution in a locked preview, using the player’s local timezone (1 January wraps to 31 December). **Start today**, or changing the date picker, begins a fresh play for today or that date. The **Today** control is hidden during the preview; once play has started, it sits beside the date heading so you can jump back to today from another date. Dates use the local weekday (`Date#getDay()`, Sunday = 0). The date picker can load any month/day/weekday, including 29 Feb.

## Piece set

Seven pentominoes (`V`, `T`, `Z`, `L`, `N`, `P`, `U`) and three tetrominoes (`J`, `S`, `I`). `#` is a filled cell. Pieces may be rotated in 90° steps and flipped. All pieces share the same light maple finish and are distinguished by shape.

```
V      T      Z      L
#..    ###    ##.    ##
#..    .#.    .#.    #.
###    .#.    .##    #.
                     #.

N      P      U      J
#.     ##     ##     ##
##     ##     #.     #.
.#     #.     ##     #.
.#

S      I
#.     #
##     #
.#     #
       #
```

This set is known to have at least one solution for every one of the 366 × 7 = **2,562** valid month/day/weekday combinations, including 29 Feb. The test suite asserts existence for all 2,562. Invalid days (for example 31 Apr) are skipped.

## Controls

- Drag a piece from the tray onto the board. It snaps to the grid. Illegal placements (overlap, off-board, unused cell, or date cell) are rejected and not committed.
- Click a piece to select it. Click it again, press **R**, or use **Rotate** to turn it 90° clockwise. Press **F** or **Flip** to mirror it. If a rotation or flip on the board no longer fits, the piece returns to the tray.
- **H** or **Hint** places one piece toward the canonical solution for the current date (or returns a blocking piece if needed). Repeated hints can finish the puzzle.
- **Undo** or **Ctrl+Z** / **Cmd+Z** reverts the last committed change (a successful placement, a return to the tray, rotate, flip, or hint, including a hint that returns a blocker). The shortcut is ignored when the focus is in a date select, when only **Z** is pressed, or when the board is locked. Undo restores piece positions, selection, and `hintsUsed`. It does not rewind the timer, date, mode, streak, or best times, and the undo stack is not persisted. Reset, Start today, and changing the date clear the stack. After a solve, Undo is disabled, so a persisted win is never un-saved.
- **Esc** deselects. **Reset** returns every piece to the tray and restarts the timer for the same date.
- The timer starts on the first successful placement, or the first rotate/flip, after load or reset. It stops when the puzzle is solved.

## Layout

On a desktop window (900px and up) the controls sit in a left sidebar (title, date heading and Today, month/day on one row and weekday below, stats, and actions) and the board plus a narrower piece tray sit on the right. The layout is meant to fit on one screen, including a typical 16-inch laptop viewport.

On narrower screens the same controls are compacted at the top. As soon as the width can fit a readable board beside a narrow tray (from about 600px, and in landscape when height is limited), the play area is board | tray. Portrait phones may still need a little vertical scrolling if a readable board cannot share one screen with the chrome; landscape and desktop should not need a vertical scroll for the full UI. There is no horizontal page scroll at 375×667 or typical phone widths.

Progress is stored only in `localStorage` under the key prefix `calendar-puzzle:` (daily streak, last solved local date, and best time plus hint count per month/day/weekday). A solve counts toward the daily streak only when the puzzle’s month, day, and weekday all match the real local today. Best times are keyed with the weekday (for example `11-15-0`). Older month/day-only keys from the previous 7×7 game are left in place and ignored. There is no account and no backend.

## Solver and hint search order

The solver is a bitboard backtracker that runs entirely in the browser. A first solution for any combination is found in well under a second.

Hints always use the **first** solution found under this fixed order, so the same month/day/weekday always points at the same arrangement:

1. Always cover the lowest-index remaining cell (`index = row * 7 + col`, row-major, top-left first).
2. Try pieces in the order `V`, `T`, `Z`, `L`, `N`, `P`, `U`, `J`, `S`, `I`.
3. For each piece, try precomputed placements that cover that cell, in generation order: unique orientations (unflipped then flipped; for each, rotations 0°, 90°, 180°, 270° clockwise, first-seen only), and for each orientation, origins in row-major order.

## Deploy

This is a static Vite site. There is no client-side history router; the app is served at `/`.

To deploy on Vercel:

- Root directory: the repository root
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other (or Vite)

A minimal `vercel.json` records those settings. The same static `dist` output can also be served from any static host. `vite.config.ts` sets `base: './'` so relative asset paths work.

GitHub Actions CI (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on `main` and on pull requests.

## License

MIT. See [LICENSE](LICENSE).
