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

test('a checked-off task asks worse/same/better on the done row, once', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Email Sam the ratios', impact: { consequence: 'career', magnitude: 1 }, est_min: 10 }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  const q = await run('get_queue', {});
  assert.deepEqual(q.last_done.mood_ask, { type: 'change', id: t.id, label: 'Email Sam the ratios' });
  const r = await run('log_mood', { change: 1, linked_id: t.id, via: 'web' });
  assert.equal(r.logged.change, 1);
  assert.equal(r.logged.mood, undefined);
  assert.equal((await run('get_queue', {})).last_done.mood_ask, undefined);
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

test('a routine is asked once it is finished, never per step', async () => {
  await run('save_routine', { name: 'Dinner', steps: [{ title: 'Cook a default dinner' }, { title: 'Clean the pan' }] });
  const r = (await run('get_queue', {})).routines.find(x => x.name === 'Dinner') || (await run('find', { query: 'Dinner', kind: 'routine' })).routines[0];
  const [a, b] = r.steps;
  await run('check_off', { items: [{ kind: 'routine_step', id: r.id, step_id: a.id }] });
  assert.equal((await run('get_queue', {})).last_done.mood_ask, undefined);
  await run('check_off', { items: [{ kind: 'routine_step', id: r.id, step_id: b.id }] });
  assert.deepEqual((await run('get_queue', {})).last_done.mood_ask, { type: 'change', id: r.id, label: 'Dinner' });
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
