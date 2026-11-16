# Calendar Puzzle — Requirements and Acceptance

Product name: Calendar Puzzle
Repository: https://github.com/buzuosheng/calendar-puzzle (public)
Language: English only (UI, README, code comments)
Stack: Vite + TypeScript + vanilla DOM (no React/Vue). Pure static frontend. No backend, no accounts, no analytics SDKs required.

## Game rules (locked)

Well-known weekday (DOTY-style) calendar puzzle: month + day + weekday.

Board is a full regular 7-column × 8-row rectangle (not a notched plate) with 6 unused cells and 50 playable cells. Unused cells stay unplayable; those regions show darker recessed plaques labeled **Date** (top-right, vertical) and **Leave these open** (bottom-left, along the unused row):

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

- 50 playable cells: 12 months + 31 days + 7 weekdays.
- Unused cells: (0,6), (1,6), (7,0), (7,1), (7,2), (7,3).
- For a chosen date, leave the month cell, the day cell, and the weekday cell uncovered.
- Place all 10 pieces so they cover the other 47 cells, do not overlap, and do not cover unused cells or the three date cells.
- Pieces may be rotated in 90° steps and flipped (mirrored).
- Weekday index matches `Date#getDay()`: 0 = Sunday … 6 = Saturday.
  Sun (6,3), Mon (6,4), Tue (6,5), Wed (6,6), Thu (7,4), Fri (7,5), Sat (7,6).

Piece shapes (`#` = a cell). Seven pentominoes (5) + three tetrominoes (4) = 47 cells:

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

This set has at least one solution for every one of the 366 × 7 = **2,562** valid month/day/weekday combinations, including 29 Feb. Tests assert existence for all 2,562. Invalid days (for example 31 Apr) are skipped.

On load, the board shows yesterday's complete canonical solution in a locked preview, using the player's local timezone (1 January wraps to 31 December). Start today, or changing the date picker, begins a fresh play for today or that date and resets the board and timer. The Today control is hidden during the preview; in play mode it sits beside the date heading so the player can jump back to today. A date picker lets them play any month/day/weekday (including Feb 29).

If a play session is stored (Start today, a mid-play board, or a solved board), a refresh restores that session instead of the preview. The session stores the date, piece placements, hint count, timer, and whether this attempt was already saved. The undo stack is not persisted and is cleared on refresh. Preview mode does not write a session.

Playable dates are shown in the URL as `?m=&d=&w=`. `?date=YYYY-MM-DD` is also accepted and uses that date’s local weekday. Preview uses a clean path with no query string. Date changes use `replaceState`.

## Features (v1, must have)

1. Drag pieces from a tray onto the board; snap to grid. Invalid placements (overlap, off-board, covering a blocked or date cell) are rejected, not committed.
2. Select a piece (on tray or board). Click-again or press `R` to rotate 90° clockwise. Press `F` or a Flip button to mirror. If a rotation/flip on the board no longer fits, return that piece to the tray (do not leave it overlapping).
3. Timer starts on the first successful placement or the first rotate/flip of a piece after load/reset. Stops when the puzzle is solved. Reset and date change restart the timer.
4. Hint: compute or look up one known solution for the current date and place exactly one not-yet-correct piece into that solution (or return a blocking piece if needed). Record `hintsUsed` for the attempt.
5. On solve: show a clear “Solved” state with time and hint count. Persist in `localStorage` (key prefix `calendar-puzzle:`):
   - current daily streak (consecutive local days solved; timezone = local). A solve counts for the streak only when month, day, and weekday all match the real local today.
   - best time per month/day/weekday (only update when faster; store hint count with it). Older 7×7 month/day-only keys are left or ignored and must not crash load.
   - last solved local date (for streak)
   - the current play session (date, placements, hints, timer, solved flag) so a refresh restores mid-play or a finished solve instead of yesterday’s preview. An already-saved solve must not be recorded twice. Invalid session data is ignored.
