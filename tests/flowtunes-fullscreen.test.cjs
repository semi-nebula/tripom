const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// The app is a single HTML file. Run its actual fullscreen controller against
// a small DOM/API stub; no browser downloads or third-party test dependencies.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('            let flowtunesFullscreenActive = false;');
const end = html.indexOf('            function render() {', start);
assert(start !== -1 && end > start, 'Fullscreen controller exists in index.html');
const controller = html.slice(start, end);

function createApp() {
  const listeners = new Map();
  const messages = [];
  const opened = [];
  let exitCalls = 0;
  const document = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    activeElement: null,
    body: { classList: { contains: name => name === 'flowtunes-active' } },
    addEventListener(name, handler, capture) {
      const entries = listeners.get(name) || [];
      entries.push({ handler, capture });
      listeners.set(name, entries);
    },
    dispatch(name, event = {}) {
      for (const { handler } of listeners.get(name) || []) handler(event);
    },
  };
  function element(id, parentElement = null) {
    return {
      id, parentElement, attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { document.activeElement = this; },
      contains(node) {
        for (; node; node = node.parentElement) if (node === this) return true;
        return false;
      },
    };
  }
  const player = element('flowtunes-frame-wrapper');
  const iframe = element('flowtunes-frame', player);
  const expand = element('flowtunes-fullscreen-button');
  const exit = element('flowtunes-fullscreen-exit', player);
  const elements = new Map([player, iframe, expand, exit].map(node => [node.id, node]));
  document.getElementById = id => elements.get(id) || null;
  function setFullscreen(node, webkit = false) {
    document[webkit ? 'webkitFullscreenElement' : 'fullscreenElement'] = node;
    document.dispatch(webkit ? 'webkitfullscreenchange' : 'fullscreenchange');
  }
  player.requestFullscreen = function() {
    assert.equal(this, player);
    setFullscreen(player);
    return Promise.resolve();
  };
  document.exitFullscreen = function() {
    assert.equal(this, document);
    exitCalls++;
    setFullscreen(null);
    return Promise.resolve();
  };
  const context = vm.createContext({ document, window: { open: (...args) => opened.push(args) }, showToast: message => messages.push(message) });
  vm.runInContext(controller, context);
  return { context, document, player, iframe, expand, exit, listeners, messages, opened, setFullscreen, exitCalls: () => exitCalls };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('Escape explicitly exits fullscreen and restores keyboard focus', async () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  assert.equal(app.document.activeElement, app.exit);
  assert.equal(app.expand.attributes['aria-pressed'], 'true');
  let prevented = false;
  let stopped = false;
  app.document.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await tick();
  assert.equal(app.exitCalls(), 1);
  assert.equal(app.document.fullscreenElement, null);
  assert.equal(app.document.activeElement, app.expand);
  assert.equal(app.expand.attributes['aria-pressed'], 'false');
  assert(prevented && stopped);
  assert.equal(app.listeners.get('keydown')[0].capture, true);
});

test('Escape is not intercepted outside player fullscreen', () => {
  const app = createApp();
  const event = { key: 'Escape', preventDefault() { assert.fail('Normal Escape must stay available'); }, stopPropagation() { assert.fail('Normal Escape must keep propagating'); } };
  app.document.dispatch('keydown', event);
  app.setFullscreen({ id: 'unrelated-fullscreen' });
  app.document.dispatch('keydown', event);
  assert.equal(app.exitCalls(), 0);
});

test('repeated entry and exit reset state and allow the expand control to toggle off', async () => {
  const app = createApp();
  for (let cycle = 0; cycle < 3; cycle++) {
    app.context.enterFlowtunesFullscreen();
    assert.equal(app.document.fullscreenElement, app.player);
    app.context.enterFlowtunesFullscreen();
    await tick();
    assert.equal(app.document.fullscreenElement, null);
    assert.equal(app.document.activeElement, app.expand);
    assert.equal(app.expand.attributes['aria-pressed'], 'false');
  }
});

test('native browser Escape/back exit synchronizes state without using our exit button', () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  app.setFullscreen(null);
  assert.equal(app.document.activeElement, app.expand);
  assert.equal(app.expand.attributes['aria-pressed'], 'false');
  assert.equal(app.exitCalls(), 0);
});

