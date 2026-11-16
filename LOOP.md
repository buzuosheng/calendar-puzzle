# Calendar Puzzle — Feature Loop

**Status: completed.** This pass implemented the three items that were locked in [REQUIREMENTS.md](REQUIREMENTS.md): a Simplified Chinese locale, a fuller mobile adaptation, and a per-solve share image. Those are now current features in the README and requirements. This file is kept as a record of the pass.

This loop implements the three planned items already locked in [REQUIREMENTS.md](REQUIREMENTS.md): a Simplified Chinese locale, a fuller mobile adaptation, and a per-solve share image. Do not ask the user for product decisions. If something is ambiguous, follow this document and REQUIREMENTS.md, then continue.

## Rules

- Work in `/workspace/calendar-puzzle`. The Mac checkout at `/Users/wangqi/Projects/calendar-puzzle` is the git source of truth; sync and commit there at the end. Do not `git push` and do not deploy.
- Keep game logic, drag/snap, R / F / H, Undo (Ctrl/Cmd+Z), the date (including weekday) picker, session persistence, and date URLs working. The `localStorage` prefix stays `calendar-puzzle:`.
- Do not restyle the visual design: plaster `#E2E5DF`, stamp-red `#8A2E2A`, IBM Plex Sans for chrome, serif type on the board and title, light-maple board and pieces, no wood grain, faint dashed internal grid on pieces.
- `measure()` must not write `--cell` as an inline style. `is-preview` / `is-solved` live on `#app` (`refs.root`), not `.app`.
- Do not commit `design-system/`. Do not add deployment, Vercel, or CI how-tos to the docs. README, requirements, and code comments stay in English.
- Finish each phase (implementation + tests + that phase’s acceptance) before starting the next. `npx tsc --noEmit` and `npm test` must stay green after every phase. Do not weaken existing solvability, session, URL, or undo tests.

## Baseline (before phase 1)

The current build is an English-only weekday calendar puzzle (8×7, 10 pieces) with yesterday’s locked preview, Start today, session restore, date URLs, and a fixed site preview image at `/og.png`. `npm test` and `npm run build` pass. Desktop uses a left sidebar and a right play area (900px and up). Narrow screens are compacted but portrait phones may still scroll.

## Phase 1 — Chinese language version

### Requirements (locked)

- Locales: `en` and `zh-Hans` only. Traditional Chinese is out of scope.
- A visible language control in the chrome switches between **English** and **中文**. Switching updates all visible UI immediately and does not reset the board, timer, or session.
- Persist the choice in `localStorage` under `calendar-puzzle:lang` (`en` | `zh-Hans`).
- If there is no saved choice, default from the browser language: any `zh*` tag → `zh-Hans`, otherwise `en`.
- Update `document.title` and the root `lang` attribute with the active locale. Static Open Graph / Twitter tags stay in English.
- Keyboard shortcuts (`R`, `F`, `H`, `Ctrl`/`⌘`+`Z`, `Esc`) stay the same in both locales.
- Use this Simplified Chinese copy exactly:

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
  | Share | 分享 |
  | Save image | 保存图片 |
  | Jan–Dec | 1月–12月 |
  | Sun–Sat (board) | 日 一 二 三 四 五 六 |
  | Sunday–Saturday (picker) | 星期日–星期六 |
  | Sun, Nov 15 | 周日，11月15日 |

  Play how-to: 将月份、日期和星期三个格子留空。拖动木片放置，或使用 R、F、H，以及 Ctrl/⌘+Z。

  Preview how-to: 这是昨天的解答。准备好后，开始今日挑战。

  Solved / best-time body: `用时 1:23 · 2 次提示` (same pattern as `Time 1:23 · 2 hints`).

### Implement

- Extract visible strings into a small i18n module. Board labels (`labelFor`, `dateLabel`) and all chrome copy follow the active locale.
- Add the language control, persistence, and defaulting rules above.
- Share / Save image strings may exist in the locale tables in this phase even if the buttons are added in phase 3.

### Test

- Saved preference wins over the browser language.
- Any `zh*` browser tag defaults to `zh-Hans`; otherwise `en`.
- Each locale exposes the locked labels above, including board month/weekday labels and the date heading format.

