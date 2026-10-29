import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, planDay, ensureToday, todayView, lowDay, LOW_BY } from '../lib/today.js';
import { nowItem } from '../lib/push.js';

const TZ = 'America/Toronto';
const at = (d, hm) => Date.parse(`${d}T${hm}:00-04:00`);
const iso = (d, hm) => new Date(at(d, hm)).toISOString();
const task = (id, est, extra = {}) => ({ id, title: `Task ${id}`, status: 'open', who: 'me', est_min: est, impact: { consequence: 'money', magnitude: 2 }, ...extra });
const base = () => ({
  settings: { tz: TZ, wake: '07:00', default_est_min: 15, capacity_min_per_day: 120, capacity_weekend_min: 300, urgency_hard: 4, urgency_soft: 1 },
  meta: {}, estimates: [], goals: [], routines: [], habits: [],
  tasks: [task('a', 20), task('b', 20), task('c', 20), task('d', 20), task('e', 20), task('f', 20), task('g', 20)],
});

test('the budget follows the last week of finished work, not capacity', () => {
  const s = base();
  assert.equal(budgetFor(s, '2026-10-29', 1), 15); // nothing done lately: the floor
  // 7 tasks x 30 min in the last week = 30 min/day, x1.1 stretch, rounded to 5
  for (let i = 2; i <= 8; i++) s.tasks.push(task(`h${i}`, 30, { status: 'done', history: [{ done: iso(`2026-10-2${i}`, '12:00') }] }));
  assert.equal(budgetFor(s, '2026-10-29', 1), 35);
  s.tasks.push(task('old', 600, { status: 'done', history: [{ done: iso('2026-10-01', '12:00') }] }));
  assert.equal(budgetFor(s, '2026-10-29', 1), 35); // older than a week: ignored
});

test('planDay fills the budget from the top of the ranking, at least one, at most five', () => {
  const s = base();
  const p = planDay(s, at('2026-10-29', '08:00'));
  assert.equal(p.budget_min, 15);
  assert.equal(p.ids.length, 1);
  s.settings.capacity_min_per_day = 10000;
  for (let i = 1; i <= 7; i++) s.tasks.push(task(`h${i}`, 600, { status: 'done', history: [{ done: iso(`2026-10-2${i}`, '12:00') }] }));
  assert.equal(planDay(s, at('2026-10-29', '08:00')).ids.length, 5);
});

test('the locked list holds through the day; done items count, deferred ones leave', () => {
  const s = base();
  s.meta.today = { date: '2026-10-29', ids: ['a', 'b', 'c'], budget_min: 60, mode: null };
  ensureToday(s, at('2026-10-29', '09:00'));
  assert.deepEqual(s.meta.today.ids, ['a', 'b', 'c']); // not re-planned the same day
  s.tasks[0].status = 'done'; s.tasks[0].history = [{ done: iso('2026-10-29', '09:30') }];
  s.tasks[1].start = '2026-11-05'; // deferred
  const v = todayView(s, at('2026-10-29', '10:00'));
  assert.deepEqual([v.done, v.total, v.show], [1, 2, ['c']]);
  assert.equal(v.complete, false);
  s.tasks[2].status = 'done'; s.tasks[2].history = [{ done: iso('2026-10-29', '10:30') }];
  assert.equal(todayView(s, at('2026-10-29', '11:00')).complete, true);
  ensureToday(s, at('2026-10-30', '08:00'));
  assert.equal(s.meta.today.date, '2026-10-30'); // a new day gets a new list
});

test('low day: said, a low mood, or nothing done by 11; the latest mood wins; normal overrides', () => {
  const s = base();
  assert.equal(lowDay(s, at('2026-10-29', '10:30')), null);
  assert.equal(lowDay(s, at('2026-10-29', LOW_BY)), `nothing done by ${LOW_BY}`);
  s.habits = [{ id: 'h', log: { '2026-10-29': { done: true } } }];
  assert.equal(lowDay(s, at('2026-10-29', '12:00')), null);
  s.mood = { entries: [{ at: iso('2026-10-29', '08:00'), mood: 3 }] };
  assert.equal(lowDay(s, at('2026-10-29', '09:00')), 'mood 3/10');
  s.mood.entries.push({ at: iso('2026-10-29', '13:00'), mood: 6 });
  assert.equal(lowDay(s, at('2026-10-29', '14:00')), null);
  assert.equal(lowDay(s, at('2026-10-29', '14:00'), 'low'), 'you said so');
  s.mood.entries = [{ at: iso('2026-10-29', '08:00'), mood: 2 }];
  assert.equal(lowDay(s, at('2026-10-29', '09:00'), 'normal'), null);
});

test('a low day is one thing, the quickest on the list, and doing it completes the day', () => {
  const s = base();
  s.tasks[1].est_min = 5;
  s.meta.today = { date: '2026-10-29', ids: ['a', 'b', 'c'], budget_min: 60, mode: 'low' };
  let v = todayView(s, at('2026-10-29', '09:00'));
  assert.deepEqual([v.mode, v.show, v.total], ['low', ['b'], 1]);
  s.tasks[1].status = 'done'; s.tasks[1].history = [{ done: iso('2026-10-29', '09:30') }];
  v = todayView(s, at('2026-10-29', '10:00'));
  assert.equal(v.complete, true);
  assert.deepEqual(v.show, []);
});

test('the notification: today\'s list first, a hard deadline due today breaks in, then bonus', () => {
  const s = base();
  s.meta.today = { date: '2026-10-29', ids: ['c'], budget_min: 15, mode: null };
  let it = nowItem(s, at('2026-10-29', '09:00'));
  assert.equal(it.key, 'task:c');
  assert.equal(it.ctx, 'Today · 1/1');
  s.tasks[5].hard = true; s.tasks[5].due = '2026-10-29';
  it = nowItem(s, at('2026-10-29', '09:00'));
  assert.equal(it.key, 'task:f');
  assert.equal(it.ctx, 'Due today');
  s.tasks[5].status = 'done';
  s.tasks[2].status = 'done'; s.tasks[2].history = [{ done: iso('2026-10-29', '09:30') }];
  it = nowItem(s, at('2026-10-29', '10:00'));
  assert.match(it.ctx, /^Bonus · /);
  s.meta.today.mode = 'low'; s.tasks[2].status = 'open'; s.tasks[2].history = [];
  assert.equal(nowItem(s, at('2026-10-29', '10:00')).ctx, 'Low day · just this one');
});

test('on a low day anything finished today counts, even off the list', () => {
  const s = base();
  s.meta.today = { date: '2026-10-29', ids: ['a'], budget_min: 15, mode: 'low' };
  s.tasks.push(task('x', 5, { status: 'done', history: [{ done: iso('2026-10-29', '09:00') }] }));
  const v = todayView(s, at('2026-10-29', '15:00'));
  assert.deepEqual([v.done, v.total, v.complete, v.show], [1, 1, true, []]);
});
