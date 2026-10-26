import test from 'node:test';
import assert from 'node:assert/strict';
import { insights, dailyMeans, validMood, snapMoodFamily, resolveLink, recentFamilies, MIN_ENTRIES } from '../lib/mood.js';

const NOW = Date.parse('2026-10-26T16:00:00Z'); // 12:00 in Toronto
const ago = h => new Date(NOW - h * 3600e3).toISOString();
const e = (mood, family, h = 1) => ({ id: `m${Math.random()}`, at: ago(h), mood, activity: family, family });

test('baseline is the mean of every entry in the window', () => {
  const r = insights([e(2, 'a'), e(4, 'a'), e(6, 'b'), e(8, 'b')], { now: NOW });
  assert.equal(r.baseline, 5);
  assert.equal(r.entries, 4);
});

test('lift is family average minus baseline, lifters first', () => {
  const ents = [e(8, 'walk'), e(9, 'walk'), e(7, 'walk'), e(3, 'scrolling'), e(2, 'scrolling'), e(4, 'scrolling')];
  const r = insights(ents, { now: NOW });
  assert.equal(r.baseline, 5.5);
  assert.deepEqual(r.families.map(f => [f.family, f.n, f.avg, f.lift]), [['walk', 3, 8, 2.5], ['scrolling', 3, 3, -2.5]]);
});

test('families under the minimum are flagged low_n, sorted last, and never drains', () => {
  assert.equal(MIN_ENTRIES, 3);
  const ents = [e(10, 'rare'), e(9, 'rare'), e(5, 'work'), e(5, 'work'), e(5, 'work'), e(1, 'bad'), e(1, 'bad')];
  const r = insights(ents, { now: NOW });
  assert.equal(r.families[0].family, 'work');
  assert.ok(!r.families[0].low_n);
  assert.deepEqual(r.families.slice(1).map(f => [f.family, f.low_n]), [['rare', true], ['bad', true]]);
  assert.deepEqual(r.drains.map(f => f.family), ['work']); // below baseline with 3 entries; 'bad' has only 2
});

test('low_n entries still count toward the baseline', () => {
  const r = insights([e(10, 'x'), e(4, 'y'), e(4, 'y'), e(4, 'y')], { now: NOW });
  assert.equal(r.baseline, 5.5);
  assert.equal(r.families.find(f => f.family === 'y').lift, -1.5);
});

test('drains are sorted worst first', () => {
  const ents = [...[5, 5, 5].map(m => e(m, 'meh')), ...[1, 1, 1].map(m => e(m, 'awful')), ...[10, 10, 10].map(m => e(m, 'great'))];
  const r = insights(ents, { now: NOW });
  assert.deepEqual(r.drains.map(f => f.family), ['awful', 'meh']);
});

test('entries outside the window (or in the future) are ignored', () => {
  const ents = [e(9, 'a', 1), e(1, 'a', 24 * 15), e(1, 'a', -2)];
  const r = insights(ents, { now: NOW, days: 14 });
  assert.equal(r.entries, 1);
  assert.equal(r.baseline, 9);
  assert.equal(insights(ents, { now: NOW, days: 30 }).entries, 2);
});

test('empty window returns nulls, not NaN', () => {
  const r = insights([], { now: NOW });
  assert.equal(r.baseline, null);
  assert.deepEqual(r.families, []);
});

test('time of day uses local 2-hour blocks, including across midnight', () => {
  const ents = [
    { at: '2026-10-26T13:30:00Z', mood: 4, family: 'a' }, // 09:30 Toronto
    { at: '2026-10-26T12:10:00Z', mood: 6, family: 'a' }, // 08:10
    { at: '2026-10-26T04:30:00Z', mood: 2, family: 'a' }, // 00:30
    { at: '2026-10-26T03:59:00Z', mood: 8, family: 'a' }, // 23:59 the day before
  ];
  const r = insights(ents, { now: NOW, tz: 'America/Toronto' });
  assert.deepEqual(r.time_of_day.map(b => [b.block, b.n, b.avg]), [['00:00-02:00', 1, 2], ['08:00-10:00', 2, 5], ['22:00-00:00', 1, 8]]);
  assert.equal(r.time_of_day[0].lift, -3);
});

test('daily means cover every day, oldest first, with gaps as null', () => {
  const ents = [{ at: '2026-10-26T14:00:00Z', mood: 6 }, { at: '2026-10-26T15:00:00Z', mood: 8 }, { at: '2026-10-24T15:00:00Z', mood: 3 }];
  const d = dailyMeans(ents, { now: NOW, tz: 'America/Toronto', days: 3 });
  assert.deepEqual(d, [{ date: '2026-10-24', n: 1, avg: 3 }, { date: '2026-10-25', n: 0, avg: null }, { date: '2026-10-26', n: 2, avg: 7 }]);
});

test('mood must be an integer 0-10', () => {
  assert.equal(validMood(0), 0);
  assert.equal(validMood('7'), 7);
  for (const bad of [-1, 11, 6.5, 'x', null]) assert.throws(() => validMood(bad));
});

test('families are lowercased and snapped to an existing one when close', () => {
  const ents = [{ family: 'work deep' }, { family: 'walk' }];
  assert.equal(snapMoodFamily(ents, ' Walk '), 'walk');
  assert.equal(snapMoodFamily(ents, 'deep work'), 'work deep');
  assert.equal(snapMoodFamily(ents, 'gym'), 'gym');
  assert.equal(snapMoodFamily(ents, ''), null);
});

test('linked entries inherit the family from tasks, habits and routines', () => {
  const state = {
    tasks: [{ id: 't1', title: 'Email Sam', family: 'work email' }, { id: 't2', title: 'Call mom' }],
    habits: [{ id: 'h1', name: 'Walk' }],
    routines: [{ id: 'r1', name: 'Morning routine', steps: [{ id: 'r1_0', title: 'Eye drops' }] }],
  };
  assert.deepEqual(resolveLink(state, 't1'), { linked: { kind: 'task', id: 't1' }, family: 'work email', activity: 'Email Sam' });
  assert.equal(resolveLink(state, 't2').family, 'Call mom');
  assert.equal(resolveLink(state, 'h1').family, 'Walk');
  assert.equal(resolveLink(state, 'r1').family, 'Morning routine');
  assert.deepEqual(resolveLink(state, 'r1_0').linked, { kind: 'routine_step', id: 'r1', step_id: 'r1_0' });
  assert.throws(() => resolveLink(state, 'nope'));
});

test('recent families are most recent first, deduped', () => {
  const ents = [{ at: '2026-10-20', family: 'a' }, { at: '2026-10-22', family: 'b' }, { at: '2026-10-21', family: 'a' }];
  assert.deepEqual(recentFamilies(ents), ['b', 'a']);
});
