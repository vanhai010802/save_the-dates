import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/app-updates.js', import.meta.url), 'utf8');
const oldVersion = '1111111111111111', newVersion = '2222222222222222';
const settle = () => new Promise(resolve => setImmediate(resolve));

function client({version = oldVersion, url = 'https://example.test/our-story?keep=yes#memories'} = {}) {
  const events = {}, requests = [], navigations = [];
  const state = {latest:version, modal:false, editing:false, offline:false, mutation:null};
  const document = {
    hidden:false, body:{},
    activeElement:{matches:() => state.editing},
    querySelector:selector => selector.startsWith('meta') ? {content:version} : state.modal ? {} : null,
    addEventListener:(name, listener) => { events[name] = listener; },
  };
  vm.runInNewContext(source, {
    document, window:{addEventListener:(name, listener) => { events[name] = listener; }},
    location:{href:url, replace:target => navigations.push(target)},
    URL, Date, AbortController, setTimeout, clearTimeout,
    setInterval:listener => { events.interval = listener; },
    MutationObserver:class { constructor(listener) { state.mutation = listener; } observe() {} },
    fetch:async (url, options) => {
      requests.push({url, options});
      if (state.offline) throw Error('offline');
      return {ok:true, json:async () => ({version:state.latest})};
    },
  });
  return {state, events, requests, navigations, document};
}

test('a restored Safari page checks without cache and refreshes only on a new build', async () => {
  const app = client(); await settle();
  assert.equal(app.navigations.length, 0);
  app.state.latest = newVersion;
  await app.events.pageshow({persisted:true});
  assert.equal(app.requests.at(-1).options.cache, 'no-store');
  assert.match(app.requests.at(-1).url, /^\/version.json\?t=\d+$/);
  assert.equal(app.navigations.length, 1);
  const target = new URL(app.navigations[0]);
  assert.equal(target.pathname, '/our-story');
  assert.equal(target.searchParams.get('keep'), 'yes');
  assert.equal(target.searchParams.get('__app_version'), newVersion);
  assert.equal(target.hash, '#memories');
  await app.events.focus();
  assert.equal(app.navigations.length, 1, 'duplicate events cannot refresh twice');
});

test('updates wait until a film or editor closes and never refresh a hidden tab', async () => {
  const app = client(); await settle();
  app.state.latest = newVersion; app.state.modal = true;
  await app.events.interval();
  assert.equal(app.navigations.length, 0);
  app.state.modal = false; app.state.editing = true; app.state.mutation();
  assert.equal(app.navigations.length, 0);
  app.state.editing = false; app.document.hidden = true; app.state.mutation();
  assert.equal(app.navigations.length, 0);
  app.document.hidden = false; await app.events.visibilitychange();
  assert.equal(app.navigations.length, 1);
});

test('offline, malformed version responses and stale HTML do not cause reload loops', async () => {
  const app = client({url:`https://example.test/?__app_version=${newVersion}`}); await settle();
  app.state.latest = newVersion; await app.events.focus();
  assert.equal(app.navigations.length, 0);
  app.state.latest = '<html>error</html>'; await app.events.focus();
  assert.equal(app.navigations.length, 0);
  app.state.offline = true; await app.events.online();
  assert.equal(app.navigations.length, 0);
  const development = client({version:'development'}); await settle();
  assert.equal(development.requests.length, 0);
});
