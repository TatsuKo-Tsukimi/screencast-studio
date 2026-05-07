# events.json schema

`events.json` is the structured log produced by `record.js` and consumed by `postprocess.js` + `review.js`. It is a JSON array of events sorted by `t` (seconds since recording start).

## Event types

```ts
type Event =
  | { t: number, kind: "subtitle", label: string }
  | { t: number, kind: "move", x: number, y: number }
  | { t: number, kind: "click", x: number, y: number, label: string }
```

### `subtitle`

Renders a burned-in subtitle from time `t` until the next `subtitle` event (or 3 seconds if it's the last one).

```json
{ "t": 22.51, "kind": "subtitle", "label": "项目简报 — 结构化模板" }
```

### `move`

Cursor movement target. The synthetic cursor lerps from its current position to `(x, y)` over the interval until the next cursor event.

```json
{ "t": 22.80, "kind": "move", "x": 1022, "y": 748 }
```

`move` events are pushed by the `click` helper *before* the actual click (with a 700ms gap by default), so the cursor visibly arrives at the target before the click fires.

### `click`

Click flash. Triggers the ripple overlay at `(x, y)` and contributes to the cursor lerp endpoint.

```json
{ "t": 23.21, "kind": "click", "x": 1022, "y": 748, "label": "点击「Open BRIEF」" }
```

The `label` is also written to `subs.srt` only if no nearby subtitle exists (cluster collapse keeps subtitle and click labels from stacking).

## How postprocess consumes events

In order:

1. **Subtract `CALIBRATION = 0.65s` from every `t`** — the gap between Playwright's `newPage()` and our `tStart = Date.now()`.
2. **Sort by `t`**.
3. **Filter cursor events** = `move` + `click`. Pass to `addRestEvents` which inserts a "rest" entry at `next.t - REST_LEAD` for any gap > 0.9s, so the cursor stays put before lerping to the next position rather than slowly drifting the entire interval.
4. **Build a piecewise lerp expression** for cursor X / Y as a function of video time `t`. Two ghost cursors trail the main cursor with `dt=0.10s`/`dt=0.20s` and reduced alpha.
5. **Build ripple overlay chains** — each `click` event spawns 2 expanding rings at staggered times.
6. **Build subs.srt** from `subtitle` events (cluster-collapsed: drops events with successors within 0.5s).
7. **Run ffmpeg** with `filter_complex` graph: `raw.webm + cursor.png + ripple.png` → cursor track + ripple overlays + subtitles → `final.mp4`.

## How review consumes events

`review.js` reads `events.json` and slices `final.mp4` at strategic offsets:

| Pass | Source events | Sample times | Output |
|---|---|---|---|
| **flow** | `click` events | `t-0.20s` (pre), `t+0.05s` (mid), `t+0.35s` (react) | 3 frames per click |
| **visual** | `subtitle` events | `t+0.50s` (mid-display) | 1 frame per subtitle |
| **coverage** | `subtitle` events | `t+1.00s` (UI settled) | 1 frame per stage |

All sample times are **video time** (after `CALIBRATION` subtraction). See [ffmpeg-pipeline.md](ffmpeg-pipeline.md) for the rationale.

## Inspecting events.json manually

For debugging, the file is human-readable:

```bash
cat events.json | jq '.[] | select(.kind == "click") | {t, label}'
```

Lists all clicks with their labels and timestamps.

```bash
cat events.json | jq '[.[] | select(.kind == "subtitle")] | length'
```

Counts subtitle events (should match the subtitle count printed at end of `npm run record`).

```bash
cat events.json | jq '.[] | select(.kind == "click" and (.y > 800))'
```

Finds clicks whose `y` is suspiciously close to viewport bottom (these are the candidates for "cursor went off-frame" bugs — see [known-pitfalls.md](known-pitfalls.md#cursor-off-frame)).