### Acceptance

- The UI can be used entirely in English or entirely in Simplified Chinese, with the locked copy, a working switch, and the saved or browser-language default.
- Switching language does not reset the board, timer, or session.
- Existing game tests still pass.

## Phase 2 — Mobile adaptation

### Requirements (locked)

- Fit the full UI on one screen with no vertical or horizontal page scroll at 375×667 and 390×844 portrait, and 667×375 and 844×390 landscape. A readable board and the piece tray must both stay on screen.
- Keep every feature available: date controls, stats, Start today / Today, rotate, flip, hint, undo, reset, the language switch, and (after phase 3) share/save-image actions. Do not hide or drop controls on mobile.
- Touch-first interaction: drag-and-snap must be reliable with a finger; rotate, flip, and other actions must not depend on hover. Hit targets should be at least 44px where the layout allows.
- The tray keeps a minimum height when it is empty.
- The layout may differ from the desktop left sidebar; compactness must not make the chrome feel cramped or the board unreadable.
- Desktop (900px and up) still uses the left sidebar / right play-area layout and still fits one screen, including a typical 16-inch laptop viewport.

### Implement

- Tighten the existing one-screen `--cell` formula, stacking, and spacing. Do not start a visual redesign.
- Make controls comfortably tappable on a phone.

### Test

- Add or update layout tests / CSS checks for the listed phone sizes (no page scroll; board and tray both on screen) where this can be asserted automatically. If a check cannot be fully automated, document the exact breakpoints and formula used.

### Acceptance

- The full UI fits on one screen with no page scrolling at 375×667 and 390×844 (portrait and landscape).
- Touch dragging works; no feature is missing on mobile.
- Desktop one-screen sidebar layout is unchanged in structure and still fits.

## Phase 3 — Per-solve share image

### Requirements (locked)

This is not the fixed `/og.png` used for link previews.

- Generate the image entirely in the browser (canvas). No backend.
- Offer it on the solved banner, including when an already-solved session is restored. Do not offer it in preview mode, and do not generate or share automatically.
- The card includes the title, the puzzle date, the player's finished board, the time, and the hint count. Streak may be included if it fits the layout.
- Visual style matches the game: plaster background `#E2E5DF`, stamp-red accents `#8A2E2A`, light-maple board and pieces with no wood grain, IBM Plex Sans for chrome and the serif board font on the board.
- Output a PNG, 1080×1350 (4:5). Filename: `calendar-puzzle-<month>-<day>-<weekday>.png` (for example `calendar-puzzle-11-15-0.png`).
- **Save image** downloads the PNG. **Share** uses the Web Share API with that file when the browser can share files; otherwise it falls back to the same download. The player always opts in.
- Card copy follows the active locale, including **Share** / **分享** and **Save image** / **保存图片**.

### Implement

- Add a canvas card builder and Save / Share actions on the solved banner.
- Restore-from-session solved state must still offer the card.

### Test

- Filename construction is correct.
- A solved state produces a PNG of the expected size.
- Preview and unsolved states do not generate a card.

### Acceptance

- After a solve, the player can save or share a generated card of this attempt (date, finished board, time, and hint count).
- The fixed site preview image at `/og.png` is unchanged.

## Phase 4 — Docs and handoff

- Move the three items out of Planned in README and REQUIREMENTS into the current product description, features, and acceptance. Keep this LOOP.md as a record of the pass, or note that it has been completed.
- Do not add deployment instructions.
- Sync the project to the Mac checkout, commit the source and docs, and leave the commit unpushed. Leave `design-system/` untracked.

## Done when all are true

1. Phases 1–3 acceptance items pass.
2. `npx tsc --noEmit` is clean and `npm test` passes, including the new locale, layout (if automated), and share-image tests.
3. README and REQUIREMENTS describe the Chinese locale, mobile layout, and per-solve share image as current features, not as planned work.
4. Changes are committed on the Mac and have not been pushed or deployed.

Phases 1–3 of this record are complete in `/workspace/calendar-puzzle`. The workspace changes have not been pushed or deployed; committing on the Mac is left to the parent sync.
