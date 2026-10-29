// Quick capture: the model's tool calls become tasks or list items through the same handlers
// Claude uses, and anything that goes wrong lands the raw text in the inbox, out of the ranking.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-capture-')), 'db.json');
delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
const { capture } = await import('../lib/capture.js');
const { callTool } = await import('../lib/tools.js');

const fake = content => {
  const seen = [];
  return { seen, messages: { create: async req => { seen.push(req); if (content instanceof Error) throw content; return { content, stop_reason: 'tool_use' }; } } };
};
const use = (name, input) => ({ type: 'tool_use', id: 'x', name, input });

test('enriched capture adds a tagged, ranked task', async () => {
  const client = fake([use('add_tasks', { tasks: [{ title: 'Renew parking permit', impact: { consequence: 'money', magnitude: 1 }, est_min: 10, project: 'Money & admin', family: 'parking permit', context: 'computer' }] })]);
  const out = await capture('  renew parking   permit before nov ', { client });
  assert.equal(out.inbox, undefined);
  assert.equal(out.added[0].title, 'Renew parking permit');
  assert.equal(out.added[0].est_min, 10);
  const req = client.seen[0];
  assert.deepEqual(req.tools.map(t => t.name).sort(), ['add_tasks', 'add_to_list']);
  assert.match(req.messages[0].content, /Capture: renew parking permit before nov$/);
  assert.match(req.messages[0].content, /Money & admin \(4\)/);
  const q = await callTool('get_queue', {}, { idle: false });
  assert.ok(q.tasks.some(t => t.title === 'Renew parking permit'));
  assert.equal(q.inbox, undefined);
});

test('purchases go on a shopping list', async () => {
  const client = fake([use('add_to_list', { list: 'No Frills', items: [{ title: 'Eggs' }] })]);
  const out = await capture('need eggs', { client });
  assert.deepEqual(out.listed, [{ list: 'No Frills', items: ['Eggs'] }]);
  assert.deepEqual(out.added, []);
});

test('a failed call or no tool call saves the raw text to the inbox, unranked', async () => {
  const a = await capture('call mom re thanksgiving', { client: fake(new Error('overloaded')) });
  const b = await capture('x'.repeat(100), { client: fake([{ type: 'text', text: 'hmm' }]) });
  assert.equal(a.inbox, true);
  assert.equal(b.inbox, true);
  assert.equal(b.added[0].title.length, 78);
  const q = await callTool('get_queue', {}, { idle: false });
  assert.deepEqual(q.inbox.map(t => t.title), ['call mom re thanksgiving', b.added[0].title]);
  assert.equal(q.inbox[1].notes, 'x'.repeat(100));
  assert.ok(!q.tasks.some(t => t.title === 'call mom re thanksgiving'));
  assert.equal(q.hidden.blocked, 0);
  assert.match(q.for_claude[0], /2 quick captures are in the inbox/);
  // Filing it (setting impact) moves it into the ranking.
  await callTool('update_tasks', { updates: [{ id: a.added[0].id, title: 'Email mom: Thanksgiving', impact: { consequence: 'annoyance', magnitude: 1 }, est_min: 5 }] }, { idle: false });
  const q2 = await callTool('get_queue', {}, { idle: false });
  assert.equal(q2.inbox.length, 1);
  assert.ok(q2.tasks.some(t => t.title === 'Email mom: Thanksgiving'));
});

test('no API key and no client goes straight to the inbox', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await capture('book dentist');
  assert.equal(out.inbox, true);
  await assert.rejects(capture('   '), /Nothing to capture/);
});
