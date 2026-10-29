import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExpiry, notesOn, trialDay, trialResult, productStatus, clashes, productHints } from '../lib/steps.js';
import { routineStatus, routineFriction } from '../lib/logic.js';

const st = (id, title, extra = {}) => ({ id, title, ...extra });

test('a step outside its from/until window does not exist that day', () => {
  const r = { id: 'r', steps: [st('a', 'Eye drops'), st('b', 'Patch test', { from: '2026-10-28', until: '2026-11-03' })] };
  assert.deepEqual(routineStatus(r, '2026-10-27').steps.map(x => x.id), ['a']);
  assert.deepEqual(routineStatus(r, '2026-10-29').steps.map(x => [x.id, x.index]), [['a', 0], ['b', 1]]);
  assert.deepEqual(routineStatus(r, '2026-11-04').steps.map(x => x.id), ['a']);
});

test('temp notes show while in effect and lapse on their date or when their task closes', () => {
  const step = st('v', 'Volufiline', { notes: 'Ring finger.', temp_notes: [{ text: "Pat, don't rub.", until_task: 't1' }, { text: 'Old rule.', until: '2026-10-01' }] });
  assert.equal(notesOn(step, '2026-10-29'), "Pat, don't rub.\n\nRing finger.");
  const state = { tasks: [{ id: 't1', status: 'open' }], routines: [{ steps: [step] }] };
  resolveExpiry(state, '2026-10-29');
  assert.equal(step.temp_notes[0].until_task, 't1'); // task still open
  state.tasks[0] = { id: 't1', status: 'done', completed: '2026-10-30T15:00:00Z' };
  resolveExpiry(state, '2026-10-31');
  assert.equal(step.temp_notes[0].until, '2026-10-30');
  assert.equal(notesOn(step, '2026-10-30'), "Pat, don't rub.\n\nRing finger."); // still on the day it closed
  assert.equal(notesOn(step, '2026-10-31'), 'Ring finger.');
  assert.equal(step.temp_notes.length, 2);
  resolveExpiry(state, '2026-12-15');
  assert.equal(step.temp_notes.length, 0); // tidied a month after lapsing
});

test('until_task also ends a whole step', () => {
  const step = st('p', 'Post-filler ice', { until_task: 't1' });
  const state = { tasks: [{ id: 't1', status: 'dropped', dropped_at: '2026-10-29' }], routines: [{ steps: [step] }] };
  resolveExpiry(state, '2026-10-30');
  assert.equal(step.until, '2026-10-29');
  assert.equal(routineStatus({ steps: [step] }, '2026-10-30').steps.length, 0);
});

const metric = { name: 'puffiness', lower_better: true, trial: { start: '2026-11-01', block_days: 4, washout_days: 1 } };

test('trial days alternate in blocks, with washout at the start of each', () => {
  assert.equal(trialDay(metric, '2026-10-31'), null);
  assert.deepEqual(trialDay(metric, '2026-11-01'), { on: true, block: 0, day_in_block: 0, washout: true });
  assert.equal(trialDay(metric, '2026-11-02').washout, false);
  assert.equal(trialDay(metric, '2026-11-05').on, false);
  assert.equal(trialDay(metric, '2026-11-09').on, true);
  const r = { steps: [st('c', 'Caffeine cream', { metric })] };
  assert.equal(routineStatus(r, '2026-11-02').steps[0].trial_off, undefined);
  assert.equal(routineStatus(r, '2026-11-06').steps[0].trial_off, true);
});

test('trialResult compares the arms, leaving out washout days', () => {
  const log = {};
  const put = (d, v, tick) => { log[d] = { ticks: { c: tick }, values: { c: v } }; };
  put('2026-11-01', 9, 'done'); // washout, ignored
  put('2026-11-02', 3, 'done'); put('2026-11-03', 4, 'done'); put('2026-11-04', 3, 'done');
  put('2026-11-05', 1, 'skip'); // washout
  put('2026-11-06', 6, 'skip'); put('2026-11-07', 7, 'skip'); put('2026-11-08', 6, 'skip');
  const out = trialResult({ log }, st('c', 'Caffeine cream', { metric }));
  assert.equal(out.on.n, 3); assert.equal(out.off.n, 3);
  assert.equal(out.difference, -3);
  assert.match(out.read, /^helps/);
  const thin = trialResult({ log: { '2026-11-02': log['2026-11-02'] } }, st('c', 'x', { metric }));
  assert.match(thin.read, /need at least 2/);
});

test('without a trial schedule, done days are on and skipped days are off', () => {
  const m = { name: 'redness' };
  const log = { d1: { ticks: { s: 'done' }, values: { s: 5 } }, d2: { ticks: { s: 'done' }, values: { s: 5 } }, d3: { ticks: { s: 'skip' }, values: { s: 5 } }, d4: { ticks: { s: 'skip' }, values: { s: 5 } } };
  const out = trialResult({ log }, st('s', 'x', { metric: m }));
  assert.equal(out.difference, 0);
  assert.equal(out.read, 'no spread yet');
});

test('off days in a trial are not friction', () => {
  const r = { steps: [st('c', 'Cream', { metric })], log: {} };
  for (const d of ['2026-11-05', '2026-11-06', '2026-11-07']) r.log[d] = { ticks: { c: 'skip' } };
  assert.deepEqual(routineFriction(r, '2026-11-08'), []);
});

test('product use-by, uses left, and flags', () => {
  const p = { id: 'p1', name: 'Volufiline', opened: '2026-10-01', pao_months: 6, uses: 20 };
  const r = { name: 'Morning', steps: [st('v', 'Volufiline', { product_id: 'p1' })], log: {} };
  for (let i = 1; i <= 18; i++) r.log[`2026-10-${String(i).padStart(2, '0')}`] = { ticks: { v: 'done' } };
  r.log['2026-09-30'] = { ticks: { v: 'done' } }; // before opening: not counted
  const s = productStatus({ routines: [r] }, p, '2026-10-29');
  assert.equal(s.use_by, '2027-04-01');
  assert.equal(s.used, 18); assert.equal(s.left, 2);
  assert.deepEqual(s.flags, ['about 2 uses left']);
  assert.deepEqual(s.steps, ['Morning: Volufiline']);
  const old = productStatus({ routines: [] }, { id: 'x', name: 'Old', opened: '2026-01-01', pao_months: 6, expires: '2026-12-01' }, '2026-10-29');
  assert.equal(old.use_by, '2026-07-01');
  assert.match(old.flags[0], /past its use-by/);
});

test('clashes: actives that should not share a routine, only among steps in effect', () => {
  const state = {
    products: [{ id: 'a', name: 'Tretinoin', actives: ['tretinoin 0.025%'] }, { id: 'b', name: 'Glycolic toner', actives: ['Glycolic acid 7%'] }, { id: 'c', name: 'Niacinamide', actives: ['niacinamide'] }],
    routines: [{ name: 'Night', steps: [st('1', 'Tret', { product_id: 'a' }), st('2', 'Toner', { product_id: 'b', until: '2026-10-01' }), st('3', 'Nia', { product_id: 'c' })] }],
    tasks: [],
  };
  assert.deepEqual(clashes(state, '2026-10-29'), []); // toner step has ended
  state.routines[0].steps[1].until = undefined;
  const c = clashes(state, '2026-10-29');
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].products, ['Tretinoin', 'Glycolic toner']);
  assert.equal(productHints(state, '2026-10-29').length, 1);
});
