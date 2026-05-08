# screencast-studio

Subtitled, cursor-overlay demo videos from a Playwright walkthrough.

https://github.com/user-attachments/assets/000481e7-f4b9-4b79-8175-68893c4572b8

> ~2-min demo. White cursor + click ripples are ffmpeg overlays; subtitles are burned in.

The cursor isn't real. Playwright headless has no mouse, so `record.js` just drives the page and logs every click and subtitle as it goes. `postprocess.js` reads that log and ffmpeg-overlays a cursor that glides to each target, drops a Material ripple on click, and burns in subtitles.

Output:

- `final.mp4` — h264, cursor overlay + click ripples + burned-in subtitles
- `review/{flow,visual,coverage}/*.png` — 3-pass screenshot set for QA

## Quick start

Tell Claude:

> 用 screencast-studio 给我录个 demo

It scaffolds `record.js`, `postprocess.js`, `review.js`, and the rest. Then:

```bash
npm install
npx playwright install chromium
npm run setup
npm run login   # only if your target needs auth
# edit the flow in record.js
npm run ship
```

`ship` runs record → render → deploy → review → clean. ~3–5 min for a 2-min demo. The review phase has no progress indicator, so don't assume it hung.

## Authoring

The flow lives inside `record.js`:

```js
await sub('从智能体广场进入项目模块');
const navProj = page.locator('a[href="/projects"]').first();
await click(navProj, '点击侧边栏「项目」');
await sub('多个并行项目');
await scroll(400, 2);
await sub('滚动看更多');
```

Five helpers — `sub` / `click` / `scroll` / `hold` / `tryStep` — cover ~95% of cases. Anonymized full example: [`examples/walkthrough-flow.md`](examples/walkthrough-flow.md).

## Prerequisites

Node 18+. Playwright and ffmpeg-static install via npm; `npx playwright install chromium` once. CJK fonts ship with Windows and macOS; on Linux, `apt install fonts-noto-cjk` (or your distro's equivalent). Full list: [`references/prerequisites.md`](references/prerequisites.md).

## Gotchas

Subtitle count ≠ correctness. Subtitles fire on a timer; they keep going even if a click missed and the page never advanced. Always read the review screenshots after `ship`. More in [`references/known-pitfalls.md`](references/known-pitfalls.md).
