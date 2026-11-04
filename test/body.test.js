import test from 'node:test';
import assert from 'node:assert/strict';
import { trend, planTarget, bodySummary, cleanBody, bodyLine } from '../lib/body.js';

const TZ = 'America/Toronto';
const now = Date.parse('2026-11-03T20:00:00-05:00');
const weighins = [
  { at: '2026-10-25T14:32:45', lb: 220.0 }, { at: '2026-10-31T14:21:50', lb: 216.2 },
  { at: '2026-11-01T11:03:17', lb: 219.6 }, { at: '2026-11-01T13:05:10', lb: 216.8 },
  { at: '2026-11-02T07:45:03', lb: 216.8 }, { at: '2026-11-03T06:40:57', lb: 214.5 },
].map(w => ({ ...w, at: w.at + '-05:00' }));
const plan = [{ date: '2026-11-02', target_lb: 218 }, { date: '2026-11-09', target_lb: 216.1 }];

test('the trend moves a tenth of the way per day toward each weigh-in, more over a gap', () => {
  const t = trend(weighins, TZ);
  assert.equal(t.length, 5); // two on Nov 1 count as one day
  assert.equal(t[0].trend, 220);
  // Six days after: 1 - 0.9^6 of the way to 216.2
  assert.ok(Math.abs(t[1].trend - (220 + (1 - 0.9 ** 6) * (216.2 - 220))) < 1e-9);
  // A heavy day barely moves it
  assert.ok(t[2].trend < t[1].trend + 0.2);
});

test('the plan target is a straight line between weekly targets', () => {
  assert.equal(planTarget(plan, '2026-11-02'), 218);
  assert.ok(Math.abs(planTarget(plan, '2026-11-05') - (218 - 1.9 * 3 / 7)) < 1e-9);
  assert.equal(planTarget(plan, '2026-10-01'), null);
});

test('Home gets one line: trend, the week, against plan, body fat', () => {
  const s = { settings: { tz: TZ }, body: cleanBody({ weighins, plan, estimate: { date: '2026-11-03', bf: 21.3, bf_sd: 1.1 } }, now) };
  const b = bodySummary(s, now);
  assert.equal(b.last_weighin.date, '2026-11-03');
  assert.ok(b.week_lb < 0);
  assert.match(b.line, /^\d{3}\.\d lb  ·  −\d\.\d this week  ·  .*plan  ·  21% fat$/);
  assert.equal(bodyLine(214.9, -1.6, 0.2, NaN), '214.9 lb  ·  −1.6 this week  ·  on plan');
});

test("the model's trend is used when it's sent, and the week is measured on it", () => {
  const tr = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 25 + i)).toISOString().slice(0, 10), lb: 219 - 0.3 * i }));
  const s = { settings: { tz: TZ }, body: cleanBody({ weighins, plan, trend: tr }, now) };
  const b = bodySummary(s, now);
  assert.equal(b.trend_lb, 216.3);
  assert.equal(b.week_lb, -2.1);
  assert.equal(b.last_weighin.lb, 214.5);
});

test('nothing shows after two weeks without a weigh-in, and junk is dropped', () => {
  const s = { settings: { tz: TZ }, body: cleanBody({ weighins, plan }, now) };
  assert.equal(bodySummary(s, now + 20 * 86400e3), null);
  assert.equal(cleanBody({ weighins: [{ at: 'x', lb: 200 }, { at: '2026-11-03T07:00:00Z', lb: 9000 }] }, now).weighins.length, 0);
});
