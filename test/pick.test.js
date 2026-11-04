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

test('a habit due today can be picked too, and goes first before its time', async () => {
  const { created: id } = await run('save_habit', { name: 'Evening dog park', cue: 'finish work', behavior: 'take the dog to the park', time: '23:59' });
  const { tasks } = await call('queue', {});
  const row = tasks.find(t => t.id === id);
  assert.equal(row.kind, 'habit');
  const out = await call('pin', { id, kind: 'habit' });
  assert.equal(out.next.title, 'Evening dog park');
  assert.equal(out.next.ctx, 'Picked');
  assert.ok((await call('queue', {})).tasks.find(t => t.id === id).pinned);
});

test('a habit on its off day can be searched for and picked', async () => {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Toronto' }));
  const { created: id } = await run('save_habit', { name: 'Upper body lift: push', cue: 'get the ping', behavior: 'lift', time: '14:30', days: [(dow + 1) % 7] });
  const { tasks } = await call('queue', {});
  assert.equal(tasks.at(-1).id, id);
  const out = await call('pin', { id, kind: 'habit' });
  assert.equal(out.next.title, 'Upper body lift: push');
  assert.equal(out.next.ctx, 'Picked');
  await run('lift_program', { habit_id: id, name: 'Push', exercises: [{ name: 'Bench press', kind: 'weight', sets: 4 }] });
  const { nowItem } = await import('../lib/push.js');
  const { read } = await import('../lib/store.js');
  assert.equal(nowItem(await read()).url, `/lift?start=${id}`);
  const after = (await call('queue', {})).tasks;
  assert.ok(after.findIndex(t => t.id === id) < after.findIndex(t => t.kind !== 'habit'));
});

test('a Move to top replaces a picked habit, and on its own does not hold habits back', async () => {
  const { nowItem } = await import('../lib/push.js');
  const { read } = await import('../lib/store.js');
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Call the bank', impact: { consequence: 'money', magnitude: 2 }, est_min: 10 }] });
  await run('reorder', { id: t.id, direction: 'top' });
  assert.equal(nowItem(await read()).title, 'Call the bank');
  await run('save_habit', { name: 'Stretch', cue: 'wake up', behavior: 'stretch', time: '00:00' });
  assert.equal(nowItem(await read()).title, 'Stretch');
  await call('pin', { id: t.id });
  assert.equal(nowItem(await read()).title, 'Call the bank');
});

test('a picked daily task ticked done goes away for the day instead of coming straight back', async () => {
  const { added: [t] } = await run('add_tasks', { tasks: [{ title: 'Doorway stretch', impact: { consequence: 'health', magnitude: 2 }, est_min: 1, due: '2020-01-01T19:00', repeat: { every: 1, unit: 'day' } }] });
  assert.equal((await call('pin', { id: t.id })).next.title, 'Doorway stretch');
  await run('check_off', { items: [{ kind: 'task', id: t.id }] });
  const { nowItem } = await import('../lib/push.js');
  const { read } = await import('../lib/store.js');
  assert.notEqual(nowItem(await read())?.title, 'Doorway stretch');
});

test('a store list can be picked and walked through on Now, one item per Done', async () => {
  const { list } = await run('add_to_list', { list: 'No Frills', items: [{ title: 'Eggs' }, { title: 'Greek yogurt', note: 'cups' }] });
  const q = await call('queue', {});
  const row = q.tasks.find(t => t.kind === 'list');
  assert.equal(row.title, 'No Frills: 2 items');
  assert.match(row.project, /nofrills/); // "nofr" finds it on the phone
  const first = (await call('pin', { id: row.id, kind: 'list' })).next;
  assert.equal(first.title, 'Eggs');
  assert.equal(first.ctx, 'No Frills · 2 left');
  const second = (await call('check', { ...first.check, now: true })).next;
  assert.equal(second.title, 'Greek yogurt');
  const after = (await call('check', { ...second.check, now: true })).next;
  assert.notEqual(after?.ctx || '', 'No Frills · 1 left');
  assert.equal((await call('queue', {})).tasks.some(t => t.kind === 'list' && t.id === list.id), false);
});
