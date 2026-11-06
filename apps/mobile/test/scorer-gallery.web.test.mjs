import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  const events = [];
  let id = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) { events.push(message); return; }
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
      events,
      close: () => socket.close(),
    }));
    socket.addEventListener('error', reject);
  });
}

test('gallery controls work and a saved pitch survives browser reload', { timeout: 180_000 }, async () => {
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
      await cdp.send('Runtime.enable');
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
      await visible('start-setup');
      const screenshot = async (name) => {
        if (!process.env.SANDLOT_SCREENSHOTS_DIR) return;
        mkdirSync(process.env.SANDLOT_SCREENSHOTS_DIR, {recursive:true});
        const capture = await cdp.send('Page.captureScreenshot', {format:'png'});
        writeFileSync(join(process.env.SANDLOT_SCREENSHOTS_DIR, `${name}.png`), Buffer.from(capture.data,'base64'));
      };
      const label = (id) => evaluate(`document.querySelector('[data-testid="${id}"]')?.textContent`);
      const gone = (id) => retry(async () => assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="${id}"]'))`), false));
      await screenshot('web-setup-empty');
      assert.equal(await label('start-setup'), 'Set both lineups to start');
      assert.equal(await evaluate(`document.querySelector('[data-testid="start-setup"]').getAttribute('aria-disabled')`), 'true', 'Start is off until both lineups are saved');
      assert.equal(await label('lineup-summary-away'), 'Not set yet');
      assert.match(await label('half-note'), /^Second half since Oct 1, so pitchers can get 9 outs a day\./);
      assert.equal(await label('lineup-away').then((text) => text.startsWith('Hawks')), true, 'the Hawks row leads, as in Figma');
      const scrollTo = (id) => evaluate(`document.querySelector('[data-testid="${id}"]').scrollIntoView()`);
      for (const side of ['away', 'home']) {
        await click(`lineup-${side}`);
        await visible('save-lineup');
        if (side === 'away') {
          await screenshot('web-lineup-hawks-top');
          await click('position-0');
          await visible('position-sheet');
          await screenshot('web-lineup-position-sheet');
          await click('position-choice-CF');
          await gone('position-sheet');
          await scrollTo('change-pitcher');
          await click('change-pitcher');
          await visible('pitcher-sheet');
          await screenshot('web-lineup-pitcher-sheet');
          await click('pitcher-confirm');
          await gone('pitcher-sheet');
          await scrollTo('add-player');
          await click('add-player');
          await visible('add-empty');
          await click('sheet-scrim', true);
          await gone('add-sheet');
          // Not playing today: B. Lane comes out of the order, then comes back from the roster.
          await scrollTo('position-9');
          await click('position-9');
          await visible('position-sheet');
          await screenshot('web-lineup-remove');
          await click('position-remove');
          await gone('position-sheet');
          await gone('order-row-9');
          await scrollTo('add-player');
          await click('add-player');
          await visible('add-choice-home-10');
          await screenshot('web-lineup-add-sheet');
          await click('add-choice-home-10');
          await gone('add-sheet');
          await visible('order-row-9');
        }
        await scrollTo('save-lineup');
        if (side === 'away') await screenshot('web-lineup-hawks-bottom');
        await click('save-lineup');
        await gone('save-lineup');
        await visible('start-setup');
        if (side === 'away') await screenshot('web-setup-hawks-set');
      }
      assert.equal(await label('lineup-summary-away'), '10 players · T. Nguyen pitching');
      await screenshot('web-setup-ready');
      assert.equal(await label('lineup-summary-home'), '9 players · J. Soto pitching');
      assert.equal(await label('start-setup'), 'Start game');
      await click('start-setup');
      await visible('pitch-ball');
      await click('pitch-ball');
      await retry(async () => assert.equal(await evaluate(`document.querySelector('[data-testid="score-summary"]').getAttribute('aria-label')`), 'Away 0, home 0. Inning 1, top. 0 outs. Count 1 ball and 0 strikes. Bases empty.'));
      assert.equal(await evaluate(`document.querySelector('[data-testid="score-summary"] svg')?.getAttribute('aria-hidden')`), 'true', 'the decorative diamond is hidden from browser accessibility');
      assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="pitch-hit_by_pitch"]'))`), false, 'Hit by pitch lives in More, not the pitch bar');
      await click('pitch-in-play');
      await visible('play-outcomes');
      await click('outcome-single');
      await visible('play-fielders');
      await click('fielder-CF');
      await click('play-next');
      await visible('play-runners');
      await click('save-play');
      await retry(async () => assert.match(await evaluate(`document.querySelector('[data-testid="score-summary"]').getAttribute('aria-label')`), /Runners on first/));
      await click('scorer-undo');
      await retry(async () => assert.match(await evaluate(`document.querySelector('[data-testid="score-summary"]').getAttribute('aria-label')`), /Count 1 ball and 0 strikes. Bases empty/));
      const text = (id) => evaluate(`document.querySelector('[data-testid="${id}"]')?.textContent`);
      const savedAfter = (before) => retry(async () => {
        const now = await text('waiting-plays');
        assert.notEqual(now, before);
        assert.doesNotMatch(now, /^Saving/);
      });
      const summary = () => evaluate(`document.querySelector('[data-testid="score-summary"]')?.getAttribute('aria-label')`);
      const absent = (id) => retry(async () => assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="${id}"]'))`), false));
      const clickLabel = async (label) => {
        const rect = await evaluate(`(() => { const element = [...document.querySelectorAll('[role="button"]')].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); if (!element) return null; const r = element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
        assert.ok(rect, `${label} should exist`);
        await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed',...rect,button:'left',clickCount:1});
        await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased',...rect,button:'left',clickCount:1});
      };
      const pitch = async (result) => {
        const before = await text('waiting-plays');
        if (result === 'called_strike') { await click('pitch-strike'); await visible('strike-looking'); await click('strike-looking'); }
        else await click(`pitch-${result}`);
        await savedAfter(before);
      };
      const openPlay = async (choice) => {
        await click('pitch-in-play'); await visible('play-outcomes');
        await click(`outcome-${choice}`); await visible('play-fielders');
        await click('skip-fielder'); await visible('play-runners');
      };
      const savePlay = async () => { await click('save-play'); await absent('save-play'); };
      const undo = async () => {
        const before = await text('waiting-plays'); await click('scorer-undo');
        await savedAfter(before);
      };
      const openRunners = async (mode) => {
        await click('scorer-more'); await visible('play-more');
        await click(`more-${mode}`); await visible('play-runner-action');
      };
      const previousDocument = await evaluate('performance.timeOrigin');
      await cdp.send('Page.reload');
      await retry(async () => assert.notEqual(await evaluate('performance.timeOrigin'), previousDocument, 'reload creates a fresh document'));
      await visible('pitch-ball');
      await retry(async () => assert.equal(await evaluate(`document.querySelector('[data-testid="score-summary"]').getAttribute('aria-label')`), 'Away 0, home 0. Inning 1, top. 0 outs. Count 1 ball and 0 strikes. Bases empty.'));
      const beforeCancel = await text('waiting-plays');
      await click('pitch-in-play'); await visible('play-outcomes'); await clickLabel('Cancel');
      await absent('play-outcomes');
      await click('pitch-in-play'); await click('outcome-double'); await visible('play-fielders');
      await clickLabel('Cancel'); await absent('play-fielders');
      await openPlay('single'); await clickLabel('Cancel'); await absent('play-runners');
      assert.equal(await text('waiting-plays'), beforeCancel, 'all wizard cancellations preserve the saved history');
      await openPlay('ground-out'); await click('destination-home-8-1');
      assert.equal(await evaluate(`document.querySelector('[data-testid="save-play"]').disabled`), true, 'an Out outcome needs at least one selected out');
      await visible('play-validation'); await clickLabel('Cancel');
      await openPlay('double'); await click('destination-home-8-1');
      assert.equal(await evaluate(`document.querySelector('[data-testid="save-play"]').disabled`),true);
      await click('destination-home-8-out');
      assert.match(await text('out-type-home-8-non_force'), /after reaching second/);
      assert.equal(await evaluate(`document.querySelector('[data-testid="save-play"]').disabled`),false);
      await clickLabel('Cancel');
      await openPlay('single'); await savePlay();
      await openPlay('single');
      await click('destination-home-8-1');
      const beforeCollision = await text('waiting-plays');
      await click('save-play'); await visible('play-message');
      assert.match(await text('play-message'), /Two runners cannot finish on the same base/);
      assert.equal(await text('waiting-plays'),beforeCollision);
      await click('destination-home-8-3'); await savePlay();
      assert.match(await summary(), /Runners on first and third/);
      await click('pitch-in-play'); await visible('play-outcomes'); await screenshot('in-play-1-outcome');
      await click('outcome-single'); await visible('play-fielders'); await click('fielder-CF'); await screenshot('in-play-2-fielder');
      await click('play-next'); await visible('play-runners');
      assert.deepEqual(await evaluate(`(() => {const chip=document.querySelector('[data-testid="runner-chip-home-4"]').firstElementChild.firstElementChild;const r=chip.getBoundingClientRect();return {width:r.width,height:r.height};})()`), {width:28,height:28}, 'runner rows use the compact Figma chip without changing the field chip');
      await screenshot('in-play-3-runners');
      await clickLabel('Cancel');
      const beforeHitByPitch = await text('waiting-plays');
      await click('scorer-more'); await visible('play-more'); await click('more-hit_by_pitch'); await absent('play-more');
      await savedAfter(beforeHitByPitch);
      assert.match(await summary(), /Runners on first and second and third/);
      assert.equal(await evaluate(`document.querySelector('[data-testid="scorer-undo"]')?.getAttribute('aria-label')`), 'Undo · Hit by pitch', 'the round Undo names the play it takes back');
      await undo();
      assert.match(await summary(), /Runners on first and third/);
      await click('scorer-more'); await visible('play-more'); await screenshot('more');
      assert.deepEqual(await evaluate(`(() => {
        const row=document.querySelector('[data-testid="more-steal"]');
        const card=row.parentElement;
        const tile=row.firstElementChild;
        const box=element=>{const r=element.getBoundingClientRect();return {width:r.width,height:r.height};};
        const style=getComputedStyle(card);
        return {rows:card.children.length,rowHeight:box(row).height,cardBorder:style.borderTopWidth,
          cardRadius:style.borderTopLeftRadius,tile:box(tile)};
      })()`), {rows:4,rowHeight:60,cardBorder:'1px',cardRadius:'20px',tile:{width:36,height:36}}, 'the More actions match the Figma Runners card and icon tiles');
      assert.equal(await evaluate(`document.querySelector('[data-testid="play-more"]').textContent.includes('Pitching change')`),false);
      assert.equal(await evaluate(`document.querySelector('[data-testid="play-more"]').textContent.includes('Balk')`),false);
      await click('more-steal'); await visible('play-runner-action'); await screenshot('steal-attempt');
      await click('destination-home-8-home');
      const beforeIllegalSteal = await text('waiting-plays');
      await click('save-play'); await visible('play-message');
      assert.match(await text('play-message'), /Stealing home is not allowed/);
      assert.equal(await text('waiting-plays'), beforeIllegalSteal);
      await click('destination-home-8-3'); await click('destination-home-6-2'); await savePlay();
      assert.match(await summary(), /Runners on second and third/);
      await undo();
      const beforeRunnerPitches = await text('pitch-total');
      await openRunners('passed_ball'); await click('destination-home-8-home'); await savePlay();
      assert.match(await summary(), /Away 1.*Runners on first/);
      assert.equal(await text('pitch-total'), beforeRunnerPitches, 'a passed-ball runner consequence adds no invented pitch');
      await undo();
      await openRunners('wild_pitch'); await click('destination-home-8-home'); await click('destination-home-6-2'); await savePlay();
      assert.match(await summary(), /Away 1.*Runners on second/);
      assert.equal(await text('pitch-total'), beforeRunnerPitches);
      await undo();
      await openRunners('pickoff'); await click('destination-home-6-out'); await savePlay();
      assert.match(await summary(), /1 out.*Runners on third/);
      await undo();
      await openRunners('steal'); await click('destination-home-6-out'); await savePlay();
      assert.match(await summary(), /1 out.*Runners on third/);
      await undo();
      const beforeBunt = await text('waiting-plays');
      await openPlay('sac-bunt'); await click('save-play'); await visible('play-message');
      assert.match(await text('play-message'), /Bunting is not allowed/);
      assert.equal(await text('waiting-plays'),beforeBunt);
      await clickLabel('Cancel');
      for (let count = 0; count < 6; count++) await pitch('called_strike');
      assert.match(await summary(), /2 outs.*Runners on first and third/);
      await openPlay('fielders-choice');
      await click('destination-home-8-home'); await click('destination-home-6-out');
      await visible('third-out-evidence'); await visible('out-type-home-6-force');
      await savePlay();
      assert.match(await summary(), /Away 0, home 0.*bottom/);
      await undo();
      await openPlay('fielders-choice');
      await click('destination-home-8-home'); await click('destination-home-6-out');
      await click('out-type-home-6-non_force'); await savePlay();
      assert.match(await summary(), /Away 1, home 0.*bottom/);
      await undo();
      const total = Number((await text('pitch-total')).match(/(\d+)\//)[1]);
      for (let count = total; count < 65; count++) await pitch('foul');
      await visible('league-alert-pitch_count_near_limit');
      assert.match(await text('league-alert-pitch_count_near_limit'), /10 pitches from the limit/);
      await undo(); await absent('league-alert-pitch_count_near_limit');
      await click('tab-plays'); await visible('play-log');
      assert.match(await text('half-top-1'), /^Top 1· Hawks batting/, 'the current half leads the log');
      assert.match(await text('half-top-1'), /at bat/, 'the batter still up is open at the top');
      assert.ok(await evaluate(`document.querySelectorAll('[data-testid^="play-undone-"]').length`) > 0, 'the undone foul stays in the log, marked undone');
      await screenshot('plays');
      await click('tab-field'); await visible('pitch-ball');
      assert.deepEqual(cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown' || event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error'), [], 'the real browser path has no runtime errors or Expo error overlays');

    } finally { cdp.close(); }
  } finally {
    browser.kill();
    server.close();
  }
});
