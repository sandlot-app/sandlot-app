import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const chrome = [
  process.env.CHROME_BIN,
  process.env.CHROMIUM_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter(Boolean).find((candidate) => spawnSync(candidate, ['--version'], { windowsHide: true }).status === 0);

async function retry(action, timeout = 60_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { return await action(); } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  return action();
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    callback(message);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
      async send(method, params = {}) {
        const commandId = ++id;
        const response = new Promise((done) => pending.set(commandId, done));
        socket.send(JSON.stringify({ id: commandId, method, params }));
        const message = await response;
        if (message.error) throw new Error(JSON.stringify(message.error));
        return message.result;
      },
      close: () => socket.close(),
    }));
    socket.addEventListener('error', reject);
  });
}

test('gallery controls work and a saved pitch survives browser reload', { timeout: 120_000 }, async () => {
  assert.ok(chrome, 'Chrome or Chromium is required for the gallery behavior test. Set CHROME_BIN if needed.');
  assert.ok(existsSync('dist-web/index.html'), 'Build the development web gallery before running the behavior test.');
  const profile = mkdtempSync(join(tmpdir(), 'sandlot-gallery-'));
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = join(process.cwd(), 'dist-web', pathname === '/' ? 'index.html' : pathname);
    try {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
      response.end(readFileSync(file));
    } catch {
      if (!pathname.split('/').at(-1).includes('.')) {
        response.setHeader('Content-Type', 'text/html');
        response.end(readFileSync(join(process.cwd(), 'dist-web/index.html')));
      }
      else response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {
    stdio: 'ignore', windowsHide: true,
  });
  try {
    const debugPort = await retry(() => {
      const portFile = join(profile, 'DevToolsActivePort');
      assert.ok(existsSync(portFile), 'Chrome debugging port should be ready');
      return Number(readFileSync(portFile, 'utf8').split(/\r?\n/, 1)[0]);
    });
    const info = await retry(async () => {
      const targets = await (await fetch(`http://localhost:${debugPort}/json`)).json();
      const page = targets.find((target) => target.type === 'page' && target.url === 'about:blank');
      assert.ok(page, 'headless browser page should be ready');
      return page;
    });
    const cdp = await connect(info.webSocketDebuggerUrl);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const evaluate = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      const visible = async (id) => retry(async () => {
        const found = await evaluate(`Boolean(document.querySelector('[data-testid="${id}"]'))`);
        const storageError = await evaluate(`document.querySelector('[data-testid="game-error"]')?.textContent`);
        assert.equal(found, true, `${id} should be visible. Storage status is ${storageError ?? 'available'}`);
      }, 10_000);
      const click = async (id, atTop = false) => {
        const rect = await evaluate(`(() => { const element = document.querySelector('[data-testid="${id}"]'); if (!element) return null; const r = element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+${atTop ? 20 : 'r.height/2'}}; })()`);
        assert.ok(rect, `${id} should exist`);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      };
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/?gallery=sheet` });
      try { await visible('gallery-sheet'); }
      catch (error) {
        console.log('Page state:', await evaluate(`JSON.stringify({url:location.href, body:document.body.innerText.slice(0,1000), html:document.body.innerHTML.slice(0,1000)})`));
        throw error;
      }
      await click('sheet-scrim', true);
      try { await visible('gallery-sheet-closed'); }
      catch (error) { console.log('After scrim:', await evaluate(`document.body.innerText.slice(0,1000)`)); throw error; }
      await click('gallery-open-sheet');
      await visible('gallery-sheet');
      const rect = await evaluate(`(() => { const r = document.querySelector('[data-testid="sheet-grabber"]').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x, y: rect.y, id: 1 }] });
      for (const distance of [12, 30, 60, 100, 150]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rect.x, y: rect.y + distance, id: 1 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await visible('gallery-sheet-closed');
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/?gallery=button` });
      await visible('gallery-button');
      await click('gallery-enabled-button');
      assert.equal(await evaluate(`document.querySelector('[data-testid="gallery-button-count"]').textContent`), 'Pressed 1 time');
      await click('gallery-disabled-button');
      assert.equal(await evaluate(`document.querySelector('[data-testid="gallery-button-count"]').textContent`), 'Pressed 1 time');
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/?gallery=bar` });
      await visible('gallery-scorer-bar-saved');
      await click('pitch-strike');
      await visible('strike-looking');
      await click('pitch-ball');
      assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="strike-looking"]'))`), false);
      assert.equal(await evaluate(`document.body.innerText.includes('Pitch: ball')`), true);
      await click('pitch-strike');
      await visible('strike-looking');
      await click('strike-looking');
      assert.equal(await evaluate(`document.body.innerText.includes('Pitch: strike-looking')`), true);
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/?gallery=chips` });
      await visible('gallery-chip-fielding-followed');
      for (const [role, diameter] of [['fielding', 34], ['batting', 34], ['batter', 40]]) {
        for (const followed of [false, true]) {
          const id = `gallery-chip-${role}${followed ? '-followed' : ''}`;
          const bounds = await evaluate(`(() => { const circle = document.querySelector('[data-testid="${id}"]').firstElementChild.firstElementChild; const r = circle.getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
          assert.deepEqual(bounds, { width: diameter + (followed ? 6 : 0), height: diameter + (followed ? 6 : 0) }, `${id} preserves the inner chip and adds the Figma ring outside it`);
        }
      }
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/` });
      await visible('start-game');
      await click('start-game');
      await visible('pitch-ball');
      await click('pitch-ball');
      await retry(async () => assert.equal(await evaluate(`document.querySelector('[data-testid="score-summary"]').textContent`), 'Away 0, home 0. Inning 1, top. 0 outs. Count 1 ball and 0 strikes. Bases empty.'));
      assert.equal(await evaluate(`document.querySelector('svg')?.getAttribute('aria-hidden')`), 'true', 'the decorative diamond is hidden from browser accessibility');
      const previousDocument = await evaluate('performance.timeOrigin');
      await cdp.send('Page.reload');
      await retry(async () => assert.notEqual(await evaluate('performance.timeOrigin'), previousDocument, 'reload creates a fresh document'));
      await visible('pitch-ball');
      await retry(async () => assert.equal(await evaluate(`document.querySelector('[data-testid="score-summary"]').textContent`), 'Away 0, home 0. Inning 1, top. 0 outs. Count 1 ball and 0 strikes. Bases empty.'));
    } finally { cdp.close(); }
  } finally {
    browser.kill();
    server.close();
  }
});
