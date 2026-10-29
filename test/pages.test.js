// The browser-side code ships as strings inside server modules, so a quote escaped one level
// short (\' vs \\') or a stray backtick only fails on the phone. These tests compile every
// page's scripts and the service worker, and drive the service worker's notification buttons.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { renderPage } from '../lib/ui.js';
import { renderBuild } from '../lib/buildui.js';
import { renderCook } from '../lib/cookui.js';
import { renderFocus } from '../lib/focusui.js';
import { renderLift } from '../lib/liftui.js';
import { renderMood } from '../lib/moodui.js';

const scripts = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

test('every page script compiles', () => {
  const pages = { queue: renderPage({ key: 'k' }), widget: renderPage({ key: 'k', view: 'widget' }), build: renderBuild({ key: 'k' }), cook: renderCook({ key: 'k' }), focus: renderFocus({ key: 'k' }), lift: renderLift({ key: 'k' }), mood: renderMood({ key: 'k' }) };
  for (const [name, html] of Object.entries(pages)) {
    const js = scripts(html);
    assert.ok(js.length, `${name} has a script`);
    for (const src of js) assert.doesNotThrow(() => new vm.Script(src), `${name} page script compiles`);
  }
});

// The service worker source, as served at /sw.js.
const SW = fs.readFileSync(new URL('../api/web.js', import.meta.url), 'utf8').match(/const SW = `([\s\S]*?)`;/)[1];

function worker({ next = { title: 'Morning routine · 2/5', body: 'Brush teeth', tag: 'cue-now', check: { kind: 'routine_step' }, skip: 'step:r:b' } } = {}) {
  const on = {}, shown = [], posts = [], opened = [];
  let closed = 0;
  const self = {
    addEventListener: (t, f) => { on[t] = f; },
    registration: { showNotification: (title, o) => { shown.push({ title, ...o }); return Promise.resolve(); }, getNotifications: async () => [{ close() { closed++; } }] },
  };
  const fetch = async (url, o) => { posts.push([url, JSON.parse(o.body)]); return { ok: true, json: async () => ({ next }) }; };
  const clients = { matchAll: async () => [], openWindow: async u => opened.push(u) };
  new vm.Script(SW).runInNewContext({ self, fetch, clients, caches: {}, location: {}, URL, Promise, JSON });
  const click = async (action, data, extra = {}) => {
    const waits = [];
    on.notificationclick({ action, notification: { close() { closed++; }, data, ...extra }, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
  };
  const push = async d => { const waits = []; on.push({ data: { json: () => d }, waitUntil: p => waits.push(p) }); await Promise.all(waits); };
  return { shown, posts, opened, click, push, closed: () => closed };
}
const nowData = { url: '/', check: { kind: 'routine_step', id: 'r', step_id: 'a' }, skip: 'step:r:a', now: true };

test('sw: a Now push shows Done and Not now; a task shows Start 25 min', async () => {
  const w = worker();
  await w.push({ title: 'Morning routine · 1/5', body: 'Eye drops', tag: 'cue-now', check: { kind: 'routine_step' }, skip: 'step:r:a', renotify: true });
  assert.deepEqual(Array.from(w.shown[0].actions, a => a.title), ['Done', 'Not now']);
  assert.equal(w.shown[0].renotify, true);
  await w.push({ title: 'Move · 1/3 today', body: 'Order', tag: 'cue-now', start: { task_id: 't' }, skip: 'task:t' });
  assert.deepEqual(Array.from(w.shown[1].actions, a => a.title), ['Start 25 min', 'Not now']);
});

test('sw: Done acknowledges at once, then the next item arrives as a heads-up, never closing it', async () => {
  const w = worker();
  await w.click('done', nowData);
  assert.equal(w.shown[0].title, '✓ Done');
  assert.equal(w.shown[0].silent, true);
  assert.deepEqual(JSON.parse(JSON.stringify(w.posts[0])), ['/api/push?action=check', { kind: 'routine_step', id: 'r', step_id: 'a', now: true }]);
  assert.equal(w.shown[1].title, 'Morning routine · 2/5');
  assert.equal(w.shown[1].renotify, true);
  assert.equal(w.shown[1].silent, false);
  assert.equal(w.closed(), 0);
});

test('sw: with nothing next, Done clears the notification', async () => {
  const w = worker({ next: null });
  await w.click('done', nowData);
  assert.equal(w.closed(), 1);
});

test('sw: Not now on a task also opens the "what\'s in the way" prompt; on a step it does not', async () => {
  const w = worker();
  await w.click('skip', { ...nowData, skip: 'task:t_9' });
  assert.deepEqual(JSON.parse(JSON.stringify(w.posts[0])), ['/api/push?action=now_skip', { key: 'task:t_9' }]);
  assert.deepEqual(w.opened, ['/?stuck=t_9']);
  const v = worker();
  await v.click('skip', nowData);
  assert.deepEqual(v.opened, []);
});

test('sw: tapping the body opens the app and leaves Now in place; other notifications close', async () => {
  const w = worker();
  await w.click('', { ...nowData, url: '/?score=r:a' });
  assert.deepEqual(w.opened, ['/?score=r:a']);
  assert.equal(w.closed(), 0);
  await w.click('', { url: '/' });
  assert.equal(w.closed(), 1);
});
