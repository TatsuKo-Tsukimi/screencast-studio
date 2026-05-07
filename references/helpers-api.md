# Helpers API

The five helpers exposed inside the `try { ... }` block of `record.js`. All are async unless noted.

## `await sub(label)`

Adds a subtitle event to the events log and holds the page for a duration scaled by character count.

```js
await sub('概览底部 — BRIEF 注入内容 / 最近活动 / 定时任务');
```

**Hold time formula**:
- 700ms base
- + 130ms per CJK character
- + 55ms per ASCII character
- + 30ms per whitespace
- clamped to `[1100, 3500]` ms

So a short English subtitle holds for ~1.1s; a 30-character Chinese subtitle holds for ~3.5s. This is "comfortable reading speed" calibrated empirically. If you need a longer hold (e.g. while a complex UI animates in), pair `sub()` with explicit `hold(ms)`:

```js
await sub('Settings page loading...');
await hold(2000); // give it more time on top
```

## `await click(locator, label)`

The full click ceremony. In sequence:

1. **Scroll target into view** if needed (`scrollIntoViewIfNeeded`) + 150ms settle
2. **Get bounding box center** of the locator
3. **Push a `move` event** at that position to `events.json`
4. **Pause 700ms** (`PAUSE_BEFORE_CLICK`) — cursor visibly arrives + dwells
5. **Push a `click` event** at the same position
6. **Trigger the actual click** via `locator.click()`
7. **Pause 500ms** (`PAUSE_AFTER_CLICK`) — ripple + UI reaction stay on screen

```js
const filesTab = page.locator(':is(button, a, [role="tab"])').filter({ hasText: /^\s*Files\s*$/ }).first();
await click(filesTab, 'Switch to Files tab');
```

The `label` becomes a video event annotation (visible in `events.json` and `review/flow/report.txt`).

### Tuning the dwell times

If the UI animates slowly and the cursor is "rushing" the user, increase `PAUSE_BEFORE_CLICK` / `PAUSE_AFTER_CLICK` constants near the top of `record.js`. 700/500 is the default that survived a real demo with ~22 clicks.

### When click fails

If the click throws "bounding box missing", the locator didn't resolve to a visible element. Check:

1. Is the element actually rendered? (Some UI lazy-loads on hover.)
2. Did a previous step navigate away? (Re-find the locator.)
3. Is the selector ambiguous? (Use `.first()` or `getByText(s, { exact: true })`.)

Wrap with `tryStep` if the click is genuinely optional.

## `await scroll(deltaY, ticks=1)`

Wheel-scrolls the main content area.

```js
await scroll(400, 2);  // scroll down 800px total, in 2 wheel ticks with 280ms between
```

- `deltaY` positive = scroll down, negative = scroll up
- `ticks` = how many wheel events to dispatch (more = smoother)

**Important**: this helper first parks the mouse at the **center of the viewport** (`mouse.move(VIEWPORT.width/2, VIEWPORT.height/2)`) so the wheel event lands on main content, not the sidebar. If you call `page.mouse.wheel` directly, the cursor's "logical position" defaults to (0, 0) and the wheel scrolls whatever's there — typically the sidebar — which usually isn't what you want.

If your app has multiple scrollable containers in the main area, `scroll()` may still hit the wrong one. In that case, escape to:

```js
await page.locator('[data-testid="task-list"]').evaluate((el, dy) => el.scrollBy(0, dy), 400);
```

## `hold(ms=400)`

Plain pause. Returns a promise; `await` it.

```js
await hold();      // 400ms default
await hold(1500);  // 1.5s
```

Use to:
- Let an animation finish before the next click
- Hold a settled state on screen while subtitle reads

## `await tryStep(name, fn)`

Wraps a sub-flow in try/catch + logs. If `fn` throws, the error is caught and logged as `✗ ${name} — skipped: <message>`, then execution continues.

```js
await tryStep('Open project BRIEF panel', async () => {
  const openBrief = page.locator('button').filter({ hasText: /Open BRIEF/i }).first();
  await openBrief.waitFor({ state: 'visible', timeout: 4000 });
  await click(openBrief, '点击「Open BRIEF」');
  await sub('Project brief — auto-injected into agent chats');
  await hold(1500);
  // ... close + cleanup
});
```

**When to use `tryStep`**:
- Optional UI surface (depends on user permissions / data state)
- Stage that might be removed or renamed in the target app
- Anything where "skip on failure" is acceptable

**When NOT to use `tryStep`**:
- Required stages — if they fail, you want the recording to abort so you don't ship a broken demo
- Login / setup
- The first navigation (if it fails, nothing else will work)

## Escape hatches

The helpers cover the common 80%. For anything else, the underlying Playwright `page` is in scope:

```js
// Direct keyboard
await page.keyboard.press('Escape');

// Dialog handling
page.on('dialog', (d) => d.accept());

// Custom waits
await page.waitForFunction(() => window._myFlag === true, { timeout: 5000 });

// File upload
const fcp = page.waitForEvent('filechooser');
await click(uploadBtn, 'Click upload');
const fc = await fcp;
await fc.setFiles(['/path/to/file.png']);
```

When you use `page.something()` directly, **no events are recorded** — the synthetic cursor won't move, the click ripple won't fire. That's usually fine for keyboard / dialog / file-chooser steps, but means you can't use raw `locator.click()` if you want it to appear in the cursor track. Always go through `click(locator, label)` for visible interactions.

## What lives in `events.json`

Every helper that affects video output pushes events:

| Helper | Pushes |
|---|---|
| `sub(label)` | `{ t, kind: "subtitle", label }` |
| `click(...)` | `{ t, kind: "move", x, y }` then `{ t, kind: "click", x, y, label }` |
| `scroll(...)` | (no events — just causes UI to scroll) |
| `hold(...)` | (no events — pure timing) |
| `tryStep(...)` | (no events — wraps fn) |

See [events-schema.md](events-schema.md) for the full schema and how postprocess consumes it.
