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
