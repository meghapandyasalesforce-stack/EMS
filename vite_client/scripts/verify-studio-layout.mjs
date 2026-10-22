/**
 * Verifies Create Job studio grid: form column fills remaining width.
 * Run: node scripts/verify-studio-layout.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/styles/recruitmentUI.css');
const css = fs.readFileSync(cssPath, 'utf8');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${css}
body { margin: 0; }
/* Simulate app main column; sidebar offset only on desktop */
.app-main {
  width: 100%;
  min-height: 100vh;
  background: #e8eceb;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .app-main {
    margin-left: 16rem;
    width: calc(100% - 16rem);
  }
}
</style>
</head>
<body>
<div class="app-main">
  <div class="cm-hrms ats-ui ats-create-job-page w-full min-w-0">
    <div class="ats-page w-full min-w-0">
      <div class="ats-page-inner ats-page-inner--full w-full min-w-0">
        <form class="ats-studio">
          <div class="ats-studio__top"><h1 class="ats-studio__title">Post New Job</h1></div>
          <div class="ats-studio__grid">
            <aside class="ats-studio__rail" id="rail">
              <div class="ats-studio__rail-card">Studio Stages</div>
              <div class="ats-studio__rail-card">Compensation Band</div>
            </aside>
            <div class="ats-studio__stream" id="stream">
              <section class="ats-studio__card" id="sec-compensation">
                <h2>Compensation</h2>
                <div class="ats-studio__fields ats-studio__fields--3" id="comp-fields">
                  <label><span class="ats-form-label">Currency</span><select class="cm-select w-full"><option>USD</option></select></label>
                  <label><span class="ats-form-label">Salary Min</span><input class="cm-input w-full" /></label>
                  <label><span class="ats-form-label">Salary Max</span><input class="cm-input w-full" /></label>
                </div>
              </section>
              <section class="ats-studio__card" id="sec-visibility">
                <h2>Visibility</h2>
                <div class="ats-studio__checks"><label class="ats-studio__check">Visible</label></div>
              </section>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
</body></html>`;

const fixture = path.resolve(__dirname, '../tmp-studio-layout.html');
fs.writeFileSync(fixture, html);

function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const inner = document.querySelector('.ats-page-inner');
    const grid = document.querySelector('.ats-studio__grid');
    const rail = document.getElementById('rail');
    const stream = document.getElementById('stream');
    const comp = document.getElementById('sec-compensation');
    const vis = document.getElementById('sec-visibility');
    const fields = document.getElementById('comp-fields');
    const labels = [...fields.querySelectorAll(':scope > label')];
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, width: b.width };
    };
    const mr = r(main);
    const ir = r(inner);
    const gr = r(grid);
    const rr = r(rail);
    const sr = r(stream);
    const cr = r(comp);
    const vr = r(vis);
    const rightSlackStream = Math.round(gr.right - sr.right);
    const rightSlackCards = Math.round(sr.right - Math.max(cr.right, vr.right));
    // page padding (~0.5–1.25rem) means inner < main; require inner ≈ grid and nearly fills main
    const innerNearlyFillsMain = ir.width >= mr.width * 0.9;
    const gap = window.getComputedStyle(grid).columnGap;
    const gapPx = parseFloat(gap) || 0;
    const expectedStream = window.innerWidth >= 1024 ? gr.width - rr.width - gapPx : gr.width;
    const streamFillsGridRest = Math.abs(sr.width - expectedStream) < 4;
    const cardsFillStream = Math.abs(cr.width - sr.width) < 2 && Math.abs(vr.width - sr.width) < 2;
    const fieldWidths = labels.map((l) => Math.round(l.getBoundingClientRect().width));
    const fieldsEven =
      fieldWidths.length === 3 &&
      Math.max(...fieldWidths) - Math.min(...fieldWidths) <= 2;
    const desktop = window.innerWidth >= 1024;
    const noOverflow = Math.max(cr.right, vr.right) <= mr.right + 1;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      mainW: Math.round(mr.width),
      innerW: Math.round(ir.width),
      gridW: Math.round(gr.width),
      railW: Math.round(rr.width),
      streamW: Math.round(sr.width),
      compW: Math.round(cr.width),
      visW: Math.round(vr.width),
      rightSlackStream,
      rightSlackCards,
      fieldWidths,
      innerNearlyFillsMain,
      streamFillsGridRest,
      cardsFillStream,
      fieldsEven,
      noOverflow,
      ok:
        innerNearlyFillsMain &&
        rightSlackStream <= 2 &&
        rightSlackCards <= 2 &&
        cardsFillStream &&
        streamFillsGridRest &&
        noOverflow &&
        (!desktop || (Math.abs(rr.width - 420) <= 2 && fieldsEven)),
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('file://' + fixture.replace(/\\/g, '/'));
const desktop = await measure(page);

await page.setViewportSize({ width: 390, height: 844 });
const mobile = await measure(page);

await browser.close();
fs.unlinkSync(fixture);

const report = { desktop, mobile };
console.log(JSON.stringify(report, null, 2));

const pass =
  desktop.ok &&
  desktop.rightSlackStream <= 2 &&
  desktop.rightSlackCards <= 2 &&
  mobile.rightSlackCards <= 2 &&
  mobile.compW <= mobile.mainW + 1;

if (!pass) {
  console.error('LAYOUT VERIFICATION FAILED');
  process.exit(1);
}
console.log('LAYOUT VERIFICATION PASSED');
