// Move to top on a Today card moves it: Today's set is locked for the day, its order follows the ranking.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-todaymove-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const { callTool } = await import('../lib/tools.js');
const run = (name, args) => callTool(name, args, { idle: false });

test('Move to top on a Today card puts it first on Today', async () => {
  const today = new Date().toISOString().slice(0, 10);
  await run('add_tasks', { tasks: [
    { title: 'Book movers', impact: { consequence: 'money', magnitude: 3, reversible: false }, est_min: 3 },
    { title: 'Deposit cheques', impact: { consequence: 'money', magnitude: 2 }, est_min: 3 },
    { title: 'Cancel gym', impact: { consequence: 'money', magnitude: 1 }, est_min: 3 },
  ] });
  // Lock all three onto today's list (a fresh store locks the day before they exist).
  const { mutate } = await import('../lib/store.js');
  await run('get_queue', {});
  await run('set_day', { mode: 'normal' }); // a fresh store reads as a low day (one thing)
  await mutate(st => { st.meta.today.ids = st.tasks.map(t => t.id); });
  const q = await run('get_queue', {});
  const ids = q.today_tasks.map(t => t.title);
  assert.ok(ids.length >= 2, JSON.stringify(ids));
  const last = q.today_tasks.at(-1);
  await run('reorder', { id: last.id, direction: 'top' });
  const after = await run('get_queue', {});
  assert.equal(after.today_tasks[0].id, last.id, `${today} ${JSON.stringify(after.today_tasks.map(t => t.title))}`);
  assert.deepEqual(new Set(after.today_tasks.map(t => t.id)), new Set(q.today_tasks.map(t => t.id))); // same set, new order
});
