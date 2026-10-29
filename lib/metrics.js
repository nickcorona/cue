// Is Cue working? Week-over-week numbers for the weekly review, from data Cue already keeps:
// tasks finished, days with anything done, how often today's list was finished, morning
// routine completion, how long after waking the first thing gets done, and which button gets
// tapped on the Now notification (Done or Not now).
import { localParts, localToEpoch, addDays, routineStatus, scheduledOn } from './logic.js';

const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Each day's first sign of activity: a task finished, a habit done, a routine step ticked.
function firstActivity(state, day) {
  const tz = state.settings.tz;
  let first = null;
  const at = v => { const t = Date.parse(v || ''); if (t && localParts(t, tz).date === day && (first === null || t < first)) first = t; };
  for (const t of state.tasks) for (const h of t.history || []) at(h.done);
  for (const h of state.habits) if (h.log?.[day]?.done) at(h.log[day].at);
  for (const r of state.routines) for (const v of Object.values(r.log?.[day]?.at || {})) at(v);
  return first;
}

// The 7 days ending the day before `end` (YYYY-MM-DD).
export function weekStats(state, end) {
  const s = state.settings, tz = s.tz;
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 7));
  const inWeek = iso => { const d = localParts(Date.parse(iso), tz).date; return d >= days[0] && d <= days[6]; };
  const tasksDone = state.tasks.reduce((a, t) => a + (t.history || []).filter(h => inWeek(h.done)).length, 0);
  const active = days.filter(d => firstActivity(state, d) !== null).length;
  // Minutes from wake to the first thing done, on days something was.
  const delays = days.map(d => { const f = firstActivity(state, d); return f === null ? null : Math.round((f - localToEpoch(`${d}T${s.wake || '07:00'}`, tz)) / 60000); }).filter(x => x !== null && x > -120);
  const morning = state.routines.find(r => !r.archived && /morning/i.test(r.name));
  const morningDays = morning ? days.filter(d => scheduledOn(morning, d)) : [];
  const morningDone = morning ? morningDays.filter(d => {
    const st = routineStatus(morning, d, localToEpoch(`${d}T23:59`, tz), tz);
    const core = st.steps.filter(x => x.core);
    return st.done || (core.length && core.every(x => x.done || x.skipped));
  }).length : null;
  const lists = (state.meta.days_log || []).filter(x => x.date >= days[0] && x.date <= days[6]);
  const finished = lists.filter(x => x.ids.length && x.ids.every(id => { const t = state.tasks.find(y => y.id === id); return !t || (t.history || []).some(h => localParts(Date.parse(h.done), tz).date === x.date); })).length;
  const taps = (state.meta.push_actions || []).filter(x => inWeek(x.at));
  return {
    from: days[0], to: days[6],
    tasks_done: tasksDone, tasks_per_day: +(tasksDone / 7).toFixed(1),
    days_with_anything_done: active,
    ...(lists.length ? { todays_list_finished: `${finished} of ${lists.length} days` } : {}),
    ...(morning ? { morning_routine_core_done: `${morningDone} of ${morningDays.length} days` } : {}),
    ...(delays.length ? { minutes_from_wake_to_first_thing: median(delays) } : {}),
    notification: { done: taps.filter(x => x.a === 'done').length, not_now: taps.filter(x => x.a === 'skip').length },
  };
}

export function howCueIsWorking(state, today) {
  return { this_week: weekStats(state, addDays(today, 1)), last_week: weekStats(state, addDays(today, -6)) };
}
