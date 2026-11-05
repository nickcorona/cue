// After a check-off the done row asks one thing: did it change his mood (worse, same, better),
// or for a task he predicted, was it worse or better than expected. Answering clears it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-moodask-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const { callTool } = await import('../lib/tools.js');
const { insights, moodTags } = await import('../lib/mood.js');
const run = (name, args) => callTool(name, args, { idle: false });

test('an ordinary checked-off task is not asked about: the day rating is the mood signal', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Email Sam the ratios', impact: { consequence: 'career', magnitude: 1 }, est_min: 10 }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  assert.equal((await run('get_queue', {})).last_done.mood_ask, undefined);
  // A change can still be logged by hand.
  const r = await run('log_mood', { change: 1, linked_id: t.id, via: 'web' });
  assert.equal(r.logged.change, 1);
});

test('a task with a predicted mood asks against the prediction', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Call the gym', impact: { consequence: 'health', magnitude: 1 }, est_min: 5, predicted_mood: 3 }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  assert.equal((await run('get_queue', {})).last_done.mood_ask.type, 'vs');
  const r = await run('log_mood', { vs_predicted: 1, linked_id: t.id });
  assert.equal(r.logged.vs_predicted, 1);
  await assert.rejects(run('log_mood', { activity: 'x' }), /Give mood/);
  await assert.rejects(run('log_mood', { change: 2, activity: 'x' }), /-1 \(worse\)/);
});

test('a routine is not asked about, finished or not', async () => {
  await run('save_routine', { name: 'Dinner', steps: [{ title: 'Cook a default dinner' }, { title: 'Clean the pan' }] });
  const r = (await run('get_queue', {})).routines.find(x => x.name === 'Dinner') || (await run('find', { query: 'Dinner', kind: 'routine' })).routines[0];
  const [a, b] = r.steps;
  await run('check_off', { items: [{ kind: 'routine_step', id: r.id, step_id: a.id }] });
  assert.equal((await run('get_queue', {})).last_done.mood_ask, undefined);
  await run('check_off', { items: [{ kind: 'routine_step', id: r.id, step_id: b.id }] });
  assert.equal((await run('get_queue', {})).last_done.mood_ask, undefined);
});

test('insights read worse/same/better entries without a 0-10 baseline', () => {
  const at = new Date(Date.now() - 3600e3).toISOString();
  const es = [1, 1, 0].map((c, i) => ({ id: `c${i}`, at, change: c, activity: 'walk', family: 'walk' }));
  const ins = insights(es, {});
  assert.equal(ins.baseline, null);
  const f = ins.families[0];
  assert.equal(f.avg, undefined);
  assert.equal(f.change_avg, 0.67);
  assert.equal(f.better, 0.67);
  assert.ok(moodTags(es, {}).has('walk'));
  assert.deepEqual(ins.time_of_day, []);
});

test("Cue Home's widget carries the ask, and its tap logs the answer", async () => {
  process.env.APP_KEY = 'k';
  const { default: push, widgetData } = await import('../api/push.js');
  const { read } = await import('../lib/store.js');
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Order cheques', impact: { consequence: 'money', magnitude: 1 }, est_min: 10, predicted_mood: 4 }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  assert.equal(widgetData(await read()).last_done.mood_ask.id, t.id);
  let code, out;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: j => { out = j; return res; } };
  await push({ method: 'POST', query: { key: 'k', action: 'mood' }, headers: {}, body: { id: t.id, vs_predicted: -1 } }, res);
  assert.equal(code, 200, JSON.stringify(out));
  assert.equal(widgetData(await read()).last_done.mood_ask, undefined);
});

test("the phone's home and guard log lands on the server and shows in settings", async () => {
  process.env.APP_KEY = 'k';
  const { default: push } = await import('../api/push.js');
  let code;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: () => res };
  await push({ method: 'POST', query: { key: 'k', action: 'diag' }, headers: {}, body: { app: '1.48', events: [{ at: Date.now(), e: 'home=false guard=true' }] } }, res);
  assert.equal(code, 200);
  const s = await run('settings', {});
  assert.ok(s.phone_log.some(l => l.includes('home=false guard=true (app 1.48)')), JSON.stringify(s.phone_log));
});

test("the phone's rules are kept on the server for a reinstall to restore", async () => {
  process.env.APP_KEY = 'k';
  const { default: push } = await import('../api/push.js');
  let code, out;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: j => { out = j; return res; } };
  await push({ method: 'GET', query: { key: 'k', action: 'rules' }, headers: {} }, res);
  assert.equal(code, 200);
  const prefs = { locked: { b: true }, allowed: { set: ['com.reddit'] }, pending: { set: ['1|level|com.youtube=0'] } };
  await push({ method: 'POST', query: { key: 'k', action: 'rules' }, headers: {}, body: { prefs } }, res);
  assert.equal(code, 200);
  await push({ method: 'GET', query: { key: 'k', action: 'rules' }, headers: {} }, res);
  assert.deepEqual(out.rules.prefs, prefs);
  await push({ method: 'POST', query: { key: 'k', action: 'rules' }, headers: {}, body: { prefs: [1] } }, res);
  assert.equal(code, 400);
  await push({ method: 'GET', query: { action: 'rules' }, headers: {} }, res);
  assert.equal(code, 401);
});

test('screen time from the phone lands by date and the week card compares it with before Cue Home', async () => {
  process.env.APP_KEY = 'k';
  const { default: push } = await import('../api/push.js');
  const { read } = await import('../lib/store.js');
  const { phoneTrends } = await import('../lib/metrics.js');
  let code;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: () => res };
  const day = (date, screen_min, unlocks) => ({ date, screen_min, unlocks, gated_min: 10, apps: { YouTube: 40 } });
  await push({ method: 'POST', query: { key: 'k', action: 'usage' }, headers: {}, body: { days: [day('2026-10-29', 240, 90), day('2026-10-30', 200, 70), day('2026-11-03', 120, 40), { date: 'bad' }] } }, res);
  assert.equal(code, 200);
  const s = await read();
  assert.equal(s.usage['2026-11-03'].screen_min, 120);
  assert.equal(s.usage.bad, undefined);
  const [screen, unlocks] = phoneTrends(s, '2026-11-02', '2026-11-09');
  assert.deepEqual([screen.now, screen.avg, unlocks.now, unlocks.avg], [120, 220, 40, 80]);
  assert.equal((await run('settings', {})).screen_time.at(-1).date, '2026-11-03');
});

test('Home gets what Now becomes after Not now, so it can move on at once', async () => {
  const { widgetData } = await import('../api/push.js');
  const { read } = await import('../lib/store.js');
  await run('add_tasks', { tasks: [{ title: 'First thing', impact: { consequence: 'money', magnitude: 3 }, est_min: 5 }, { title: 'Second thing', impact: { consequence: 'annoyance', magnitude: 1 }, est_min: 5 }] });
  const w = widgetData(await read());
  assert.ok(w.now?.skip, JSON.stringify(w.now));
  assert.notEqual(w.after_skip?.now_key, w.now.now_key);
});
