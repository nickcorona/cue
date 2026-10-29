import test from 'node:test';
import assert from 'node:assert/strict';
import { nowItem, dayPlan, pingContent, idleCheck, lastActive } from '../lib/push.js';

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
  assert.equal(it.ctx, 'Morning routine · 1/2');
  assert.equal(it.body, '');
  assert.equal(it.icon, '/ring.png?v=2&d=0&n=2');
  assert.deepEqual(it.check, { kind: 'routine_step', id: 'r_m', step_id: 'a', date: '2026-10-29' });
});

test('a gated core step is filled with a ready non-core step', () => {
  const s = base();
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done' }, at: { a: new Date(at('08:05')).toISOString() } } };
  const it = nowItem(s, at('08:08'));
  assert.equal(it.key, 'step:r_m:b');
  assert.equal(it.ctx, 'Morning routine · while you wait');
  assert.equal(it.body, 'Contacts in at 08:15');
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
  assert.equal(loud.title, 'Morning routine · 1/2');
  assert.equal(loud.body, 'Eye drops');
  assert.equal(loud.renotify, true);
  assert.equal(loud.tag, 'cue-now');
});

test('turning Now off brings the old pings back', () => {
  const s = base();
  s.settings.push = { now: false };
  assert.ok(dayPlan(s, at('05:00')).some(p => p.key.startsWith('dmt:')));
  assert.equal(pingContent(s, 'now:2026-10-29:0800', at('08:05')), null);
});

test('routine steps leave their notes out; task notes go on a second line, cut at a word', () => {
  const s = base();
  s.routines[0].steps[0].est_min = 1;
  s.routines[0].steps[0].notes = 'Not contact-safe, so these go in first.';
  assert.equal(nowItem(s, at('08:05')).body, '1 min');
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done', c: 'done' } } };
  s.habits[0].log = { '2026-10-29': { done: true } };
  s.tasks[0].notes = 'Banner in the Wealthsimple chequing screen: "Get your new card". Order early so it arrives before Nov 28 and update subscriptions.';
  const [, second] = nowItem(s, at('09:00')).body.split('\n');
  assert.ok(second.length <= 111 && second.endsWith('…'));
});

test('the action leads the full-width body; the title is short context; rings show progress', () => {
  const s = base();
  s.routines[0].steps[0].title = 'Sunscreen: Anthelios, 3 finger-lengths face + neck';
  const c = pingContent(s, 'now:2026-10-29:0800', at('08:05'));
  assert.equal(c.title, 'Morning routine · 1/2');
  assert.equal(c.body.split('\n')[0], 'Sunscreen: Anthelios, 3 finger-lengths face + neck');
  assert.equal(c.icon, '/ring.png?v=2&d=0&n=2');
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done', c: 'done' } } };
  const h = pingContent(s, 'now:2026-10-29:0900', at('09:00'));
  assert.equal(h.title, 'Habit · 1/2');
  assert.equal(h.icon, '/ring.png?v=2&d=0&n=2');
  s.habits[0].log = { '2026-10-29': { done: true } };
  s.tasks.push({ id: 't0', title: 'x', status: 'done', history: [{ done: new Date(at('08:30')).toISOString() }] });
  const t = pingContent(s, 'now:2026-10-29:0900', at('09:00'));
  assert.equal(t.title, 'Money · 2/3 today');
  assert.equal(t.body.split('\n')[0], 'Order the new card');
  assert.equal(t.icon, '/ring.png?v=2&d=1&n=3');
});

test('a long task offers Start 25 min instead of Done; a short one keeps Done', () => {
  const s = base();
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done', c: 'done' } } };
  s.habits[0].log = { '2026-10-29': { done: true } };
  s.tasks[0].est_min = 30;
  const c = pingContent(s, 'now:2026-10-29:0900', at('09:00'));
  assert.deepEqual(c.start, { task_id: 't1' });
  assert.equal(c.check, undefined);
  assert.equal(c.skip, 'task:t1');
  s.tasks[0].est_min = 5;
  const d = pingContent(s, 'now:2026-10-29:0900', at('09:00'));
  assert.deepEqual(d.check, { kind: 'task', id: 't1' });
  assert.equal(d.start, undefined);
});

