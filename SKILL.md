---
name: screencast-demo
description: Produce subtitled, cursor-overlay product demo videos from a Playwright-driven walkthrough. Output is a final.mp4 (synthetic cursor lerp + Material click ripples + burned-in subtitles) plus a 3-pass review screenshot set for visual QA. Activate when the user wants a polished web-app walkthrough video, OSS feature demo, bug repro screencast, or tutorial recording — anything where they need a "professional looking" demo video of a web UI.
version: 0.1.0
---

# Screencast Demo

Produce **subtitled, cursor-overlay product demo videos** from a Playwright-driven walkthrough.

The central insight: **a Playwright headless recording has no real cursor**. The visual cursor + click ripples + subtitles you see in the final video are **ffmpeg overlays composed from a structured events log**, not real mouse events. This decoupling lets the recording script stay declarative ("click this, narrate that") while the production-quality visuals (smooth cursor lerp, ripple flash, subtitle timing) come for free from the post-processor.

## When to use

Activate when the user asks for any of:

- A polished **product walkthrough video** of a web app
- An **OSS feature demo** for a README or release announcement
- A **bug repro screencast** with narrated steps
- A **tutorial / onboarding video** showing how to do something in a browser-based UI
- Anything where the user said "录 demo / 录视频 / screencast / walkthrough video / 演示视频"

Don't activate when:

- The user wants to record **non-browser content** (use OBS / native screen recorders)
- A single screenshot or a static image would suffice
- The user wants to record **real mouse motion** (this skill draws a synthetic cursor)
- The target UI is mobile-only (Playwright supports mobile emulation, but the cursor + ripple visuals are tuned for desktop viewports)

## Pipeline overview

```
gen-cursor + gen-ripple  →  cursor.png, ripple.png        (one-time)
login                    →  storageState.json + page summary
record                   →  raw.webm + events.json
postprocess              →  final.mp4 + subs.srt
deploy                   →  output/screencast-{stamp}.mp4
review                   →  review/{flow,visual,coverage}/*.png
clean                    →  drop scratch files
```

`npm run ship` runs record → postprocess → deploy → review → clean as one command.

## Bootstrapping a new project

When the user says they want to record a demo for some web app, do this:

### 1. Gather what you need to know

Ask the user (briefly, ideally in one round):

- **Target URL** (the BASE — local `http://localhost:3000` or remote)
- **Login path** if not `/login`
- **Working directory** for the demo project (e.g. `D:\AI\my-demo` or `~/projects/my-demo`)
- Whether they need a **deploy directory** (default is `./output/`)
- Viewport size if other than `1440x900`

### 2. Scaffold the project

Copy templates into the working directory:

```
templates/record.js          → <working-dir>/record.js
templates/postprocess.js     → <working-dir>/postprocess.js
templates/review.js          → <working-dir>/review.js
templates/login.js           → <working-dir>/login.js
templates/gen-cursor.js      → <working-dir>/gen-cursor.js
templates/gen-ripple.js      → <working-dir>/gen-ripple.js
templates/deploy.js          → <working-dir>/deploy.js
templates/clean.js           → <working-dir>/clean.js
templates/package.json       → <working-dir>/package.json
```

Then in the working directory:

```bash
npm install
npx playwright install chromium
```

### 3. Configure

The templates already accept these env vars (no code edit needed for most cases):

- `SCREENCAST_BASE` — target URL
- `SCREENCAST_LOGIN_PATH` — defaults to `/login`
- `SCREENCAST_VIEWPORT_W` / `SCREENCAST_VIEWPORT_H` — defaults 1440/900
- `DEPLOY_DIR` — defaults to `./output/`
- `DEPLOY_PREFIX` — defaults to `screencast`
- `SUBTITLE_FONT` — overrides the platform-detected CJK font

For a one-off, edit `record.js` lines 22-26 directly.

### 4. Run setup + (optionally) login

```bash
npm run setup      # generates cursor.png and ripple.png
npm run login      # opens a real browser; user logs in manually
```

**Skip `npm run login` if your target page is public** (no auth needed). `record.js` will run without a `storageState.json` if the file doesn't exist — the demo just won't have any logged-in session. The `npm run login` step exists specifically for apps behind a login screen.

After `npm run login` (when used), `post-login-summary.json` will contain visible nav / heading / button text. **Read this file before authoring the stage flow** — it tells you what selectors are available without poking the live UI.

### 5. Author the stage flow

Edit the body of the `try { ... }` block in `record.js` (search for `STAGE FLOW`). Use the helpers documented in [references/helpers-api.md](references/helpers-api.md). For a fuller pattern guide see [examples/walkthrough-flow.md](examples/walkthrough-flow.md).

