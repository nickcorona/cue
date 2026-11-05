// Good days: one rating a night, the facts filled in, and a shrunk regression of the rating on them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitDays, features, people, socialNudges, plainTags, MIN_DAYS } from '../lib/days.js';
import { addDays } from '../lib/logic.js';

const base = () => ({ settings: { tz: 'America/Toronto' }, tasks: [], habits: [], routines: [], days: {} });
const NOW = Date.parse('2026-11-05T22:00:00-05:00');

test('no effects before enough rated days', () => {
  const s = base();
  for (let i = 0; i < MIN_DAYS - 1; i++) s.days[addDays('2026-11-05', -i)] = { rating: 5 };
  const f = fitDays(s, NOW);
  assert.equal(f.effects.length, 0);
  assert.equal(f.need, 1);
});

test('a real effect shows up and a noise one stays near zero', () => {
  const s = base();
  // 40 days: social days run +2, "alcohol" is unrelated noise.
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    const social = i % 3 === 0, alcohol = rnd() < 0.4;
    s.days[addDays('2026-11-05', -i)] = { rating: Math.max(0, Math.min(10, Math.round(4 + (social ? 2 : 0) + (rnd() - 0.5) * 2))), tags: { social, alcohol, people: social ? ['Karam'] : [] } };
  }
  const f = fitDays(s, NOW);
  const soc = f.effects.find(e => e.feature === 'social'), alc = f.effects.find(e => e.feature === 'alcohol');
  assert.ok(soc.effect > 1.3 && soc.sure > 0.95, JSON.stringify(soc));
  assert.ok(Math.abs(alc.effect) < 0.8, JSON.stringify(alc));
  assert.equal(f.effects[0].feature, 'social');
});

test('features read check-offs and words, and yesterday for the lag', () => {
  const s = base();
  s.habits = [{ id: 'h1', name: 'Upper body lift: push', log: { '2026-11-05': { done: true } } }];
  s.days['2026-11-04'] = { tags: { social: true } };
  s.days['2026-11-05'] = { events: ['18:00 Dog park with Rex'] };
  const f = features(s, '2026-11-05');
  assert.equal(f.exercise, 1);
  assert.equal(f.outdoors, 1);
  assert.equal(f.prev_social, 1);
  assert.equal(f.social, 0);
});

test('people and nudges: friends not seen in a while, when the week is light', () => {
  const s = base();
  s.days['2026-10-10'] = { tags: { social: true, people: ['Karam'] } };
  s.days['2026-10-20'] = { tags: { social: true, people: ['Akmar', 'karam'] } };
  s.days['2026-11-03'] = { tags: { social: true, people: ['Sam'] } }; // seen this week: not nudged
  const p = people(s, NOW);
  assert.equal(p.find(x => x.name === 'Karam').days, 2);
  assert.equal(p.find(x => x.name === 'Karam').last, '2026-10-20');
  const n = socialNudges(s, NOW);
  assert.equal(n.light, true);
  assert.deepEqual(n.people.map(x => x.name).sort(), ['Akmar', 'Karam']);
});

test('without a model the note is still tagged from words', () => {
  const t = plainTags({ note: 'drinks with friends after the gym', events: [], done: [] });
  assert.equal(t.social, true); assert.equal(t.alcohol, true); assert.equal(t.exercise, true);
});

test('rate_day saves the day with tags, and good_days reports it', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  process.env.LOCAL_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-days-')), 'db.json');
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID; delete process.env.ANTHROPIC_API_KEY; delete process.env.CALENDAR_ICS_URL;
  const { callTool } = await import('../lib/tools.js');
  const run = (n, a) => callTool(n, a, { idle: false });
  const r = await run('rate_day', { rating: 7, note: 'dinner with friends, then a walk', date: '2026-11-05' });
  assert.equal(r.rating, 7);
  assert.equal(r.tags.social, true);
  assert.equal(r.tags.outdoors, true);
  await run('rate_day', { note: 'and the gym', add: true, date: '2026-11-05' }); // a note alone, with add, adds to the day
  const g = await run('good_days', {});
  assert.ok(g.model.need > 0);
  await assert.rejects(run('rate_day', { rating: 11 }), /0 to 10/);
  await assert.rejects(run('rate_day', {}), /rating .* or a note/);
  await assert.rejects(run('rate_day', { rating: 5, date: 'yesterday' }), /YYYY-MM-DD/);
  // Changing the rating with the note sent back whole doesn't double it.
  await run('rate_day', { rating: 8, note: 'dinner with friends, then a walk; and the gym', date: '2026-11-05' });
  const { read } = await import('../lib/store.js');
  const d = (await read()).days['2026-11-05'];
  assert.equal(d.rating, 8);
  assert.equal(d.note, 'dinner with friends, then a walk; and the gym');
});
