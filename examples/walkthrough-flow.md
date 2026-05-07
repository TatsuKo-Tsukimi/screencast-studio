# Walkthrough flow example

Anonymized version of a real ~2-minute product demo: a multi-agent collaboration platform's "project workspace" feature. The demo browses overview / brief / files / tasks / chats / settings tabs of a mature project, then demonstrates additive capabilities (new folder + upload).

This shows every common stage pattern: tab switching, modal open/close, scrollable list traversal, optional UI surfaces with `tryStep`, file upload with chooser, isolated sandbox folder for additive demos.

## High-level flow

```
Stage 0  : Plaza (landing page)
Stage 1  : → projects index
Stage 2  : → mature project detail
Stage 3  : Open BRIEF panel (modal)
Stage 4  : Files tab + scroll listing
Stage 4.5: Enter archive/ subfolder → return via ".."
Stage 5  : Sort dropdown (optional)
Stage 6  : Multi-select toggle (optional)
Stage 7  : Markdown preview (optional)
Stage 8  : Tasks tab + scroll task list
Stage 9  : Task filter (optional)
Stage 10 : Chat sessions tab + scroll
Stage 11 : Settings tab
Stage 12 : Back to Files for additive demo
Stage 13 : New isolated folder + enter
Stage 14 : Upload 3 test files into folder
Closing  : Final summary subtitle
```

Each stage is one `await sub('...')` plus the actions that should be visible during that subtitle.

## Pattern: simple narrate-then-act

```js
// ===== Stage 1: → /projects =====
await sub('从智能体广场进入项目模块');
const navProj = page.locator('a[href="/projects"]').first();
await click(navProj, '点击侧边栏「项目」');
await page.waitForURL(/\/projects$/);
await page.locator('h1:has-text("项目")').first().waitFor();
await hold();
await sub('多个并行项目 — 出海发布主题');
```

Notes:
- Subtitle comes first; cursor + click happen during the subtitle hold.
- After click, wait for URL change + a landmark element to confirm navigation finished.
- Then a second subtitle narrates the new view.

## Pattern: modal open + close

```js
// ===== Stage 3: Open BRIEF panel =====
await tryStep('Open BRIEF panel', async () => {
  const openBrief = page.locator('button, a').filter({ hasText: /Open BRIEF/i }).first();
  await openBrief.waitFor({ state: 'visible', timeout: 4000 });
  await click(openBrief, '点击「Open BRIEF」');
  await page.locator('text=项目简报').first().waitFor({ state: 'visible', timeout: 4000 });
  await sub('项目简报 — 结构化模板，注入到每个 agent chat');
  await hold(1500);
  await scroll(300, 2);
  await sub('支持目标 / 背景 / 限制 / 自定义章节 / 高级模式');
  await hold(1500);
  await scroll(-600, 1);
  await hold(400);
  const closeBtn = page.locator('button').filter({ hasText: /^\s*关闭\s*$/ }).first();
  await click(closeBtn, '点击「关闭」');
  await page.locator('text=项目简报').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await hold(400);
});
```

Notes:
- Wrapped in `tryStep` because BRIEF panel might not exist on every project.
- After clicking open, wait for the modal's distinctive content to appear before narrating.
- Scroll inside the modal to reveal more content + a second narration.
- Scroll back before closing (UX: leaving the modal scrolled looks weird).
- Close button selector uses regex `^\s*关闭\s*$` — exact-match-with-whitespace, so it doesn't match other buttons containing "关闭".

## Pattern: scrollable list traversal

```js
// ===== Stage 4: Files tab =====
const filesTab = page.locator(':is(button, a, [role="tab"])').filter({ hasText: /^\s*文件\s*$/ }).first();
await click(filesTab, '切到「文件」tab');
const uploadBtn = page.locator('button').filter({ hasText: /Upload/i }).first();
await uploadBtn.waitFor({ state: 'visible' });
await hold();
await sub('文件 tab — 含 markdown / 图片 / 子文件夹');
await hold(1500);
await scroll(350, 2);
await sub('16 个真实文件 — 含 .png / .md / .txt 多类型');
await hold(1500);
await scroll(-700, 1);
await hold(400);
```

Notes:
- Tab selector uses `:is(button, a, [role="tab"])` because tabs in modern UIs use various roles.
- Wait for a landmark inside the new view (Upload button) before subtitling.
- Two scrolls: down to reveal lower content + narrate; up to restore (so the next stage starts from a known scroll position).

## Pattern: enter subfolder + return

