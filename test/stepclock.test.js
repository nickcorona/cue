import test from 'node:test';
import assert from 'node:assert';
import { routineStatus, localToEpoch } from '../lib/logic.js';

test('a step gated on the clock waits until then, then is offered', () => {
  const r = { id: 'r', name: 'Morning', steps: [
    { id: 'a', title: 'Coffee' },
    { id: 'sun', title: 'Balcony sun', not_before: { time: '08:20' } },
    { id: 'b', title: 'Breakfast' },
  ], log: { '2026-11-02': { ticks: { a: 'done' }, at: {} } } };
  const tz = 'America/Toronto';
  const early = routineStatus(r, '2026-11-02', localToEpoch('2026-11-02T08:05', tz), tz);
  assert.equal(early.next_step.id, 'b');
  assert.equal(early.steps.find(x => x.id === 'sun').wait_until, '08:20');
  const later = routineStatus(r, '2026-11-02', localToEpoch('2026-11-02T08:25', tz), tz);
  assert.equal(later.next_step.id, 'sun');
});
