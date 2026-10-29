import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTasks, placeOf } from '../lib/logic.js';
import { todayView } from '../lib/today.js';

const TZ = 'America/Toronto';
const at = hm => Date.parse(`2026-10-29T${hm}:00-04:00`);
// Same impact for all; a shorter estimate scores higher (value per hour), so est sets the order.
const task = (id, est, context, extra = {}) => ({ id, title: id, status: 'open', who: 'me', est_min: est, context, impact: { consequence: 'money', magnitude: 2 }, ...extra });
const base = tasks => ({ settings: { tz: TZ, default_est_min: 15, capacity_min_per_day: 120, capacity_weekend_min: 300, urgency_hard: 4, urgency_soft: 1 }, meta: {}, estimates: [], goals: [], routines: [], habits: [], tasks });
const order = (s, now) => rankTasks(s, now).scored.map(x => x.t.id);

test('placeOf maps contexts to four places and ignores topics', () => {
  assert.equal(placeOf('errands'), 'out');
  assert.equal(placeOf('Work'), 'computer');
  assert.equal(placeOf('move'), null);
  assert.equal(placeOf(undefined), null);
});

test('right after a computer task, close computer tasks jump the queue (two at most)', () => {
  const s = base([task('home1', 10, 'home'), task('pc1', 12, 'computer'), task('home2', 12, 'home'), task('pc2', 14, 'computer'), task('pc3', 15, 'computer'), task('pcFar', 60, 'computer')]);
  assert.deepEqual(order(s, at('10:00')).slice(0, 3), ['home1', 'pc1', 'home2']);
  s.meta.last_context = 'computer'; s.meta.last_context_at = new Date(at('09:50')).toISOString();
  const o = order(s, at('10:00'));
  assert.deepEqual(o.slice(0, 3), ['pc1', 'pc2', 'home1']); // two pulled, then the rest in order
  assert.ok(o.indexOf('pcFar') > o.indexOf('home2')); // too far below to pull
});

test('batching fades after 45 minutes, follows aliases, and never moves a pinned task', () => {
  const s = base([task('home1', 10, 'home'), task('pc1', 12, 'computer')]);
  s.meta.last_context = 'work'; s.meta.last_context_at = new Date(at('09:00')).toISOString();
  assert.equal(order(s, at('10:00'))[0], 'home1'); // an hour later: no pull
  assert.equal(order(s, at('09:30'))[0], 'pc1'); // "work" counts as computer
  s.tasks[0].pin = '2026-10-29';
  assert.equal(order(s, at('09:30'))[0], 'home1');
});

test('today\'s list is grouped by place in order of each place\'s best task', () => {
  const s = base([task('pc1', 10, 'computer'), task('home1', 11, 'home'), task('pc2', 12, 'computer'), task('home2', 13, 'home')]);
  s.meta.today = { date: '2026-10-29', ids: ['pc1', 'home1', 'pc2', 'home2'], budget_min: 60, mode: 'normal' };
  assert.deepEqual(todayView(s, at('09:00')).show, ['pc1', 'pc2', 'home1', 'home2']);
});
