import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledOn, effectiveTime, mergeDates } from '../lib/logic.js';

// Wednesdays at 18:00; 2026-10-28 is a Wednesday.
const h = { days: [3], time: '18:00', start_date: '2026-10-01', dates: { '2026-10-28': false, '2026-10-29': '17:30' } };

test('date overrides move a habit off its weekday and onto another', () => {
  assert.equal(scheduledOn(h, '2026-10-28'), false);
  assert.equal(scheduledOn(h, '2026-10-29'), true);
  assert.equal(effectiveTime(h, '2026-10-29'), '17:30');
  assert.equal(scheduledOn(h, '2026-11-04'), true);
  assert.equal(effectiveTime(h, '2026-11-04'), '18:00');
  assert.equal(scheduledOn({ ...h, dates: { '2026-09-01': '10:00' } }, '2026-09-01'), false); // before start
});

test('a snooze still wins over a date override', () => {
  assert.equal(effectiveTime({ ...h, snooze: { date: '2026-10-29', until: '20:00' } }, '2026-10-29'), '20:00');
});

test('mergeDates merges, clears with null, drops old entries and rejects junk', () => {
  const out = mergeDates({ '2026-10-01': false, '2026-10-28': false }, { '2026-10-28': null, '2026-11-05': '18:00' }, '2026-10-28');
  assert.deepEqual(out, { '2026-11-05': '18:00' });
  assert.throws(() => mergeDates({}, { '2026-11-05': '6pm' }, '2026-10-28'));
});
