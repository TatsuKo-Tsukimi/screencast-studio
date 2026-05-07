// 3-pass review pipeline for the latest final.mp4. Each pass has a different focus:
//   - flow      : each click event, sampled at pre/mid/post — verify cursor on target,
//                 ripple firing, UI reaction. Catches misclicks, dead-state stages.
//   - visual    : each subtitle event, sampled mid-display — verify subtitle text
//                 matches what UI shows, no stale/stacked subs.
//   - coverage  : each stage's settled frame — verify the stage actually executed
//                 (modal opened, content rendered, no missing functionality).
//
// Major errors should surface in any of the 3 passes; the passes complement each other.
// Outputs go to ./review/{flow,visual,coverage}/ and a report.txt summary in each.
//
// Usage:
//   node review.js              — run all 3 passes
//   node review.js flow         — only flow
//   node review.js visual       — only visual
//   node review.js coverage     — only coverage
const ffmpegPath = require('ffmpeg-static');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REVIEW_DIR = path.join(ROOT, 'review');
const CAL = 0.65; // matches postprocess.js CALIBRATION
const FINAL = path.join(ROOT, 'final.mp4');
const EVENTS = path.join(ROOT, 'events.json');

if (!fs.existsSync(FINAL)) { console.error('final.mp4 missing — run `npm run demo` first.'); process.exit(1); }
if (!fs.existsSync(EVENTS)) { console.error('events.json missing.'); process.exit(1); }

const events = JSON.parse(fs.readFileSync(EVENTS, 'utf8'));

const ensure = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
const wipe = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
};
const grab = (t, name, dir) => {
  const dst = path.join(dir, name);
  const r = spawnSync(ffmpegPath, ['-y', '-ss', String(t), '-i', FINAL, '-frames:v', '1', dst], { stdio: ['ignore', 'ignore', 'pipe'] });
  return r.status === 0;
};
const fmt = (n) => Number(n).toFixed(2);

function reviewFlow() {
  const dir = path.join(REVIEW_DIR, 'flow');
  ensure(dir); wipe(dir);
  const lines = [
    '=== FLOW REVIEW ===',
    'Each click sampled 3 times: pre (cursor approaching), mid (click+ripple), react (0.35s after).',
    `${'#'.padStart(3)}  ${'video.t'.padEnd(8)}  ${'pos'.padEnd(11)}  label`,
    '',
  ];
  const clicks = events.filter((e) => e.kind === 'click');
  clicks.forEach((c, i) => {
    const ct = Math.max(0, c.t - CAL);
    const ix = String(i).padStart(2, '0');
    grab(+(ct - 0.20).toFixed(2), `click-${ix}-A-pre.png`, dir);
    grab(+(ct + 0.05).toFixed(2), `click-${ix}-B-mid.png`, dir);
    grab(+(ct + 0.35).toFixed(2), `click-${ix}-C-react.png`, dir);
    lines.push(`${String(i).padStart(3)}  ${fmt(ct).padEnd(8)}  (${c.x},${c.y})`.padEnd(35) + `  ${c.label}`);
  });
  fs.writeFileSync(path.join(dir, 'report.txt'), lines.join('\n'));
  console.log(`✓ flow      ${clicks.length} clicks → ${clicks.length * 3} frames`);
}

function reviewVisual() {
  const dir = path.join(REVIEW_DIR, 'visual');
  ensure(dir); wipe(dir);
  const lines = [
    '=== VISUAL REVIEW ===',
    'Each subtitle sampled mid-display. Verify subtitle text matches what UI shows.',
    `${'#'.padStart(3)}  ${'video.t'.padEnd(8)}  text`,
    '',
  ];
  const subs = events.filter((e) => e.kind === 'subtitle');
  subs.forEach((s, i) => {
    const st = Math.max(0, s.t - CAL);
    const ix = String(i).padStart(2, '0');
    grab(+(st + 0.5).toFixed(2), `sub-${ix}.png`, dir);
    lines.push(`${String(i).padStart(3)}  ${fmt(st).padEnd(8)}  ${s.label}`);
  });
  fs.writeFileSync(path.join(dir, 'report.txt'), lines.join('\n'));
  console.log(`✓ visual    ${subs.length} subtitles → ${subs.length} frames`);
}

function reviewCoverage() {
  const dir = path.join(REVIEW_DIR, 'coverage');
  ensure(dir); wipe(dir);
  const lines = [
    '=== COVERAGE REVIEW ===',
    'Each stage = subtitle event. Sampled 1s after start (UI should be settled).',
    `${'#'.padStart(3)}  ${'video.t'.padEnd(8)}  stage`,
    '',
  ];
  const subs = events.filter((e) => e.kind === 'subtitle');
  subs.forEach((s, i) => {
    const st = Math.max(0, s.t - CAL);
    const ix = String(i).padStart(2, '0');
    grab(+(st + 1.0).toFixed(2), `stage-${ix}.png`, dir);
    lines.push(`${String(i).padStart(3)}  ${fmt(st).padEnd(8)}  ${s.label}`);
  });
  fs.writeFileSync(path.join(dir, 'report.txt'), lines.join('\n'));
  console.log(`✓ coverage  ${subs.length} stages → ${subs.length} frames`);
}

const mode = (process.argv[2] || 'all').toLowerCase();
ensure(REVIEW_DIR);
if (mode === 'all' || mode === 'flow')     reviewFlow();
if (mode === 'all' || mode === 'visual')   reviewVisual();
if (mode === 'all' || mode === 'coverage') reviewCoverage();
console.log(`\nreview output → ${REVIEW_DIR}`);
