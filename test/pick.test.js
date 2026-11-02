// Cue Home's pick sheet: the open tasks in rank order, and picking one makes it Now.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-pick-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
process.env.APP_KEY = 'k';
const { callTool } = await import('../lib/tools.js');
const { default: push } = await import('../api/push.js');
const run = (name, args) => callTool(name, args, { idle: false });

async function call(action, body) {
  let code, out;
  const res = { setHeader() {}, status: c => { code = c; return res; }, json: j => { out = j; return res; } };
  await push({ method: 'POST', query: { key: 'k', action }, headers: {}, body }, res);
  assert.equal(code, 200, JSON.stringify(out));
  return out;
}

test('picking a task on Home pins it as Now, over an earlier pick and a Not now', async () => {
  const { added: [big, small, other] } = await run('add_tasks', { tasks: [
    { title: 'File the taxes', impact: { consequence: 'legal', magnitude: 3 }, est_min: 30 },
    { title: 'Water the plants', impact: { consequence: 'annoyance', magnitude: 1 }, est_min: 5 },
    { title: 'Buy socks', impact: { consequence: 'annoyance', magnitude: 1 }, est_min: 20 },
  ] });
  const { tasks } = await call('queue', {});
  assert.equal(tasks[0].id, big.id);
  assert.ok(tasks.every(t => t.title && t.est_min));

  await call('now_skip', { key: `task:${small.id}` });
  let out = await call('pin', { id: small.id });
  assert.equal(out.next.title, 'Water the plants');
  assert.equal(out.next.ctx, 'Picked');
  assert.ok(out.widget);

  out = await call('pin', { id: other.id });
  assert.equal(out.next.title, 'Buy socks');
  const after = (await call('queue', {})).tasks;
  assert.deepEqual(after.filter(t => t.pinned).map(t => t.id), [other.id]);
});
