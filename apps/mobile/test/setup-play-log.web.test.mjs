import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const chrome = [process.env.CHROME_BIN, process.env.CHROMIUM_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], {windowsHide: true}).status === 0);

async function retry(action, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { return await action(); } catch { await new Promise((done) => setTimeout(done, 100)); }
  }
  return action();
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = [];
  let id = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) { events.push(message); return; }
    const done = pending.get(message.id); pending.delete(message.id); done(message);
  });
  await new Promise((resolve, reject) => {socket.addEventListener('open', resolve); socket.addEventListener('error', reject);});
  return {events, close: () => socket.close(), async send(method, params = {}) {
    const command = ++id;
    const result = new Promise((done) => pending.set(command, done));
    socket.send(JSON.stringify({id: command, method, params}));
    const response = await result;
    if (response.error) throw new Error(JSON.stringify(response.error));
    return response.result;
  }};
}

test('a scorer sets both lineups, reopens the saved book and reads its undo history', {timeout: 180000}, async () => {
  assert.ok(chrome, 'Chrome is required for the actual setup path');
  assert.ok(existsSync('dist-web/index.html'), 'Export the actual web build first');
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    let file = join(process.cwd(), 'dist-web', path === '/' ? 'index.html' : path);
    if (!existsSync(file) && !path.split('/').at(-1).includes('.')) file = join(process.cwd(), 'dist-web/index.html');
    try {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
      response.end(readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, done));
  const profile = mkdtempSync(join(tmpdir(), 'sandlot-setup-'));
  const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio:'ignore',windowsHide:true});
  let cdp;
  try {
    const port = await retry(() => Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]));
    const target = await retry(async () => {
      const targets = await (await fetch(`http://localhost:${port}/json`)).json();
      const page = targets.find((entry) => entry.type === 'page');
      assert.ok(page, 'The browser page must be ready');
      return page;
    });
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {width:393,height:852,deviceScaleFactor:1,mobile:true});
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled:true});
    const evaluate = async (expression) => (await cdp.send('Runtime.evaluate', {expression,returnByValue:true})).result.value;
    const element = (id) => `([...document.querySelectorAll('[data-testid="${id}"]')].find((node) => {
      const r=node.getBoundingClientRect();if(!r.width||!r.height||node.closest('[aria-hidden="true"],[inert]'))return false;
      for(let parent=node;parent;parent=parent.parentElement){const s=getComputedStyle(parent);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;
    }))`;
    const visible = async (id) => retry(async () => assert.equal(await evaluate(`Boolean(${element(id)})`), true, `${id} should be present`));
    const text = async (id) => evaluate(`${element(id)}?.textContent`);
    const click = async (id) => {
      await visible(id);
      const point = await evaluate(`(() => {const e=${element(id)};if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      assert.ok(point, `${id} should be present`);
      await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed',...point,button:'left',clickCount:1});
      await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased',...point,button:'left',clickCount:1});
    };
    const screenshot = async (name, height = 852) => {
      if (!process.env.SANDLOT_SETUP_SCREENSHOTS_DIR) return;
      if (height !== 852) await cdp.send('Emulation.setDeviceMetricsOverride',{width:393,height,deviceScaleFactor:1,mobile:true});
      mkdirSync(process.env.SANDLOT_SETUP_SCREENSHOTS_DIR,{recursive:true});
      const result = await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync(join(process.env.SANDLOT_SETUP_SCREENSHOTS_DIR,`${name}.png`),Buffer.from(result.data,'base64'));
      if (height !== 852) await cdp.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
    };
    await cdp.send('Page.navigate',{url:`http://localhost:${server.address().port}/`});
    await visible('new-game');
    await click('new-game'); await visible('game-setup');
    assert.equal(await evaluate(`document.querySelector('[data-testid="start-configured-game"]').disabled`), true, 'Start needs both saved lineups');
    assert.match(await text('season-half-note'), /Second half since Oct 1/);
    await screenshot('game-setup-empty');
    await click('season-half-first'); assert.match(await text('season-half-note'), /6 outs/);
    await click('season-half-second'); assert.match(await text('season-half-note'), /9 outs/);
    await click('setup-lineup-away'); await visible('lineup-row-sample-away-1');
    await screenshot('lineup',1027);
    await click('lineup-position-sample-away-7'); await click('position-bats-only');
    await click('save-lineup'); await visible('lineup-message');
    assert.match(await text('lineup-message'), /starting pitcher/);
    await screenshot('lineup-rejected');
    await click('lineup-position-sample-away-7'); await click('position-P');
    const drag = await evaluate(`(() => {const e=${element('lineup-drag-sample-away-1')};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...drag,id:1}]});
    for (const offset of [12,35,65,110]) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drag.x,y:drag.y+offset,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await retry(async () => assert.ok(Number(await text('lineup-order-sample-away-1')) > 1, 'a real touch drag changes the batting order'));
    await click('lineup-position-sample-away-1'); await click('position-P');
    assert.equal(await text('lineup-position-sample-away-1'),'P');
    assert.equal(await text('lineup-position-sample-away-7'),'CF','assigning an occupied position swaps the prior occupant');
    await click('change-starting-pitcher'); await click('choose-pitcher-sample-away-3');
    assert.match(await text('lineup-starting-pitcher'), /S\. Bell/);
    await click('lineup-add-player'); await click('add-player-sample-away-11');
    assert.equal(await text('lineup-position-sample-away-11'),'Bats only');
    await click('lineup-add-player');
    assert.equal(await evaluate(`Boolean(${element('add-player-sample-away-11')})`),false,'the roster cannot add a player twice');
    await click('lineup-add-player');
    await click('save-lineup'); await visible('game-setup');
    await retry(async () => assert.match(await text('setup-lineup-away-summary'), /11 players.*S\. Bell/));
    await screenshot('game-setup');
    assert.equal(await evaluate(`${element('start-configured-game')}.disabled`),true);
    await click('setup-lineup-home'); await visible('lineup-row-sample-home-1');
    await click('change-starting-pitcher'); await click('choose-pitcher-sample-home-3');
    await click('save-lineup'); await visible('game-setup');
    await retry(async () => assert.equal(await evaluate(`${element('start-configured-game')}.disabled`),false));
    await click('start-configured-game'); await visible('pitch-ball');
    assert.match(await text('waiting-plays'),/^1 waiting/);
    const pitcher = await text('current-pitcher-identity');
    const batter = await text('current-batter-identity');
    assert.match(pitcher,/N\. Cole/); assert.match(pitcher,/5/);
    assert.match(batter,/J\. Ruiz/); assert.match(batter,/6/);
    await screenshot('configured-scorer');
    await click('pitch-ball'); await retry(async()=>assert.match(await text('waiting-plays'),/^2 waiting/));
    await click('pitch-in-play'); await click('outcome-single'); await click('skip-fielder');
    assert.match(await text('runner-chip-sample-away-2'),/J\. Ruiz/);
    assert.match(await text('runner-chip-sample-away-2'),/6/);
    await click('save-play'); await retry(async()=>assert.match(await text('waiting-plays'),/^3 waiting/));
    await click('tab-plays'); await visible('play-4'); await visible('play-5');
    await screenshot('plays',1098);
    await click('tab-field'); await visible('undo-play'); await click('undo-play');
    await retry(async()=>assert.match(await text('waiting-plays'),/^4 waiting/));
    assert.equal(await text('current-batter-identity'),batter); assert.equal(await text('current-pitcher-identity'),pitcher);
    assert.match(await text('score-summary'),/Count 1 ball and 0 strikes\. Bases empty/);
    await click('tab-plays'); await visible('at-bat-5');
    assert.match(await text('at-bat-5'),/J\. Ruiz at bat/,'the at-bat header must not present an undone Single as the active result');
    await click('at-bat-5'); await visible('play-undone-5');
    await screenshot('plays-undone',1098);
    const timeOrigin = await evaluate('performance.timeOrigin');
    await cdp.send('Page.reload',{ignoreCache:true});
    await retry(async()=>assert.notEqual(await evaluate('performance.timeOrigin'),timeOrigin));
    await visible('play-undone-5').catch(async () => {await visible('at-bat-5');await click('at-bat-5');await visible('play-undone-5');});
    await click('tab-field'); await visible('pitch-ball');
    assert.equal(await text('current-batter-identity'),batter); assert.equal(await text('current-pitcher-identity'),pitcher);
    assert.match(await text('score-summary'),/Count 1 ball and 0 strikes\. Bases empty/);
    await cdp.send('Page.navigate',{url:`http://localhost:${server.address().port}/`});
    await visible('resume-game');
    assert.equal(await evaluate(`Boolean(${element('new-game')})`),false,'a saved book cannot be replaced from the game list');
    assert.deepEqual(cdp.events.filter((event)=>event.method==='Runtime.exceptionThrown'||event.method==='Runtime.consoleAPICalled'&&event.params.type==='error'),[],'the actual path has no runtime errors');
  } catch (error) {
    if (cdp && process.env.SANDLOT_BROWSER_DIAGNOSTICS_DIR) {
      const result = await cdp.send('Runtime.evaluate',{expression:`JSON.stringify({path:location.pathname,readyState:document.readyState,error:document.querySelector('[data-testid="game-error"]')?.textContent,ids:[...document.querySelectorAll('[data-testid]')].filter((node)=>node.getBoundingClientRect().width>0).map((node)=>node.getAttribute('data-testid'))})`,returnByValue:true});
      mkdirSync(process.env.SANDLOT_BROWSER_DIAGNOSTICS_DIR,{recursive:true});
      writeFileSync(join(process.env.SANDLOT_BROWSER_DIAGNOSTICS_DIR,'failure.json'),result.result.value);
      const frame = await cdp.send('Page.captureScreenshot',{format:'png'});
      writeFileSync(join(process.env.SANDLOT_BROWSER_DIAGNOSTICS_DIR,'failure.png'),Buffer.from(frame.data,'base64'));
    }
    throw error;
  } finally {
    cdp?.close(); browser.kill(); server.close();
  }
});
