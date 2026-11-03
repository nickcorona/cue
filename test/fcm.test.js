import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { fcmSendAll, fcmMessage } from '../lib/fcm.js';
import { nowContent, dropGone } from '../lib/push.js';
import { widgetData } from '../api/push.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const sa = { project_id: 'cue-app', client_email: 'push@cue-app.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };

test('fcm: signs a JWT for the token, sends one data message per device, reports dead tokens', async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('oauth2')) {
      const [h, c, sig] = new URLSearchParams(opts.body).get('assertion').split('.');
      assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url')));
      assert.equal(JSON.parse(Buffer.from(c, 'base64url')).scope, 'https://www.googleapis.com/auth/firebase.messaging');
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    }
    const msg = JSON.parse(opts.body).message;
    if (msg.token === 'dead-token-xxxxxxxxxxxxxxx') return { ok: false, status: 404, json: async () => ({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }) };
    assert.equal(opts.headers.Authorization, 'Bearer tok');
    assert.equal(msg.android.priority, 'HIGH');
    assert.deepEqual(JSON.parse(msg.data.p), { title: 'Eye drops' });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const r = await fcmSendAll(sa, ['live-token-xxxxxxxxxxxxxxx', 'dead-token-xxxxxxxxxxxxxxx'], { title: 'Eye drops' }, fake);
  assert.deepEqual(r, { sent: 1, gone: ['dead-token-xxxxxxxxxxxxxxx'], errors: [] });
  assert.ok(calls[1].url.endsWith('/v1/projects/cue-app/messages:send'));
  // The access token is reused for the next send.
  await fcmSendAll(sa, ['live-token-xxxxxxxxxxxxxxx'], { title: 'Eye drops' }, fake);
  assert.equal(calls.filter(c => c.url.includes('oauth2')).length, 1);
});

test('fcm: data values are strings', () => {
  const m = fcmMessage('t', { title: 'x', prog: [1, 3] });
  assert.equal(typeof m.message.data.p, 'string');
});

test('dropGone clears both web subscriptions and app tokens', () => {
  const s = { push: { subs: [{ endpoint: 'https://a' }, { endpoint: 'https://b' }], fcm: [{ token: 'x' }, { token: 'y' }] } };
  dropGone(s, ['https://a', 'y']);
  assert.deepEqual(s.push.subs, [{ endpoint: 'https://b' }]);
  assert.deepEqual(s.push.fcm, [{ token: 'x' }]);
});

const TZ = 'America/Toronto';
const at = hm => Date.parse(`2026-10-29T${hm}:00-04:00`);
const base = () => ({
  settings: { tz: TZ, wake: '07:00', default_est_min: 15, capacity_min_per_day: 120, capacity_weekend_min: 240, urgency_hard: 4, urgency_soft: 1 },
  meta: {}, estimates: [], goals: [], routines: [], habits: [],
  tasks: [
    { id: 't1', title: 'Order the new card', status: 'open', who: 'me', est_min: 5, impact: { consequence: 'money', magnitude: 2 }, project: 'Money' },
    { id: 't2', title: 'Email Sam the ratios', status: 'open', who: 'me', est_min: 20, impact: { consequence: 'career', magnitude: 2 }, project: 'Work' },
  ],
});

test('the app gets a countdown end and progress for a running focus block', () => {
  const s = base();
  s.focus = { sessions: [{ id: 'f1', task_id: 't1', title: 'Order the new card', planned_min: 25, started: new Date(at('09:00')).toISOString(), paused_ms: 0 }] };
  const c = nowContent(s, at('09:10'));
  assert.equal(c.ends, at('09:25'));
  assert.deepEqual(c.prog, [10, 25]);
  assert.equal(c.ctx, 'Focus · until 09:25');
  s.focus.sessions[0].paused_at = new Date(at('09:12')).toISOString();
  assert.equal(nowContent(s, at('09:15')).ends, undefined);
});

test('widget data: the Now item and what is left of today', () => {
  const w = widgetData(base(), at('10:00'));
  assert.equal(w.now.check.kind, 'task');
  assert.ok(w.today.length >= 1 && w.today.every(t => t.title && t.est_min));
  assert.equal(w.done, 0);
  assert.ok(w.total >= w.today.length);
});

test('widget data: a routine put off with Later is listed as paused, not dropped', () => {
  const s = base();
  s.routines = [{ id: 'r_m', name: 'Morning routine', time: '08:00', steps: [{ id: 'a', title: 'Eye drops', core: true }, { id: 'b', title: 'Luminette', core: true }],
    log: { '2026-10-29': { ticks: { a: 'done' }, at: { a: new Date(at('08:01')).toISOString() } } } }];
  assert.equal(widgetData(s, at('09:00')).now.title, 'Luminette');
  assert.deepEqual(widgetData(s, at('09:00')).paused, []);
  s.push = { now_skip: { date: '2026-10-29', keys: ['step:r_m:b'], at: { 'step:r_m:b': new Date(at('12:30')).toISOString() } } };
  const w = widgetData(s, at('13:00'));
  assert.notEqual(w.now.title, 'Luminette');
  assert.deepEqual(w.paused, [{ id: 'r_m', name: 'Morning routine', done: 1, total: 2 }]);
});

test('widget data: resuming a paused routine clears it from paused and brings it back to Now', () => {
  const s = base();
  s.routines = [{ id: 'r_m', name: 'Morning routine', time: '08:00', steps: [{ id: 'a', title: 'Eye drops', core: true }, { id: 'b', title: 'Luminette', core: true }],
    log: { '2026-10-29': { ticks: { a: 'done' }, at: { a: new Date(at('08:01')).toISOString() } } } }];
  s.push = { now_skip: { date: '2026-10-29', keys: ['step:r_m:b', 'task:t9'], at: { 'step:r_m:b': new Date(at('12:30')).toISOString(), 'task:t9': new Date(at('12:30')).toISOString() } } };
  assert.equal(widgetData(s, at('13:00')).paused.length, 1);
  // What now_unskip does to the store.
  s.push.now_skip.keys = s.push.now_skip.keys.filter(k => !k.startsWith('step:r_m:'));
  const w = widgetData(s, at('13:00'));
  assert.deepEqual(w.paused, []);
  assert.equal(w.now.title, 'Luminette');
});

test('widget data predicts what Now shows after Done, so Home can move on at once', () => {
  const s = base();
  s.routines = [{ id: 'r_m', name: 'Morning routine', time: '08:00', steps: [{ id: 'a', title: 'Rinse face' }, { id: 'b', title: 'Make bed' }] }];
  const w = widgetData(s, at('09:00'));
  assert.equal(w.now.title, 'Rinse face');
  assert.equal(w.after_done.title, 'Make bed');
  // The prediction is on a copy: nothing was ticked.
  assert.equal(s.routines[0].log, undefined);
  // The last step's Done moves on to the top task.
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done' } } };
  assert.equal(widgetData(s, at('09:00')).after_done.check.kind, 'task');
});
