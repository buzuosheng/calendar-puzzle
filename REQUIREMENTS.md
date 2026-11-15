# Calendar Puzzle — Requirements and Acceptance

Product name: Calendar Puzzle
Repository: https://github.com/buzuosheng/calendar-puzzle (public)
Language: English only (UI, README, code comments)
Stack: Vite + TypeScript + vanilla DOM (no React/Vue). Pure static frontend. No backend, no accounts, no analytics SDKs required.

## Game rules (locked)

Classic DragonFjord “A Puzzle A Day” calendar.

Board is a 7-column × 7-row grid with 6 unused cells (shown as notched / absent wood, not playable) and 43 playable cells:

```
Jan Feb Mar Apr May Jun  .
Jul Aug Sep Oct Nov Dec  .
  1   2   3   4   5   6  7
  8   9  10  11  12  13 14
 15  16  17  18  19  20 21
 22  23  24  25  26  27 28
 29  30  31  .   .   .  .
```

- 43 playable cells: 12 months + 31 days.
- For a chosen date, leave the month cell and the day cell uncovered.
- Place all 8 pieces so they cover the other 41 cells, do not overlap, and do not cover unused cells or the two date cells.
- Pieces may be rotated in 90° steps and flipped (mirrored).

Piece shapes (official DragonFjord A-Puzzle-A-Day set; `#` = a cell). One hexomino (6) + seven pentominoes (5) = 41 cells:

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

An early draft of this brief labeled some shapes incorrectly (`Y` and `N` were both drawn as L, and an `F` appeared). Those would not match the known census, so the set was corrected to the standard pieces above. Verified totals for this set: **24,405** solutions year-round, min **7** (Oct 6), max **216** (Jan 25), average **~66.7** per day. Tests assert every calendar date (366, including Feb 29) has ≥ 1 solution, and snapshot the Oct 6 and Jan 25 counts.

Default puzzle is the player's local calendar date. A date picker lets them play any month/day (including Feb 29). Changing the date resets the board and timer.

## Features (v1, must have)

1. Drag pieces from a tray onto the board; snap to grid. Invalid placements (overlap, off-board, covering a blocked or date cell) are rejected, not committed.
2. Select a piece (on tray or board). Click-again or press `R` to rotate 90° clockwise. Press `F` or a Flip button to mirror. If a rotation/flip on the board no longer fits, return that piece to the tray (do not leave it overlapping).
3. Timer starts on the first successful placement or the first rotate/flip of a piece after load/reset. Stops when the puzzle is solved. Reset and date change restart the timer.
4. Hint: compute or look up one known solution for the current date and place exactly one not-yet-correct piece into that solution (or return a blocking piece if needed). Record `hintsUsed` for the attempt.
5. On solve: show a clear “Solved” state with time and hint count. Persist in `localStorage` (key prefix `calendar-puzzle:`):
   - current daily streak (consecutive local days solved; timezone = local)
   - best time per date (only update when faster; store hint count with it)
   - last solved local date (for streak)
6. Reset button returns all pieces to the tray and restarts the timer for the same date.
7. Keyboard: `R` rotate, `F` flip, `H` hint, `Esc` deselect. Pointer/touch must work on phone and desktop.
8. Responsive layout: usable on a phone in portrait and on a desktop window. No horizontal page scroll at 375×667 and 1280×800.
9. Visual: clean, modern, wood-inspired (warm wood board, distinct piece colors, high contrast labels). Not a clone of another site’s exact art. English labels: months `Jan`–`Dec`, days `1`–`31`. Title: “Calendar Puzzle”. Short how-to on the page.
10. Solver runs entirely in the browser (bitboard backtracking with precomputed placements). Fast enough that a first solution for any date returns in well under 1 second on a typical laptop. Hints use a deterministic first solution so the same date always hints toward the same arrangement (search order is documented in the README and in `src/solver.ts`).

## Out of scope

Accounts, backend, weekday/10-piece boards, campaign/tutorial level packs, i18n, native apps, social share images, online leaderboards, analytics.

## Engineering

- Vite + TypeScript, vanilla DOM, CSS (no UI framework).
- `npm` scripts: `dev`, `build`, `preview`, `test`.
- Unit tests (Vitest) required:
  - every month/day including Feb 29 has ≥ 1 solution
  - piece orientations generate unique placements only
  - placement legality (overlap, date cells, unused cells)
  - win detection
  - streak logic around midnight / consecutive days (pure functions, injectable clock)
- README: how to run, rules, piece set, deploy notes (static, Vercel root = repo root, build command `npm run build`, output `dist`).
- MIT license.
- `vercel.json` records the static build output. No history-router; the app is served at `/`.
- GitHub Actions CI on `main` and pull requests runs `npm test` and `npm run build`.

## Acceptance (done when all are true)

1. `npm test` and `npm run build` pass.
2. Opening the built site shows today’s date, 8 pieces, and a playable board.
3. A correct arrangement is accepted and the timer stops; an incomplete board is not marked solved.
4. Hint places a valid piece toward a known solution; repeating hints can finish the puzzle.
5. All 366 dates are solvable per tests.
6. Desktop and mobile layouts work as specified.
7. English UI only; no leftover Chinese copy.

Do not ask the user to make product decisions. If something is ambiguous, pick the option that best matches this document and proceed.
