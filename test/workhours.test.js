import test from 'node:test';
import assert from 'node:assert';
import { rankTasks, localToEpoch } from '../lib/logic.js';

const tz = 'America/Toronto';
const state = () => ({
  settings: { tz, capacity_min_per_day: 120, capacity_weekend_min: 300, urgency_hard: 20, urgency_soft: 5, default_est_min: 30,
    personal_hours: { weekday: { start: '17:00', end: '23:00' }, weekend: { start: '08:00', end: '23:00' } }, areas: { Move: 5, Work: 3 } },
  tasks: [
    { id: 'movers', title: 'Book movers', status: 'open', project: 'Move', est_min: 30, due: '2026-10-31', hard: true, impact: { consequence: 'money', magnitude: 3, reversible: false } },
    { id: 'jira', title: 'Review Jira', status: 'open', project: 'Work', est_min: 20, impact: { consequence: 'career', magnitude: 1 } },
  ],
  lists: [], habits: [], routines: [], estimates: [], meta: {},
});

test('work tasks lead in work hours and wait after them', () => {
  const day = rankTasks(state(), localToEpoch('2026-11-02T10:00', tz)).scored.map(x => x.t.id);
  assert.deepEqual(day, ['jira', 'movers']);
  const evening = rankTasks(state(), localToEpoch('2026-11-02T18:00', tz)).scored.map(x => x.t.id);
  assert.deepEqual(evening, ['movers', 'jira']);
  const saturday = rankTasks(state(), localToEpoch('2026-11-07T10:00', tz)).scored.map(x => x.t.id);
  assert.deepEqual(saturday, ['movers', 'jira']);
});
