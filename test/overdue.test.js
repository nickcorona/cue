// A missed soft date fades instead of riding the top forever, Snooze carries a soft date
// along, and the home surfaces say "overdue" only for a hard deadline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-overdue-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const { callTool, rankingFit } = await import('../lib/tools.js');
const { rankTasks, softOverduePressure, FOCUS_FIT } = await import('../lib/logic.js');
const { dueNote } = await import('../lib/push.js');
const run = (name, args) => callTool(name, args, { idle: false });

const TZ = 'America/Toronto';
const at = (d, hm) => Date.parse(`${d}T${hm}:00-04:00`);
const state = tasks => ({
  settings: { tz: TZ, wake: '07:00', default_est_min: 15, capacity_min_per_day: 120, capacity_weekend_min: 300, urgency_hard: 20, urgency_soft: 5 },
  meta: {}, estimates: [], goals: [], routines: [], habits: [], lists: [], tasks,
});
const task = (id, extra = {}) => ({ id, title: id, status: 'open', who: 'me', est_min: 30, impact: { consequence: 'money', magnitude: 2 }, ...extra });

test('soft overdue pressure is full for a day, then fades to nothing by day 3', () => {
  assert.equal(softOverduePressure(0.5 * 864e5), 1);
  assert.equal(softOverduePressure(2 * 864e5), 0.5);
  assert.equal(softOverduePressure(3 * 864e5), 0);
  assert.equal(softOverduePressure(30 * 864e5), 0);
});

test('a soft date missed days ago competes on value and is flagged for a new date; a hard one keeps full urgency', () => {
  const now = at('2026-11-06', '10:00');
  const s = state([task('soft', { due: '2026-11-01' }), task('hard', { due: '2026-11-01', hard: true }), task('plain')]);
  const by = Object.fromEntries(rankTasks(s, now).scored.map(x => [x.t.id, x]));
  assert.equal(by.soft.urgency, 1);
  assert.equal(by.soft.redate, true);
  assert.equal(by.hard.urgency, 21);
  assert.equal(by.hard.redate, false);
  assert.ok(Math.abs(by.soft.score - by.plain.score) < 1e-9); // same value, no leftover boost
});

test('energy fit stays a small nudge', () => {
  assert.ok(FOCUS_FIT.deep.peak / FOCUS_FIT.deep.off < 1.3);
  assert.ok(FOCUS_FIT.light.off / FOCUS_FIT.light.peak < 1.3);
});

test('notifications say overdue only for a hard deadline', () => {
  assert.equal(dueNote({ due: '2026-11-01', hard: true }, '2026-11-06'), 'overdue');
  assert.equal(dueNote({ due: '2026-11-01' }, '2026-11-06'), 'from 11-01');
  assert.equal(dueNote({ due: '2026-11-09T09:00' }, '2026-11-06'), 'due 11-09');
  assert.equal(dueNote({}, '2026-11-06'), null);
});

test('snoozing past a soft date moves the date with it; a hard deadline stays put', async () => {
  const { added: [soft, hard] } = await run('add_tasks', { tasks: [
    { title: 'Return the parcel', impact: { consequence: 'money', magnitude: 1 }, est_min: 15, due: '2020-01-03T17:00' },
    { title: 'File the claim', impact: { consequence: 'money', magnitude: 3 }, est_min: 30, due: '2020-01-03', hard: true },
  ] });
  const { updated } = await run('update_tasks', { updates: [{ id: soft.id, start: '2020-01-06' }, { id: hard.id, start: '2020-01-06' }] });
  assert.equal(updated[0].due, '2020-01-06T17:00');
  assert.equal(updated[1].due, '2020-01-03');
  // An explicit due in the same update wins.
  const { updated: [u] } = await run('update_tasks', { updates: [{ id: soft.id, start: '2020-01-10', due: '2020-01-20' }] });
  assert.equal(u.due, '2020-01-20');
});

test('a plan is saved on the task and comes back on the queue row', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Write the cover letter', impact: { consequence: 'career', magnitude: 3 }, est_min: 45, plan: 'Tue 9am at the desk: open the draft' }] });
  const q = await run('get_queue', {});
  const row = [...q.today_tasks, ...q.tasks].find(x => x.id === t.id);
  assert.equal(row.plan, 'Tue 9am at the desk: open the draft');
  assert.ok(row.why);
});