6. Reset button returns all pieces to the tray and restarts the timer for the same date.
7. Keyboard: `R` rotate, `F` flip, `H` hint, `Ctrl+Z` / `Cmd+Z` undo, `Esc` deselect. The undo shortcut is ignored when the focus is in a select, when only `Z` is pressed, or when the board is locked. Pointer/touch must work on phone and desktop.
8. Undo reverts the last committed change (successful place, return to tray, rotate, flip, or hint, including a hint that returns a blocker). It restores piece positions, selection, and `hintsUsed`, but not the timer, date, mode, streak, or best times. The stack is not persisted and is cleared on reset, Start today, and date changes. After a solve, Undo is disabled so a persisted win is never un-saved.
9. Responsive layout: desktop (900px and up) uses a left control sidebar and a right play area (large board, narrower tray), targeted to fit one screen, including a typical 16-inch laptop viewport. Narrower screens compact the top chrome (Today beside the date heading; month and day on one row, weekday full width). The play area becomes board | tray as soon as width allows (from about 600px, and in landscape when height is limited). No horizontal page scroll at 375×667 and 1280×800. Portrait phones may still need a little vertical scrolling if a readable board cannot share one screen with the chrome; landscape and desktop should not need a vertical scroll for the full UI. Do not drop features on mobile.
10. Visual: cool plaster desk page (`#E2E5DF`), stamp-red primary (`#8A2E2A`), IBM Plex Sans for chrome, and a serif board font on the board and title. Only the board and pieces are light maple, with no wood grain. The board is a full 8×7 rounded rectangle; unused cells stay unplayable under the recessed plaques. Pieces are one solid maple silhouette with a faint dashed internal grid, the same on the board and in the tray. High contrast labels. Not a clone of another site’s exact art. English labels: months `Jan`–`Dec`, days `1`–`31`, weekdays `Sun`–`Sat`. Title: “Calendar Puzzle”. Short how-to on the page.
11. Solver runs entirely in the browser (bitboard backtracking with precomputed placements). Fast enough that a first solution for any combination returns in well under 1 second on a typical laptop. Hints use a deterministic first solution so the same month/day/weekday always hints toward the same arrangement (search order is documented in the README and in `src/solver.ts`).
12. The playable date is reflected in the URL (`?m=&d=&w=`, or `?date=YYYY-MM-DD`). Opening such a link starts or restores that date in play mode, not the yesterday preview. The live site is https://puzzle.buzuosheng.tech. The document has Open Graph / Twitter tags and a share image at `/og.png`.

## Out of scope

Accounts, backend, campaign/tutorial level packs, i18n, native apps, generated per-solve share images, online leaderboards, analytics.

## Engineering

- Vite + TypeScript, vanilla DOM, CSS (no UI framework).
- `npm` scripts: `dev`, `build`, `preview`, `test`.
- Unit tests (Vitest) required:
  - every month/day/weekday including Feb 29 has ≥ 1 solution (2,562 combinations)
  - piece orientations generate unique placements only; 7 pentominoes + 3 tetrominoes = 47 cells
  - placement legality (overlap, date cells, unused cells) and win detection with three uncovered cells
  - Game applies a canonical solution and marks solved; hint still works
  - Undo restores a successful place or hint (including `hintsUsed`); reset and date changes clear the stack; undo is a no-op when locked or empty; illegal places do not push history
  - streak logic around midnight / consecutive days (pure functions, injectable clock); a solve counts for “today” only when month+day+weekday match
  - a mid-play session is saved and restored with the timer still running; a solved session is restored without recording the streak again; preview does not write a session; Start today writes an empty play session; illegal sessions are ignored
  - URL parsing for `m`/`d`/`w` and `date=YYYY-MM-DD`; resolveStart prefers a matching session, otherwise a URL date, otherwise preview
- README: how to run, rules, piece set, deploy notes (static, Vercel root = repo root, build command `npm run build`, output `dist`).
- MIT license.
- `vercel.json` records the static build output. No history-router; the app is served at `/`.
- GitHub Actions CI on `main` and pull requests runs `npm test` and `npm run build`.

## Acceptance (done when all are true)

1. `npm test` and `npm run build` pass.
2. Opening the built site shows yesterday’s complete solution in a locked preview (local timezone), with Start today beginning a fresh playable 8×7 puzzle for today.
3. A correct arrangement is accepted and the timer stops; an incomplete board is not marked solved.
4. Hint places a valid piece toward a known solution; repeating hints can finish the puzzle.
5. All 2,562 combinations are solvable per tests.
6. Desktop and mobile layouts work as specified.
7. English UI only; no leftover Chinese copy.

Do not ask the user to make product decisions. If something is ambiguous, pick the option that best matches this document and proceed.
