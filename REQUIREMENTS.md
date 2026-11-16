# Calendar Puzzle — Requirements and Acceptance

Product name: Calendar Puzzle
Repository: https://github.com/buzuosheng/calendar-puzzle (public)
Language: English UI in the current build; a Simplified Chinese locale is planned (see Planned). README, requirements, and code comments stay in English.
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
9. Responsive layout: desktop (900px and up) uses a left control sidebar and a right play area (large board, narrower tray), targeted to fit one screen, including a typical 16-inch laptop viewport. Narrower screens compact the top chrome (Today beside the date heading; month and day on one row, weekday full width). The play area becomes board | tray as soon as width allows (from about 600px, and in landscape when height is limited). No horizontal page scroll at 375×667 and 1280×800. The current portrait-phone layout may still need a little vertical scrolling; the Planned mobile adaptation tightens this. Do not drop features on mobile.
10. Visual: cool plaster desk page (`#E2E5DF`), stamp-red primary (`#8A2E2A`), IBM Plex Sans for chrome, and a serif board font on the board and title. Only the board and pieces are light maple, with no wood grain. The board is a full 8×7 rounded rectangle; unused cells stay unplayable under the recessed plaques. Pieces are one solid maple silhouette with a faint dashed internal grid, the same on the board and in the tray. High contrast labels. Not a clone of another site’s exact art. Current English labels: months `Jan`–`Dec`, days `1`–`31`, weekdays `Sun`–`Sat`. Title: “Calendar Puzzle”. Short how-to on the page. Chinese labels are specified under Planned.
11. Solver runs entirely in the browser (bitboard backtracking with precomputed placements). Fast enough that a first solution for any combination returns in well under 1 second on a typical laptop. Hints use a deterministic first solution so the same month/day/weekday always hints toward the same arrangement (search order is documented in the README and in `src/solver.ts`).
12. The playable date is reflected in the URL (`?m=&d=&w=`, or `?date=YYYY-MM-DD`). Opening such a link starts or restores that date in play mode, not the yesterday preview. The document has Open Graph / Twitter tags and a share image at `/og.png`.

## Planned

These items are not in the current build. Decisions below are locked so a later pass can implement them without new product questions.

### Chinese language version

Add a complete Simplified Chinese UI alongside the existing English UI.

- Locales: `en` and `zh-Hans` only. Traditional Chinese is out of scope.
- A visible language control in the chrome switches between **English** and **中文**. Switching updates all visible UI immediately and does not reset the board, timer, or session.
- Persist the choice in `localStorage` under `calendar-puzzle:lang` (`en` | `zh-Hans`).
- If there is no saved choice, default from the browser language: any `zh*` tag → `zh-Hans`, otherwise `en`.
- Update `document.title` and the root `lang` attribute with the active locale. Static Open Graph / Twitter tags may stay in English.
- Keyboard shortcuts (`R`, `F`, `H`, `Ctrl`/`⌘`+`Z`, `Esc`) stay the same in both locales.
- Locked Simplified Chinese copy:

  | English | Chinese |
  |---|---|
  | Calendar Puzzle | 日历拼图 |
  | Today | 今天 |
  | Start today | 开始今日挑战 |
  | Month | 月份 |
  | Day | 日 |
  | Weekday | 星期 |
  | Time | 用时 |
  | Hints | 提示 |
  | Streak | 连续 |
  | Best | 最佳 |
  | Rotate | 旋转 |
  | Flip | 翻转 |
  | Hint | 提示 |
  | Undo | 撤销 |
  | Reset | 重置 |
  | Pieces | 木片 |
  | Date | 日期 |
  | Leave these open | 请留空 |
  | Solved | 已完成 |
  | Jan–Dec | 1月–12月 |
  | Sun–Sat (board) | 日 一 二 三 四 五 六 |
  | Sunday–Saturday (picker) | 星期日–星期六 |
  | Sun, Nov 15 | 周日，11月15日 |

  Play how-to: 将月份、日期和星期三个格子留空。拖动木片放置，或使用 R、F、H，以及 Ctrl/⌘+Z。

  Preview how-to: 这是昨天的解答。准备好后，开始今日挑战。

  Solved / best-time body: `用时 1:23 · 2 次提示` (same pattern as the English `Time 1:23 · 2 hints`).
- Unit tests should cover locale resolution (saved preference wins; `zh*` defaults to Chinese; otherwise English) and that each locale exposes the locked labels above.

### Mobile adaptation

The current narrow layout is a starting point, not the finished phone experience.

- Fit the full UI on one screen with no vertical or horizontal page scroll at common phone sizes, including 375×667 and 390×844 portrait, and the matching landscape sizes (667×375, 844×390). A readable board and the piece tray must both stay on screen.
- Keep every feature available: date controls, stats, Start today / Today, rotate, flip, hint, undo, reset, and the language switch once it exists. Do not hide or drop controls on mobile.
- Touch-first interaction: drag-and-snap must be reliable with a finger; rotate, flip, and other actions must not depend on hover. Hit targets should be at least 44px where the layout allows.
- The tray keeps a minimum height when it is empty, as it already does on desktop.
- The layout may differ from the desktop left sidebar; compactness must not make the chrome feel cramped or the board unreadable.

## Out of scope

Accounts, backend, campaign/tutorial level packs, languages beyond English and Simplified Chinese, native apps, generated per-solve share images, online leaderboards, analytics.

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
- README: how to run, rules, piece set, and planned work. Do not include deployment instructions.
- MIT license.

## Acceptance (done when all are true)

Current build:

1. `npm test` and `npm run build` pass.
2. Opening the built site shows yesterday’s complete solution in a locked preview (local timezone), with Start today beginning a fresh playable 8×7 puzzle for today.
3. A correct arrangement is accepted and the timer stops; an incomplete board is not marked solved.
4. Hint places a valid piece toward a known solution; repeating hints can finish the puzzle.
5. All 2,562 combinations are solvable per tests.
6. The current desktop and narrow layouts work as specified under Features. The Planned mobile adaptation has its own acceptance below.

When the Planned work is done, these are also true:

7. The UI can be used entirely in English or entirely in Simplified Chinese, with the locked copy above, a working language switch, and the saved or browser-language default.
8. The full UI fits on one screen with no page scrolling at 375×667 and 390×844 (portrait and landscape), touch dragging works, and no feature is missing on mobile.

Do not ask the user to make product decisions. If something is ambiguous, pick the option that best matches this document and proceed.