test('ranking fit reports how often he did the queue\'s top pick', () => {
  const day = d => new Date(at(d, '12:00')).toISOString();
  const s = { settings: { tz: TZ }, choices: [
    { at: day('2026-11-05'), rank: 1 }, { at: day('2026-11-04'), rank: 4 }, { at: day('2026-11-03'), rank: 1 },
    { at: day('2026-11-02'), kind: 'reorder' }, { at: day('2026-10-28'), rank: 2 },
  ] };
  const f = rankingFit(s, '2026-11-06');
  assert.deepEqual(f.this_week, { picks: 3, top_pick_share: 0.67, top3_share: 0.67, median_rank: 1 });
  assert.deepEqual(f.last_week, { picks: 1, top_pick_share: 0, top3_share: 1, median_rank: 2 });
});

test('check-off taps logged as 1-minute timings don\'t drag the estimate correction down', async () => {
  const { durationModel } = await import('../lib/logic.js');
  const taps = Array.from({ length: 10 }, () => ({ est: 30, actual: 1 }));
  const m = durationModel({ estimates: taps });
  assert.equal(m.observations, 0);
  assert.equal(m.expected_multiplier, durationModel({ estimates: [] }).expected_multiplier);
  assert.equal(durationModel({ estimates: [...taps, { est: 45, actual: 37 }] }).observations, 1);
});

test('a time he reports is kept even past 5x; only unsourced old entries get the tap test', async () => {
  const { durationModel, isTap } = await import('../lib/logic.js');
  assert.equal(durationModel({ estimates: [{ est: 30, actual: 180, src: 'chat' }] }).observations, 1);
  assert.equal(durationModel({ estimates: [{ est: 30, actual: 180 }] }).observations, 0);
  assert.equal(isTap(2, 5), false); // a real 2-minute block on a 5-minute task is a timing
  assert.equal(isTap(1, 30), true);
  // Junk outside the band doesn't crowd real timings out of the 300 window.
  const junk = Array.from({ length: 400 }, () => ({ est: 30, actual: 1 }));
  assert.equal(durationModel({ estimates: [{ est: 30, actual: 40, src: 'chat' }, ...junk] }).observations, 1);
});

test('Today\'s pace counts an old focus tap as the estimate, not 1 minute', async () => {
  const { recentPace } = await import('../lib/today.js');
  const s = { settings: { tz: TZ, default_est_min: 15 }, tasks: [
    { id: 'a', est_min: 30, history: [{ done: new Date(at('2026-11-05', '12:00')).toISOString(), actual_min: 1, from_focus: true }] },
    { id: 'b', est_min: 30, history: [{ done: new Date(at('2026-11-05', '13:00')).toISOString(), actual_min: 40 }] },
  ] };
  assert.equal(recentPace(s, '2026-11-06', 1) * 7, 70);
});

test('a focus tap sends no time; undo takes back the timing a check-off logged', async () => {
  const { added: [t, u] } = await run('add_tasks', { tasks: [
    { title: 'Read the lease addendum', impact: { consequence: 'money', magnitude: 1 }, est_min: 30 },
    { title: 'Sort the receipts', impact: { consequence: 'money', magnitude: 1 }, est_min: 20 },
  ] });
  const session = await run('focus_start', { task_id: t.id, minutes: 25 });
  await run('focus_stop', { session_id: session.id, outcome: 'done', minutes: 1 });
  const { read } = await import('../lib/store.js');
  let st = await read();
  assert.equal(st.tasks.find(x => x.id === t.id).history.at(-1).actual_min, undefined);
  assert.equal(st.estimates.filter(e => e.task === t.id).length, 0);

  await run('check_off', { items: [{ kind: 'task', id: u.id, actual_min: 25 }] });
  st = await read();
  assert.equal(st.estimates.filter(e => e.task === u.id).length, 1);
  await run('check_off', { items: [{ kind: 'task', id: u.id, undo: true }] });
  st = await read();
  assert.equal(st.estimates.filter(e => e.task === u.id).length, 0);
});
