import test from 'node:test';
import assert from 'node:assert/strict';
import { nowItem, dayPlan, pingContent } from '../lib/push.js';

const TZ = 'America/Toronto';
const at = hm => Date.parse(`2026-10-29T${hm}:00-04:00`); // Thu in Toronto (EDT)
const step = (id, title, extra = {}) => ({ id, title, ...extra });
const base = () => ({
  settings: { tz: TZ, wake: '07:00', default_est_min: 15, capacity_min_per_day: 120, capacity_weekend_min: 240, urgency_hard: 4, urgency_soft: 1, bedtime: { time: '23:00' } },
  meta: {}, estimates: [], goals: [],
  routines: [
    { id: 'r_m', name: 'Morning routine', time: '08:00', steps: [step('a', 'Eye drops', { core: true }), step('b', 'Make bed'), step('c', 'Contacts in', { core: true, not_before: { after_step: 'a', min: 10 } }), step('d', 'Coffee')] },
    { id: 'r_n', name: 'Night routine', time: '22:00', steps: [step('n1', 'Contacts out', { core: true })] },
  ],
  habits: [
    { id: 'h_any', name: 'Drink water', cue: 'sit down', behavior: 'drink a glass' },
    { id: 'h_eve', name: 'Dog park', time: '17:30' },
  ],
  tasks: [{ id: 't1', title: 'Order the new card', status: 'open', who: 'me', est_min: 5, impact: { consequence: 'money', magnitude: 2 }, project: 'Money' }],
});

test('nothing before wake', () => {
  assert.equal(nowItem(base(), at('06:30')), null);
});

test('before the routine starts, an anytime habit comes up', () => {
  assert.equal(nowItem(base(), at('07:30')).key, 'habit:h_any');
});

test('once the routine time passes it walks core steps first', () => {
  const it = nowItem(base(), at('08:05'));
  assert.equal(it.key, 'step:r_m:a');
  assert.equal(it.body, 'Morning routine · 1 of 2');
  assert.equal(it.icon, '/ring.png?d=0&n=2');
  assert.deepEqual(it.check, { kind: 'routine_step', id: 'r_m', step_id: 'a', date: '2026-10-29' });
});

test('a gated core step is filled with a ready non-core step', () => {
  const s = base();
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done' }, at: { a: new Date(at('08:05')).toISOString() } } };
  const it = nowItem(s, at('08:08'));
  assert.equal(it.key, 'step:r_m:b');
  assert.equal(it.body, 'Morning routine · while you wait\nContacts in at 08:15');
  assert.equal(nowItem(s, at('08:16')).key, 'step:r_m:c');
});

test('core done moves on to habits, then the top task', () => {
  const s = base();
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done', c: 'done' } } };
  assert.equal(nowItem(s, at('09:00')).key, 'habit:h_any');
  s.habits[0].log = { '2026-10-29': { done: true } };
  const it = nowItem(s, at('09:00'));
  assert.equal(it.key, 'task:t1');
  assert.deepEqual(it.check, { kind: 'task', id: 't1' });
});

test('Not now hides an item for today only', () => {
  const s = base();
  s.push = { now_skip: { date: '2026-10-29', keys: ['step:r_m:a', 'step:r_m:c'] } };
  assert.equal(nowItem(s, at('08:05')).key, 'habit:h_any');
  s.push.now_skip.date = '2026-10-28';
  assert.equal(nowItem(s, at('08:05')).key, 'step:r_m:a');
});

test('from wind-down only the night routine, then nothing', () => {
  const s = base();
  assert.equal(nowItem(s, at('22:10')).key, 'step:r_n:n1');
  s.routines[1].log = { '2026-10-29': { ticks: { n1: 'done' } } };
  assert.equal(nowItem(s, at('22:10')), null);
});

test('dayPlan buzzes at wake and each set time, and drops the old time and nudge pings', () => {
  const keys = dayPlan(base(), at('05:00')).map(p => p.key);
  for (const k of ['now:2026-10-29:0700', 'now:2026-10-29:0800', 'now:2026-10-29:1730', 'now:2026-10-29:2200']) assert.ok(keys.includes(k), k);
  assert.ok(!keys.some(k => k.startsWith('dmt:') || k.startsWith('time:')));
});

test('a quiet refresh is skipped when it would show what is already showing', () => {
  const s = base();
  s.push = { now_last: 'step:r_m:a' };
  assert.equal(pingContent(s, 'now:2026-10-29:r1', at('08:05')), null);
  const loud = pingContent(s, 'now:2026-10-29:0800', at('08:05'));
  assert.equal(loud.title, 'Eye drops');
  assert.equal(loud.renotify, true);
  assert.equal(loud.tag, 'cue-now');
});

test('turning Now off brings the old pings back', () => {
  const s = base();
  s.settings.push = { now: false };
  assert.ok(dayPlan(s, at('05:00')).some(p => p.key.startsWith('dmt:')));
  assert.equal(pingContent(s, 'now:2026-10-29:0800', at('08:05')), null);
});

test('step notes and task notes go on a second line, cut at a word', () => {
  const s = base();
  s.routines[0].steps[0].est_min = 1;
  s.routines[0].steps[0].notes = 'Not contact-safe, so these go in first. Lenses no sooner than 10-15 min later: everything up to and including the coffee fills the gap.';
  const [first, second] = nowItem(s, at('08:05')).body.split('\n');
  assert.equal(first, 'Morning routine · 1 of 2 · 1 min');
  assert.ok(second.length <= 111 && second.endsWith('…'));
});

test('a long title splits at its colon so a one-line title still reads', () => {
  const s = base();
  s.routines[0].steps[0].title = 'Sunscreen: Anthelios, 3 finger-lengths face + neck';
  const c = pingContent(s, 'now:2026-10-29:0800', at('08:05'));
  assert.equal(c.title, 'Sunscreen');
  assert.equal(c.body.split('\n')[0], 'Anthelios, 3 finger-lengths face + neck');
});

test('a long title with no colon is repeated in full in the body', () => {
  const s = base();
  s.routines[0].steps[0].title = 'Unload the clean dishes and clear the drying rack';
  const c = pingContent(s, 'now:2026-10-29:0800', at('08:05'));
  assert.equal(c.title, 'Unload the clean dishes and clear the drying rack');
  assert.equal(c.body.split('\n')[0], 'Unload the clean dishes and clear the drying rack');
});
