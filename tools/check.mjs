/* Smoke test for the web build. Runs the app in headless Chrome and checks:
   1. every model in web/models/models.json loads and runs on the GPU (WebGPU) and the CPU (WebAssembly);
      a COCO stand-in must also find the person or the tie in test_image.jpg;
   2. the camera mode, with a fake camera that shows test_image.jpg;
   3. the drawn-banknote mode;
   4. the figure pages #fig7, #fig8, #fig9 of the SRS appendix.

   Setup once:  cd tools && npm install
   Run:         node tools/check.mjs            (from the repository root)
   Options:     CHROME=<path to chrome.exe>     PORT=8099
   Exit code 0 means every check passed. */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const port = Number(process.env.PORT || 8099);
const base = 'http://127.0.0.1:' + port + '/';
const chrome = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));
if (!chrome) { console.error('Chrome not found. Set CHROME to the path of chrome.exe.'); process.exit(2); }

const missing = JSON.parse(readFileSync(join(root, 'web/models/models.json'), 'utf8')).models
  .filter((m) => !existsSync(join(root, 'web/models', m.file))).map((m) => m.file);
if (missing.length) { console.error('Missing model file(s): ' + missing.join(', ') + '. Run: python tools/fetch_models.py'); process.exit(2); }

const image = 'data:image/jpeg;base64,' + readFileSync(join(here, 'test_image.jpg')).toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const fail = (msg) => { problems.push(msg); console.log('  FAIL ' + msg); };
const ok = (msg) => console.log('  ok   ' + msg);

const server = spawn(process.platform === 'win32' ? 'python' : 'python3', [join(root, 'serve.py'), String(port), '--no-browser'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break; } catch (e) { /* not up yet */ } await sleep(100); }
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required'] });

  async function page(fakeCamera) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 900 });
    p.on('pageerror', (e) => fail('page error: ' + e.message));
    p.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) fail('HTTP ' + r.status() + ' ' + r.url()); });
    if (fakeCamera) {
      await p.evaluateOnNewDocument((src) => {
        navigator.mediaDevices.getUserMedia = async () => {
          const img = new Image(); img.src = src; await img.decode();
          const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext('2d');
          setInterval(() => g.drawImage(img, 0, 0), 33); g.drawImage(img, 0, 0);
          return c.captureStream(30);
        };
      }, image);
    }
    await p.goto(base, { waitUntil: 'load' });
    await p.evaluate(() => { const o = document.querySelector('#optSound'); if (o.checked) o.click(); });
    return p;
  }
  const log = (p) => p.$$eval('#log li .tx', (els) => els.map((e) => e.textContent));

  console.log('1. Models on the test image');
  {
    const p = await page(false);
    const res = await p.evaluate(async (src) => {
      const D = await import('/js/detector.js');
      const img = new Image(); img.src = src; await img.decode();
      const out = [];
      for (const m of await D.loadRegistry()) {
        for (const acc of D.gpuAvailable() ? ['webgpu', 'wasm'] : ['wasm']) {
          try {
            const det = await D.createDetector(m, acc);
            const t = []; let r;
            for (let i = 0; i < 10; i++) { r = await det.detect(img, 0, 0, img.naturalWidth, img.naturalHeight, 0.25); t.push(r.ms.inference); }
            t.sort((a, b) => a - b);
            out.push({ id: m.id, acc, coco: /COCO/.test(m.trainedOn), ms: t[t.length >> 1], labels: r.dets.map((d) => d.label + ' ' + d.score.toFixed(2)) });
            det.dispose();
          } catch (e) { out.push({ id: m.id, acc, error: String((e && e.message) || e) }); }
        }
      }
      return out;
    }, image);
    for (const r of res) {
      if (r.error) fail(r.id + ' on ' + r.acc + ': ' + r.error);
      else if (r.coco && !r.labels.some((l) => /^(person|tie) /.test(l))) fail(r.id + ' on ' + r.acc + ' found ' + (r.labels.join(', ') || 'nothing'));
      else ok(r.id + ' on ' + r.acc + ': ' + (r.labels.slice(0, 3).join(', ') || 'runs, nothing found in the test image') + ', inference median ' + r.ms.toFixed(1) + ' ms');
    }
    await p.close();
  }

  console.log('2. Camera mode with a fake camera');
  {
    const p = await page(true);
    await p.click('#startLater');
    await p.click('input[name="src"][value="cam"]');
    await p.click('#optPeople');
    try { await p.waitForFunction(() => window.__app.CAM.det !== null, { timeout: 40000 }); ok('model loaded'); } catch (e) { fail('model did not load in 40 s'); }
    await sleep(3000);
    const lines = await log(p);
    if (lines.some((l) => l === '“Person.”')) ok('announced "Person." once the stand-in model saw the test image');
    else fail('no announcement; log: ' + lines.slice(-3).join(' | '));
    const fps = Number(await p.$eval('#roFps', (e) => e.textContent));
    if (fps > 0) ok('frames per second: ' + fps); else fail('no frames processed');
    await p.click('#cam'); await sleep(200);
    if ((await log(p)).slice(-1)[0] === '“Person.”') ok('tap on the camera view repeats the announcement (FR-13)'); else fail('repeat did not speak');
    await p.click('input[name="src"][value="sim"]'); await sleep(300);
    if (await p.evaluate(() => !window.__app.CAM.on && window.__app.CAM.c === null)) ok('camera stops when the drawn banknotes are picked'); else fail('camera still on');
    await p.close();
  }

  console.log('3. Drawn-banknote mode');
  {
    const p = await page(false);
    for (const sel of ['#startFirst', '[data-act="w1Continue"]', '[data-act="w2Continue"]', '[data-act="allow"]']) { await p.click(sel); await sleep(150); }
    await p.click('.nb[data-den="1000p"]'); await sleep(1300);
    if ((await log(p)).includes('“One thousand pesos.”')) ok('announced "One thousand pesos."'); else fail('no announcement for the drawn 1000 banknote');
    await p.close();
  }

  console.log('4. Figure pages');
  {
    const p = await browser.newPage();
    for (const [f, n] of [['fig7', 3], ['fig8', 3], ['fig9', 2]]) {
      await p.goto(base + '#' + f, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' });
      const count = await p.$$eval('.shot', (s) => s.length);
      if (count === n) ok('#' + f + ' shows ' + n + ' screens'); else fail('#' + f + ' shows ' + count + ' screens, expected ' + n);
    }
    await p.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(problems.length ? '\n' + problems.length + ' check(s) failed.' : '\nAll checks passed.');
process.exit(problems.length ? 1 : 0);
