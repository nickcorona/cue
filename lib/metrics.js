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

// The Sunday "Your week" card (also shown Monday morning, in case Sunday went by). Leads with
// what got done, compares only with his own recent weeks (never a target or a score), and ends
// with one concrete suggestion. Progress records help (Harkin et al. 2016), and a factual list
// counters depression's memory bias toward "I did nothing"; feedback aimed at the person
// rather than the work backfires (Kluger & DeNisi 1996), so nothing here grades him.
export function weekCard(state, now = Date.now()) {
  const tz = state.settings.tz, lp = localParts(now, tz);
  const sunday = lp.dow === 0 ? lp.date : lp.dow === 1 && lp.time < '12:00' ? addDays(lp.date, -1) : null;
  if (!sunday) return null;
  const end = addDays(sunday, 1); // the week is Mon..Sun ending today (or yesterday on Monday)
  const w = weekStats(state, end);
  const prior = [1, 2, 3, 4].map(k => weekStats(state, addDays(end, -7 * k))).filter(x => x.tasks_done || x.days_with_anything_done);
  const avg = key => prior.length ? +(prior.reduce((a, x) => a + (x[key] || 0), 0) / prior.length).toFixed(1) : null;
  const from = addDays(end, -7);
  const titles = [];
  for (const t of state.tasks) for (const h of t.history || []) {
    const d = localParts(Date.parse(h.done), tz).date;
    if (d >= from && d < end && !titles.includes(t.title)) titles.push(t.title);
  }
  const trends = [
    { label: 'Tasks done', now: w.tasks_done, avg: avg('tasks_done') },
    { label: 'Days with something done', now: w.days_with_anything_done, avg: avg('days_with_anything_done') },
  ];
  // One suggestion, aimed at the setup, not at him.
  const [mDone, mOf] = (w.morning_routine_core_done || '').split(' of ').map(x => parseInt(x, 10));
  const n = w.notification;
  let suggestion;
  if (mOf && mDone / mOf < 0.5) suggestion = `The morning routine's core steps got done on ${mDone} of ${mOf} days. Try the short version (core steps only) as the default for a week.`;
  else if (w.days_with_anything_done <= 3) suggestion = 'Most days had nothing checked off. Next week, on a low day, aim for one small thing and count it as the whole day.';
  else if (n.not_now > n.done && n.not_now >= 3) suggestion = 'Not now got tapped more than Done, so the notification offered things you weren\'t ready for. When that happens, use "What\'s in the way" so the task gets a smaller first step.';
  else if (w.minutes_from_wake_to_first_thing > 120) suggestion = `The first thing usually got done about ${Math.round(w.minutes_from_wake_to_first_thing / 60)} hours after waking. Make the first morning step something you can do from bed.`;
  else suggestion = 'Keep this week\'s setup as it is.';
  return {
    week: `${from} to ${sunday}`, done_count: titles.length,
    done: titles.slice(0, 8), more: Math.max(0, titles.length - 8),
    trends, first_week: !prior.length, suggestion,
  };
}
