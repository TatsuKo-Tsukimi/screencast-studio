# screencast-studio

Produce subtitled, cursor-overlay product demo videos from a Playwright-driven walkthrough.

![overview stage](examples/sample-output/screenshots/01-overview.png)
![files tab](examples/sample-output/screenshots/02-files-tab.png)
![sort dropdown](examples/sample-output/screenshots/03-sort-dropdown.png)
![markdown preview](examples/sample-output/screenshots/04-markdown-preview.png)

> Frames pulled from a real ~2-minute demo. The synthetic cursor (white arrow) and click ripples are ffmpeg overlays; subtitles are burned in. See [examples/sample-output/final.mp4](examples/sample-output/final.mp4) for the full video.


The recording is cursorless (Playwright headless has no real mouse). The visual cursor + click ripples + subtitles you see in the final video are **ffmpeg overlays composed from a structured event log**, not real mouse events. This decoupling lets the recording script stay declarative ("click this, narrate that") while the production-quality visuals come for free from the post-processor.

Output:

- `final.mp4` — h264 video with synthetic cursor lerp, Material click ripples, burned-in subtitles
- `review/{flow,visual,coverage}/*.png` — 3-pass screenshot set for visual QA

## 30-second tour

1. Tell Claude `用 screencast-studio 给我录个 demo`
2. Claude scaffolds a project: `record.js / postprocess.js / review.js / login.js / gen-cursor.js / gen-ripple.js / deploy.js / clean.js / package.json`
3. `npm install && npx playwright install chromium && npm run setup`
4. `npm run login` — only if your target needs auth; skip for public pages
5. Edit the stage flow in `record.js` (the only file you author, ~10-30 lines per stage)
6. `npm run ship` — record + render + deploy + review + clean (~3-5 min for a 2-min demo; review phase has no progress indicator)

## What you write

Inside the `try { ... }` block in `record.js`:

```js
await sub('从智能体广场进入项目模块');
const navProj = page.locator('a[href="/projects"]').first();
await click(navProj, '点击侧边栏「项目」');
await sub('多个并行项目');
await scroll(400, 2);
await sub('滚动看更多');
```

Five helpers cover ~95% of demo authoring: `sub` / `click` / `scroll` / `hold` / `tryStep`.

## What you get

- Smooth cursor that visibly approaches each click target before clicking
- Material-style click ripples
- CJK-capable burned-in subtitles, auto-timed by character count
- 3-pass review screenshots so you (or Claude) can verify the demo *looks correct* — not just that the events fired

## Cross-platform

- **Windows / macOS** — works out of the box (CJK fonts built-in)
- **Linux** — works after `apt install fonts-noto-cjk` (or distro equivalent)

## Prerequisites

- Node 18+, network access
- Auto-installed via npm: playwright, ffmpeg-static
- One-time: `npx playwright install chromium`

See `references/prerequisites.md` for full list.

## Authoring example

See `examples/walkthrough-flow.md` for an anonymized full-length demo (multi-tab UI walkthrough with file uploads).

## Known pitfalls

See `references/known-pitfalls.md`. The biggest one: **subtitle count ≠ recording correctness**. Always read the review screenshots after every ship.
