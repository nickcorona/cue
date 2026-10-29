import test from 'node:test';
import assert from 'node:assert/strict';
import { weekStats } from '../lib/metrics.js';

const TZ = 'America/Toronto';
const iso = (d, hm) => new Date(Date.parse(`${d}T${hm}:00-04:00`)).toISOString();

test('week numbers: tasks, active days, list finished, morning core, wake-to-first-thing, notification taps', () => {
  const s = {
    settings: { tz: TZ, wake: '07:30' }, meta: {}, habits: [],
    tasks: [
      { id: 'a', title: 'A', status: 'done', history: [{ done: iso('2026-10-26', '08:30') }] },
      { id: 'b', title: 'B', status: 'done', history: [{ done: iso('2026-10-27', '10:00') }] },
      { id: 'c', title: 'C', status: 'open', history: [] },
      { id: 'old', title: 'Old', status: 'done', history: [{ done: iso('2026-10-10', '10:00') }] },
    ],
    routines: [{ id: 'm', name: 'Morning routine', steps: [{ id: 'x', title: 'X', core: true }, { id: 'y', title: 'Y' }],
      log: { '2026-10-26': { ticks: { x: 'done' }, at: { x: iso('2026-10-26', '07:50') } } } }],
  };
  s.meta.days_log = [{ date: '2026-10-26', ids: ['a'] }, { date: '2026-10-27', ids: ['b', 'c'] }];
  s.meta.push_actions = [{ at: iso('2026-10-26', '08:00'), a: 'done' }, { at: iso('2026-10-27', '08:00'), a: 'skip' }, { at: iso('2026-10-01', '08:00'), a: 'done' }];
  const w = weekStats(s, '2026-10-30'); // Oct 23 to 29
  assert.equal(w.tasks_done, 2);
  assert.equal(w.days_with_anything_done, 2);
  assert.equal(w.todays_list_finished, '1 of 2 days');
  assert.equal(w.morning_routine_core_done, '1 of 7 days');
  assert.equal(w.minutes_from_wake_to_first_thing, 85); // median of 20 min (the 26th) and 150 (the 27th)
  assert.deepEqual(w.notification, { done: 1, not_now: 1 });
});

import { weekCard } from '../lib/metrics.js';
import { dayPlan, pingContent } from '../lib/push.js';

const weekState = () => ({
  settings: { tz: TZ, wake: '07:30' }, meta: {}, habits: [], routines: [],
  tasks: [
    { id: 'a', title: 'Send Rachel the LMR email', status: 'done', history: [{ done: iso('2026-10-26', '09:00') }] },
    { id: 'b', title: 'Thermostat to Heat', status: 'done', history: [{ done: iso('2026-10-29', '15:00') }] },
    { id: 'c', title: 'Find recruiters', status: 'done', history: [{ done: iso('2026-10-30', '10:00') }] },
    { id: 'p', title: 'Last week thing', status: 'done', history: [{ done: iso('2026-10-20', '10:00') }, { done: iso('2026-10-21', '10:00') }] },
  ],
});

test('week card: Sundays (and Monday morning) only; done list, trends against his own weeks, one suggestion', () => {
  const s = weekState();
  assert.equal(weekCard(s, Date.parse('2026-10-31T12:00:00-04:00')), null); // Saturday
  const w = weekCard(s, Date.parse('2026-11-01T10:00:00-05:00')); // Sunday (after the clocks change)
  assert.equal(w.week, '2026-10-26 to 2026-11-01');
  assert.deepEqual(w.done, ['Send Rachel the LMR email', 'Thermostat to Heat', 'Find recruiters']);
  assert.equal(w.trends[0].now, 3);
  assert.equal(w.trends[0].avg, 2); // the one earlier week with data
  assert.equal(w.first_week, false);
  assert.match(w.suggestion, /one small thing/); // 3 active days
  assert.ok(weekCard(s, Date.parse('2026-11-02T09:00:00-05:00'))); // Monday morning
  assert.equal(weekCard(s, Date.parse('2026-11-02T13:00:00-05:00')), null);
});

test('week card: the Sunday 10:00 notification', () => {
  const s = weekState();
  const sun = Date.parse('2026-11-01T06:00:00-05:00');
  assert.ok(dayPlan(s, sun).some(p => p.key === 'week:2026-11-01'));
  const c = pingContent(s, 'week:2026-11-01', Date.parse('2026-11-01T10:00:00-05:00'));
  assert.equal(c.title, 'Your week');
  assert.equal(c.url, '/?week=1');
  assert.ok(!dayPlan(s, Date.parse('2026-10-31T06:00:00-04:00')).some(p => p.key.startsWith('week:')));
});