test('one exit action unwinds nested player fullscreen layers', async () => {
  const app = createApp();
  app.setFullscreen(app.iframe);
  let calls = 0;
  app.document.exitFullscreen = async function() {
    assert.equal(this, app.document);
    calls++;
    app.setFullscreen(calls === 1 ? app.player : null);
  };
  await app.context.exitFlowtunesFullscreen();
  assert.equal(calls, 2);
  assert.equal(app.document.fullscreenElement, null);
  assert.equal(app.document.activeElement, app.expand);
});

test('player exit does not unwind an unrelated pre-existing fullscreen element', async () => {
  const app = createApp();
  const unrelated = { id: 'orientation-lock-root' };
  app.setFullscreen(app.player);
  app.document.exitFullscreen = async () => app.setFullscreen(unrelated);
  await app.context.exitFlowtunesFullscreen();
  assert.equal(app.document.fullscreenElement, unrelated);
  await app.context.exitFlowtunesFullscreen();
  assert.equal(app.document.fullscreenElement, unrelated);
});

test('legacy WebKit waits for its fullscreen-change event before restoring focus', async () => {
  const app = createApp();
  app.player.requestFullscreen = undefined;
  app.player.webkitRequestFullscreen = function() {
    assert.equal(this, app.player);
    app.setFullscreen(app.player, true);
  };
  let calls = 0;
  app.document.webkitExitFullscreen = function() {
    assert.equal(this, app.document);
    calls++; // Old WebKit returns void before completing the native transition.
  };
  app.context.enterFlowtunesFullscreen();
  assert.equal(app.document.activeElement, app.exit);
  await app.context.exitFlowtunesFullscreen();
  assert.equal(calls, 1);
  assert.equal(app.exitCalls(), 0, 'Use the API that owns the actual fullscreen state');
  assert.equal(app.document.activeElement, app.exit);
  app.setFullscreen(null, true);
  assert.equal(app.document.activeElement, app.expand);
  assert.equal(app.expand.attributes['aria-pressed'], 'false');
});

test('repeated exit actions do not race pending native requests', async () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  let finish;
  let calls = 0;
  app.document.exitFullscreen = () => {
    calls++;
    return new Promise(resolve => { finish = () => { app.setFullscreen(null); resolve(); }; });
  };
  const first = app.context.exitFlowtunesFullscreen();
  const second = app.context.exitFlowtunesFullscreen();
  assert.equal(calls, 1);
  finish();
  await Promise.all([first, second]);
  assert.equal(app.document.fullscreenElement, null);
});

test('native browser exit winning an Escape race is treated as success', async () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  app.document.exitFullscreen = () => {
    app.setFullscreen(null);
    return Promise.reject(new Error('Browser already exited'));
  };
  await app.context.exitFlowtunesFullscreen();
  assert.deepEqual(app.messages, []);
  assert.equal(app.document.activeElement, app.expand);
  assert.equal(app.expand.attributes['aria-pressed'], 'false');
});

test('rejected exits release the guard so the user can retry', async () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  app.document.exitFullscreen = () => Promise.reject(new Error('Denied'));
  await app.context.exitFlowtunesFullscreen();
  assert.match(app.messages[0], /browser controls/);
  app.document.exitFullscreen = async () => app.setFullscreen(null);
  await app.context.exitFlowtunesFullscreen();
  assert.equal(app.document.fullscreenElement, null);
});

test('an exit API that makes no progress cannot spin indefinitely', async () => {
  const app = createApp();
  app.context.enterFlowtunesFullscreen();
  let calls = 0;
  app.document.exitFullscreen = async () => { calls++; };
  await app.context.exitFlowtunesFullscreen();
  assert.equal(calls, 1);
});

test('unsupported entry opens Flowtunes safely and rejected entry reports a fallback', async () => {
  const app = createApp();
  app.player.requestFullscreen = undefined;
  app.context.enterFlowtunesFullscreen();
  assert.deepEqual(app.opened, [['https://www.flowtunes.app', '_blank', 'noopener,noreferrer']]);
  app.player.requestFullscreen = () => Promise.reject(new Error('Denied'));
  app.context.enterFlowtunesFullscreen();
  await tick();
  assert.match(app.messages[0], /Use Open app/);
});

test('the cross-origin iframe cannot take over fullscreen and hide our exit control', () => {
  const iframe = html.match(/<iframe\b[^>]*\bid="flowtunes-frame"[^>]*>/)[0];
  assert.match(iframe, /fullscreen 'none'/);
  assert.doesNotMatch(iframe, /\ballowfullscreen\b/);
  assert.match(iframe, /autoplay/);
  assert.doesNotMatch(iframe, /scrolling="no"/);
});