test('a running focus block holds the notification with only Done', () => {
  const s = base();
  s.focus = { sessions: [{ id: 'f1', task_id: 't1', title: 'Order the new card', planned_min: 25, started: new Date(at('09:00')).toISOString(), paused_ms: 0 }] };
  const c = pingContent(s, 'now:2026-10-29:0905', at('09:05'));
  assert.equal(c.title, 'Focus · until 09:25');
  assert.equal(c.body, 'Order the new card');
  assert.equal(c.icon, '/ring.png?v=2&d=5&n=25');
  assert.deepEqual(c.check, { kind: 'focus', id: 'f1' });
  assert.equal(c.skip, null);
  assert.match(nowItem(s, at('09:30')).ctx, /time's up/);
  s.focus.sessions[0].ended = new Date(at('09:30')).toISOString();
  assert.notEqual(nowItem(s, at('09:31')).key, 'focus:f1');
});

test('idle nudge: an hour of nothing in personal hours re-buzzes Now as stand up, twice at most', () => {
  const s = base();
  s.settings.personal_hours = { weekday: { start: '17:00', end: '23:00' }, weekend: { start: '08:00', end: '23:00' } };
  s.routines[0].log = { '2026-10-29': { ticks: { a: 'done', c: 'done' }, at: { c: new Date(at('17:00')).toISOString() } } };
  assert.equal(lastActive(s), at('17:00'));
  assert.equal(idleCheck(s, at('17:30'), 1), null); // only 30 min
  const c = idleCheck(s, at('18:00'), 1);
  assert.equal(c.title, 'Stand up first');
  assert.match(c.body, /^Dog park\n/); // timed habit past its time comes first
  assert.equal(c.renotify, true);
  assert.deepEqual(c.followup, { key: `idle:2026-10-29:${at('18:00')}:2`, at: at('19:00') });
  assert.equal(idleCheck(s, at('19:00'), 2).followup, undefined); // the last one
  assert.equal(idleCheck(s, at('16:30'), 1), null); // work hours
  s.settings.push = { idle: false };
  assert.equal(idleCheck(s, at('18:00'), 1), null);
});

test('idle nudge: newer activity or a focus block cancels it, and dayPlan arms the first one', () => {
  const s = base();
  s.settings.personal_hours = { weekday: { start: '17:00', end: '23:00' } };
  s.mood = { entries: [{ at: new Date(at('17:45')).toISOString(), mood: 5 }] };
  assert.equal(idleCheck(s, at('18:00'), 1), null);
  s.mood.entries = [];
  s.focus = { sessions: [{ id: 'f1', title: 'x', planned_min: 25, started: new Date(at('16:00')).toISOString(), paused_ms: 0 }] };
  assert.equal(idleCheck(s, at('18:00'), 1), null);
  const t = base(); t.settings.personal_hours = { weekday: { start: '17:00', end: '23:00' } };
  assert.ok(dayPlan(t, at('05:00')).some(p => p.key === `idle:2026-10-29:${at('18:00')}:1` && p.at === at('18:00')));
});

test('a metric step is scored from the app: no Done, tap opens the picker; off days say so', () => {
  const s = base();
  s.routines[0].steps[0].metric = { name: 'puffiness', lower_better: true, trial: { start: '2026-10-15', block_days: 7 } }; // Oct 29 is in an on block
  let it = nowItem(s, at('08:05'));
  assert.equal(it.check, undefined);
  assert.equal(it.url, '/?score=r_m:a');
  assert.equal(it.ctx, 'Morning routine');
  assert.equal(it.body, 'Then score puffiness');
  s.routines[0].steps[0].metric.trial.start = '2026-10-22'; // now block 1: off
  it = nowItem(s, at('08:05'));
  assert.equal(it.title, 'Score puffiness');
  assert.equal(it.body, "Off day for Eye drops: don't apply");
});
