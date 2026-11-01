// Undo puts a check-off back exactly: a repeating task returns to the day it was due instead
// of staying rolled forward (which made Undo look like it did nothing).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-undo-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const { callTool } = await import('../lib/tools.js');
const run = (name, args) => callTool(name, args, { idle: false });

test('undoing a repeating task puts its due date back', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Shoulder posture routine', impact: { consequence: 'health', magnitude: 2 }, est_min: 10, due: '2026-10-30T19:00', repeat: { every: 1, unit: 'day' } }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  const rolled = (await run('find', { query: 'Shoulder posture', status: 'any' })).tasks[0];
  assert.notEqual(rolled.due, '2026-10-30T19:00');
  assert.equal((await run('get_queue', {})).last_done.id, t.id);

  await run('check_off', { items: [{ kind: 'task', id: t.id, undo: true }] });
  const back = (await run('find', { query: 'Shoulder posture', status: 'any' })).tasks[0];
  assert.equal(back.due, '2026-10-30T19:00');
  assert.equal(back.status, 'open');
  assert.equal((await run('get_queue', {})).last_done, undefined);
});

test('undoing a one-off task reopens it', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Order cheques', impact: { consequence: 'money', magnitude: 1 }, est_min: 10 }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  await run('check_off', { items: [{ kind: 'task', id: t.id, undo: true }] });
  assert.equal((await run('find', { query: 'Order cheques', status: 'any' })).tasks[0].status, 'open');
});
