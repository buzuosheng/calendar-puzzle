# Calendar Puzzle

A pure-frontend, English-only daily calendar polyomino puzzle. Leave the month and the day uncovered, then fit all eight pieces on the remaining 41 squares. Pieces may be rotated and flipped.

This is an original web implementation of the classic DragonFjord **A Puzzle A Day** board and piece set. It is not an official product.

## How to run

```bash
npm install
npm test
npm run dev
npm run build
npm run preview
```

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite (including a solvability check of all 366 dates).
- `npm run build` type-checks and writes a static site to `dist/`.
- `npm run preview` serves the production build locally.

## Rules

The board is a 7×7 grid with 6 unused (notched) cells and 43 playable cells: 12 months and 31 days.

```
Jan Feb Mar Apr May Jun  .
Jul Aug Sep Oct Nov Dec  .
  1   2   3   4   5   6  7
  8   9  10  11  12  13 14
 15  16  17  18  19  20 21
 22  23  24  25  26  27 28
 29  30  31  .   .   .  .
```

For a chosen date, the month cell and the day cell stay uncovered. Place all 8 pieces so they cover the other 41 cells, do not overlap, and do not cover unused cells or the two date cells.

The default puzzle is today’s date in the player’s local timezone. The date picker can load any month/day, including 29 Feb.

## Piece set

Official DragonFjord A-Puzzle-A-Day set: one hexomino (`O`) and seven pentominoes (`L`, `N`, `P`, `U`, `V`, `Y`, `Z`). `#` is a filled cell. Pieces may be rotated in 90° steps and flipped.

```
O (hexomino 3×2)
###
###

L
#
#
#
##

N
  ##
###

P
##
###

U
# #
###

V
#
#
###

Y
 #
####

Z
##
 #
 ##
```

This set is known to have **24,405** solutions across the 366-day calendar (including 29 Feb), with a minimum of **7** on 6 Oct, a maximum of **216** on 25 Jan, and an average of about **66.7** per day. The test suite asserts that every date has at least one solution, and snapshots the Oct 6 and Jan 25 counts.

### Correction from the first draft brief

An early brief drew `Y` and `N` both as the L pentomino and included an `F` pentomino. Those shapes are not the standard set and were replaced with the official `L`, `N`, `Y` (and `V` in place of the mislabeled “L”) shown above.

## Controls

- Drag a piece from the tray onto the board. It snaps to the grid. Illegal placements (overlap, off-board, unused cell, or date cell) are rejected and not committed.
- Click a piece to select it. Click it again, press **R**, or use **Rotate** to turn it 90° clockwise. Press **F** or **Flip** to mirror it. If a rotation or flip on the board no longer fits, the piece returns to the tray.
- **H** or **Hint** places one piece toward the canonical solution for the current date (or returns a blocking piece if needed). Repeated hints can finish the puzzle.
- **Esc** deselects. **Reset** returns every piece to the tray and restarts the timer for the same date.
- The timer starts on the first successful placement, or the first rotate/flip, after load or reset. It stops when the puzzle is solved.

Progress is stored only in `localStorage` under the key prefix `calendar-puzzle:` (daily streak, last solved local date, and best time plus hint count per month/day). There is no account and no backend.

## Solver and hint search order

The solver is a bitboard backtracker that runs entirely in the browser. A first solution for any date is found in well under a second.

Hints always use the **first** solution found under this fixed order, so the same date always points at the same arrangement:

1. Always cover the lowest-index remaining cell (`index = row * 7 + col`, row-major, top-left first).
2. Try pieces in the order `O`, `L`, `N`, `P`, `U`, `V`, `Y`, `Z`.
3. For each piece, try precomputed placements that cover that cell, in generation order: unique orientations (unflipped then flipped; for each, rotations 0°, 90°, 180°, 270° clockwise, first-seen only), and for each orientation, origins in row-major order.

## Deploy

This is a static Vite site. There is no client-side history router; the app is served at `/`.

On Vercel:

- Root directory: the repository root
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other (or Vite)

A minimal `vercel.json` records those settings. GitHub Pages also works if the site is served from `dist` with `base: './'` (already set in `vite.config.ts`).

GitHub Actions CI (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on `main` and on pull requests.

## License

MIT. See [LICENSE](LICENSE).