```js
// ===== Stage 4.5: Enter archive/ subfolder =====
await tryStep('Enter archive subfolder', async () => {
  const archive = page.locator('text=archive/').first();
  await archive.waitFor({ state: 'visible', timeout: 4000 });
  await click(archive, '进入 archive/ 子文件夹');
  await hold(1500);
  await sub('子文件夹 archive/ — 路径感知能力');
  await hold(1500);
  // Return to root by clicking ".." parent entry. Use exact match — `text=..`
  // is substring and matches anything 2+ chars long.
  const upRow = page.getByText('..', { exact: true }).first();
  await upRow.waitFor({ state: 'visible', timeout: 4000 });
  await click(upRow, '返回上一层 (..)');
  await page.locator('text=archive/').first().waitFor({ state: 'visible', timeout: 4000 });
  await hold(600);
});
```

Key learning: `text=..` is substring match and would match any element with 2+ characters. Use `getByText('..', { exact: true })` for the literal `..` row.

After clicking back, wait for a root-level landmark (`archive/` row reappearing) to confirm we actually returned to root — otherwise the next stage might run inside the still-open subfolder.

## Pattern: file upload with chooser

```js
// ===== Stage 14: Upload test files =====
await tryStep('Upload test files into folder', async () => {
  const folderUploadBtn = page.locator('button').filter({ hasText: /Upload/i }).first();
  await folderUploadBtn.waitFor({ state: 'visible' });
  const fcp = page.waitForEvent('filechooser');
  await click(folderUploadBtn, '点击「⬆ Upload」');
  const fc = await fcp;
  await fc.setFiles([
    `${TEST_FILES_DIR}/test.md`,
    `${TEST_FILES_DIR}/test.png`,
    `${TEST_FILES_DIR}/test.pdf`,
  ]);
  // Handle conflict dialog if present (defensive)
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500);
    const conflict = await page.locator('text=已经在这个项目里').count();
    if (conflict === 0) break;
    const replaceBtn = page.locator('button').filter({ hasText: /^\s*替换\s*$/ }).first();
    await replaceBtn.click().catch(() => {});
  }
  await page.locator('text=/^test\\.pdf$/').first().waitFor({ timeout: 20000 });
  await hold(800);
  await sub('上传 test.md / test.png / test.pdf — 隔离在演示文件夹内');
  await hold(1200);
});
```

Notes:
- `waitForEvent('filechooser')` MUST be set up BEFORE clicking the upload button — Playwright registers the listener, then click triggers the chooser, then `await fcp` resolves.
- Defensive conflict-dialog handling is project-specific; remove if your app doesn't have one.
- Wait for the *last* uploaded file to appear in the listing before subtitling success.

## Pattern: isolated additive demo (don't pollute production data)

The closing third of the demo creates a timestamped subfolder, enters it, uploads test files there. Two reasons:

1. The demo is run repeatedly during development — uploading to root would accumulate test files across runs.
2. Subfolder name is timestamped (`演示_${HHMM}`) so concurrent demo runs don't collide.

```js
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');
const DEMO_FOLDER = `演示_${STAMP}`;

await tryStep('Create + enter demo folder', async () => {
  const newFolderBtn = page.locator('button').filter({ hasText: /新建文件夹/ }).first();
  await click(newFolderBtn, '点击「📁 新建文件夹」');
  const folderInput = page.locator('input[placeholder="文件夹名称"]');
  await folderInput.waitFor({ state: 'visible' });
  await folderInput.fill(DEMO_FOLDER);
  await sub(`新建独立子文件夹: ${DEMO_FOLDER}`);
  const folderConfirm = page.locator('button').filter({ hasText: /^\s*OK\s*$/ }).first();
  await click(folderConfirm, '提交「OK」');
  // ... enter the folder
});
```

If your demo can demonstrably revert all changes (delete created folder + uploaded files at the end), do it in a `finally` block so even an aborted recording cleans up. If reverting is non-trivial, accept the timestamped-isolation pattern.

## What the helpers don't do

The helpers don't:
- Type into inputs — use `await locator.fill('text')` (no synthetic cursor while typing)
- Hover — use `await locator.hover()` (no helper because hovers don't typically need a click ceremony)
- Drag — use Playwright's drag APIs directly
- Press keys — use `await page.keyboard.press('Escape')`

For all of these, the synthetic cursor stays where it last moved. If you need the cursor to visibly approach a non-clickable element (e.g. hover over a tooltip), do `await page.mouse.move(x, y)` to advance the cursor, then push a fake `move` event manually:

```js
events.push({ t: t(), kind: 'move', x: 500, y: 300 });
await page.mouse.move(500, 300);
await hold(800);
await sub('Hover here to see tooltip');
```

This is escape-hatch territory — use sparingly.

## Final tips

- **Sub before action**, not after. Subtitle introduces what's about to happen; the visible action follows during the subtitle hold.
- **Land on a known state** between stages. Each stage should end with the UI in a predictable state so the next stage knows what to find.
- **Don't fight async**. If something needs to load, `await locator.waitFor({ state: 'visible' })` it explicitly.
- **Trust `tryStep` for optional surfaces** (depend on data / permissions / experimental features) but **not for required ones** (login / first navigation / critical clicks).
