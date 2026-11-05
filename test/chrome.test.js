// The Chrome extension's gate (chrome/rules.js) and its unlock log on the server: listed sites
// open only inside a time box earned with a reason and a wait; loosening waits a day once locked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-chrome-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const R = await import('../chrome/rules.js');
const H = 3600e3;

test('listed sites and their subdomains are gated; others and non-web pages are not', () => {
  const s = R.fresh();
  assert.equal(R.gatedSite('https://www.youtube.com/watch?v=1', s), 'youtube.com');
  assert.equal(R.gatedSite('https://m.youtube.com/', s), 'youtube.com');
  assert.equal(R.gatedSite('https://news.ycombinator.com/item?id=1', s), 'news.ycombinator.com');
  assert.equal(R.gatedSite('https://ycombinator.com/', s), null);
  assert.equal(R.gatedSite('https://notyoutube.com/', s), null);
  assert.equal(R.gatedSite('https://github.com/', s), null);
  assert.equal(R.gatedSite('chrome://newtab', s), null);
  s.on = false;
  assert.equal(R.gatedSite('https://youtube.com/', s), null);
});

test('unlock needs 3 words and a listed duration, and each site keeps its own box', () => {
  const s = R.fresh(), t = Date.parse('2026-11-04T15:00:00Z');
  assert.throws(() => R.unlock(s, 'youtube.com', 5, 'music', t), /3 words/);
  assert.throws(() => R.unlock(s, 'youtube.com', 60, 'watch the lecture video', t), /5 or 15/);
  const until = R.unlock(s, 'youtube.com', 15, 'watch the lecture video', t);
  assert.equal(until, t + 15 * 60000);
  R.unlock(s, 'reddit.com', 5, 'read the linked thread', t + 60000);
  assert.ok(R.isOpen(s, 'https://youtube.com/x', t + 14 * 60000));
  assert.ok(!R.isOpen(s, 'https://youtube.com/x', t + 16 * 60000));
  assert.ok(R.isOpen(s, 'https://reddit.com/r/x', t + 5 * 60000));
  assert.equal(s.log.length, 2);
  assert.equal(s.outbox.length, 2);
  assert.deepEqual(s.log[0], { at: new Date(t).toISOString(), site: 'youtube.com', minutes: 15, reason: 'watch the lecture video' });
});

test('adding is instant; once locked, removing and turning off wait a day and can be cancelled', () => {
  const s = R.fresh(), t = Date.now();
  assert.equal(R.addSite(s, 'https://www.espn.com/nba'), 'espn.com');
  assert.equal(R.addSite(s, 'not a site'), null);
  assert.ok(s.sites.includes('espn.com'));
  assert.deepEqual(R.removeSite(s, 'espn.com', t), { done: true });
  assert.ok(!s.sites.includes('espn.com'));
  R.lock(s);
  const r = R.removeSite(s, 'youtube.com', t);
  assert.equal(r.done, false);
  assert.equal(r.at, t + R.DELAY_MS);
  assert.ok(s.sites.includes('youtube.com'));
  assert.equal(R.settle(s, t + 23 * H), false);
  assert.equal(R.settle(s, t + 25 * H), true);
  assert.ok(!s.sites.includes('youtube.com'));
  R.turnOff(s, t);
  R.cancel(s, 'off');
  assert.equal(R.settle(s, t + 25 * H), false);
  assert.ok(s.on);
  // Re-adding a site cancels its pending removal.
  R.removeSite(s, 'reddit.com', t);
  R.addSite(s, 'reddit.com');
  assert.equal(s.pending.length, 0);
});

test('while locked the extensions page is guarded', () => {
  const s = R.fresh();
  assert.equal(R.guardsSelf(s, 'chrome://extensions/'), false);
  R.lock(s);
  assert.equal(R.guardsSelf(s, 'chrome://extensions/?id=abc'), true);
  assert.equal(R.guardsSelf(s, 'chrome://settings/'), false);
});

test('load fills in a missing or partial stored state', () => {
  assert.deepEqual(R.load(undefined).sites, R.DEFAULT_SITES);
  const s = R.load({ sites: ['a.com'], locked: true });
  assert.deepEqual(s.sites, ['a.com']);
  assert.ok(s.locked && Array.isArray(s.pending) && s.on);
});

test('browser unlocks land on the server, deduped, and show in settings', async () => {
  process.env.APP_KEY = 'k';
  const { default: push } = await import('../api/push.js');
  const { callTool } = await import('../lib/tools.js');
  const { read } = await import('../lib/store.js');
  let code;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: () => res };
  const at = new Date().toISOString();
  const unlocks = [{ at, site: 'youtube.com', minutes: 15, reason: 'watch the lecture video' }, { at: 'nonsense', site: 'x.com', minutes: 5, reason: 'r' }];
  await push({ method: 'POST', query: { key: 'k', action: 'web_unlock' }, headers: {}, body: { unlocks, device: 'chrome' } }, res);
  assert.equal(code, 200);
  await push({ method: 'POST', query: { key: 'k', action: 'web_unlock' }, headers: {}, body: { unlocks } }, res);
  const s = await read();
  assert.equal(s.web_unlocks.length, 1);
  assert.equal(s.web_unlocks[0].reason, 'watch the lecture video');
  const set = await callTool('settings', {}, { idle: false });
  assert.match(set.browser_unlocks[0], /youtube\.com 15m: watch the lecture video$/);
  await push({ method: 'POST', query: { key: 'wrong', action: 'web_unlock' }, headers: {}, body: { unlocks } }, res);
  assert.equal(code, 401);
});

test('the key works from an Authorization header, so clients can keep it out of URLs', async () => {
  process.env.APP_KEY = 'k';
  const { default: push } = await import('../api/push.js');
  let code;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: () => res };
  await push({ method: 'GET', query: { action: 'status' }, headers: { authorization: 'Bearer k' } }, res);
  assert.equal(code, 200);
  await push({ method: 'GET', query: { action: 'status' }, headers: { authorization: 'Bearer nope' } }, res);
  assert.equal(code, 401);
  await push({ method: 'GET', query: { action: 'status', key: 'k' }, headers: { cookie: 'nt_key=stale' } }, res);
  assert.equal(code, 200); // a stale cookie doesn't block a right key sent another way
});