### 6. Ship

```bash
npm run ship
```

This runs the full pipeline (record → postprocess → deploy → review → clean). On a 2-minute demo with ~20 clicks, expect:

- record: ~2-3 minutes (real-time playthrough plus dwell times)
- postprocess: ~30-60 seconds (ffmpeg compositing)
- review: ~30-60 seconds (n × ffmpeg seek+frame extraction; **no progress indicator, just waits silently — that's normal**)

After it completes, **read the review screenshots** to verify the demo actually looks correct — see [references/known-pitfalls.md](references/known-pitfalls.md) for what to watch for.

## Authoring helpers (quick reference)

Inside the `try { ... }` block of `record.js`:

| Helper | What it does |
|---|---|
| `await sub('subtitle text')` | Adds a subtitle event + holds the page for a CJK-aware duration |
| `await click(locator, '操作描述')` | Cursor moves to target, dwells, clicks, dwells (full ceremony) |
| `await scroll(deltaY, ticks=1)` | Wheel-scrolls main content area (mouse parks in viewport center first) |
| `await hold(ms=400)` | Explicit pause |
| `await tryStep('name', async () => { ... })` | Non-fatal stage; if it throws, log and continue |
| `page` | The underlying Playwright Page (escape hatch for anything the helpers don't cover) |

Full API in [references/helpers-api.md](references/helpers-api.md).

## Authoring tips

- **Stage flow is a sequence of `sub` + `click` + `scroll` + `hold` calls.** Think of `sub` as the narrator's voice and `click`/`scroll` as the action.
- **Wrap risky steps in `tryStep`** if the UI surface depends on data that may not exist (e.g. an empty list view has no rows to click).
- **Don't fight Playwright's auto-waiting** — selectors should target visible elements; if you need to wait for something to appear, use `await locator.waitFor({ state: 'visible' })` before clicking.
- **Prefer text-based selectors with `exact: true`** for robustness:
  - `page.getByText('Save', { exact: true })` ✓
  - `page.locator('text=Save')` ✗ (matches "Save", "Saved", "Save changes" — substring match)
- **Subtitles narrate, not describe**. "进入项目模块" is better than "I am clicking the projects tab".

## Prerequisites

See [references/prerequisites.md](references/prerequisites.md) for the full list. Summary:

**Auto-installed by `npm install`**: playwright, ffmpeg-static, fluent-ffmpeg

**OS-level**: Node 18+; chromium binary (one-time `npx playwright install chromium`); a CJK font (Microsoft YaHei on Windows / PingFang SC on macOS / Noto Sans CJK SC on Linux — the postprocess auto-detects)

**Project-specific**: the target web app's URL and login credentials; optionally test files for upload stages and a deploy directory

## Known pitfalls

See [references/known-pitfalls.md](references/known-pitfalls.md). The big ones:

- **Cursor disappears off-frame** if a click target is below the viewport — the `click` helper auto-scrolls into view, but if you bypass it (e.g. raw `locator.click()`), the synthetic cursor will fly to coordinates outside the recorded frame.
- **Wheel scrolls the wrong container** if you don't park the mouse first — the `scroll` helper does this, but raw `page.mouse.wheel(0, dy)` from cold-start will scroll whatever element is at (0, 0) (usually the sidebar).
- **`text=...` is substring match** — use `getByText(s, { exact: true })` for precision.
- **Subtitle count ≠ done.** `report.txt` shows the events fired, not that the demo *looks correct*. The 3-pass review screenshots exist precisely so you (or the user) can verify visually after every ship.

## Reference docs

- [prerequisites.md](references/prerequisites.md) — full setup checklist incl. cross-platform
- [helpers-api.md](references/helpers-api.md) — full helper API + tuning knobs
- [events-schema.md](references/events-schema.md) — events.json structure + how postprocess consumes it
- [ffmpeg-pipeline.md](references/ffmpeg-pipeline.md) — what the post-processor actually does
- [known-pitfalls.md](references/known-pitfalls.md) — every pitfall encountered + how to avoid

## Example

- [examples/walkthrough-flow.md](examples/walkthrough-flow.md) — anonymized walkthrough of a real project demo (file manager + multi-tab UI), showing every stage pattern.
- [examples/sample-output/final.mp4](examples/sample-output/final.mp4) — the actual ~2-minute video produced by that walkthrough, so you can see what the synthetic cursor + ripple + subtitles look like in motion.
- [examples/sample-output/screenshots/](examples/sample-output/screenshots/) — 4 representative stills from the same video.
