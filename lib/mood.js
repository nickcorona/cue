// Cue Mood: behavioral activation. Log what he did and how he felt (0-10), then compare each
// activity family's average against the overall baseline to find what actually lifts mood.
//
// state.mood = {
//   entries: [{ id, at, mood, mastery?, activity, family, linked?: { kind, id, step_id? }, note?,
//               plan_id?, predicted?: { mood, mastery? },     // predicted: from a plan, or a task's predicted_mood
//               change?: -1|0|1, vs_predicted?: -1|0|1 }],     // after a check-off: did it change his mood (worse, same,
//                                                              // better), or for a predicted task, worse/same/better than expected
//   plans: [{ id, kind: 'task'|'habit', task_id?|habit_id?, family, activity, date?, time,
//             days?, since?, predicted: { mood, mastery? }, created }]
// }
// mood is how it felt, mastery the sense of accomplishment (both 0-10): chores and admin often
// dip mood but build mastery, so a family only counts as a drain if it does neither.
// A plan is a scheduled activity with a predicted mood: a one-off task at a date and time, or
// a habit at a daily time. Rating it links the entry, so predicted vs actual can be compared.
// Families are their own vocabulary (walk, gym, scrolling, work deep, social), lowercase and
// snapped to an existing label when close, so insights stay comparable over time.
import { similarity, localParts, addDays, scheduledOn } from './logic.js';

export const MIN_ENTRIES = 3;   // below this a family's average is noise: shown greyed, never a lifter or drain
export const BLOCK_H = 2;       // time-of-day blocks

export function moodState(state) {
  state.mood ||= { entries: [] };
  state.mood.entries ||= [];
  state.mood.plans ||= [];
  return state.mood;
}

// After a check-off the app asks whether it changed his mood, not for an absolute 0-10:
// a change is what he can judge on the spot, and it is what behavioral activation is after.
export function validChange(c, what = 'change') {
  const n = Number(c);
  if (![-1, 0, 1].includes(n) || c === '' || c == null) throw new Error(`${what} must be -1 (worse), 0 (same) or 1 (better)`);
  return n;
}

export function validMood(m, what = 'mood') {
  const n = typeof m === 'number' || (typeof m === 'string' && m.trim() !== '') ? Number(m) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error(`${what} must be a whole number from 0 to 10`);
  return n;
}

// A family's direction: its lift over the 0-10 baseline when rated that way, else its mean change.
const effect = f => f.lift ?? f.change_avg ?? 0;
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const mean = xs => xs.reduce((a, x) => a + x, 0) / xs.length;

// Reuse an existing mood family when the new one is clearly the same thing.
export function snapMoodFamily(entries, family) {
  const f = String(family || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!f) return null;
  const known = [...new Set(entries.map(e => e.family).filter(Boolean))];
  if (known.includes(f)) return f;
  let best = null, bestSim = 0;
  for (const k of known) { const sim = similarity(k, f); if (sim > bestSim) { best = k; bestSim = sim; } }
  return bestSim >= 0.6 ? best : f;
}

// What a linked id points at, and the family an entry inherits from it: a task's family (or
// its title), a habit's name, a routine's name (for the routine or any of its steps).
export function resolveLink(state, linkedId) {
  if (!linkedId) return null;
  const t = state.tasks.find(x => x.id === linkedId);
  if (t) return { linked: { kind: 'task', id: t.id }, family: t.family || t.title, activity: t.title };
  const h = state.habits.find(x => x.id === linkedId);
  if (h) return { linked: { kind: 'habit', id: h.id }, family: h.name, activity: h.name };
  const r = state.routines.find(x => x.id === linkedId);
  if (r) return { linked: { kind: 'routine', id: r.id }, family: r.name, activity: r.name };
  for (const r2 of state.routines) {
    const st = (r2.steps || []).find(x => x.id === linkedId);
    if (st) return { linked: { kind: 'routine_step', id: r2.id, step_id: st.id }, family: r2.name, activity: `${r2.name}: ${st.title}` };
  }
  throw new Error(`No task, habit, routine or routine step with id ${linkedId}`);
}

const inWindow = (entries, days, now) => {
  const since = now - days * 864e5;
  return entries.filter(e => { const t = Date.parse(e.at); return t >= since && t <= now; });
};

// Per family: entries, average, and lift = average minus the window's baseline (the mean of
// every entry in the window); the same for mastery over the entries that rated it. Families
// under MIN_ENTRIES (or with fewer mastery ratings) are flagged and never called either way.
// Builders sit at or below the mood baseline but above the mastery one (worth doing anyway);
// drains are below the mood baseline without that, worst first.
// Time of day: average mood per 2-hour local block that has entries.
// Predictions: entries rated against a plan, predicted vs actual (gap = actual - predicted).
export function insights(entries, { days = 14, now = Date.now(), tz = 'UTC' } = {}) {
  const win = inWindow(entries, days, now);
  if (!win.length) return { days, entries: 0, baseline: null, baseline_mastery: null, families: [], drains: [], builders: [], time_of_day: [], predictions: null };
  const scored = win.filter(e => e.mood != null);
  const baseline = scored.length ? mean(scored.map(e => e.mood)) : null;
  const rated = win.filter(e => e.mastery != null);
  const mBase = rated.length ? mean(rated.map(e => e.mastery)) : null;
  const by = new Map();
  for (const e of win) { const f = e.family || 'other'; if (!by.has(f)) by.set(f, []); by.get(f).push(e); }
  const families = [...by].map(([family, es]) => {
    const mv = es.filter(e => e.mood != null).map(e => e.mood), ms = es.filter(e => e.mastery != null).map(e => e.mastery);
    const cs = es.filter(e => e.change != null).map(e => e.change);
    return {
      family, n: es.length, ...(mv.length ? { avg: round(mean(mv)), lift: round(mean(mv) - baseline) } : {}), ...(es.length < MIN_ENTRIES ? { low_n: true } : {}),
      // Worse/same/better after doing it: the share that left him better, and the mean (-1 to 1).
      ...(cs.length ? { change_n: cs.length, change_avg: round(mean(cs)), better: round(cs.filter(c => c > 0).length / cs.length) } : {}),
      ...(ms.length ? { mastery_n: ms.length, mastery_avg: round(mean(ms)), mastery_lift: round(mean(ms) - mBase) } : {}),
    };
  }).sort((a, b) => (!!a.low_n - !!b.low_n) || effect(b) - effect(a) || b.n - a.n);
  const builds = f => !f.low_n && f.mastery_n >= MIN_ENTRIES && f.mastery_lift > 0;
  const builders = families.filter(f => !f.low_n && effect(f) <= 0 && builds(f)).sort((a, b) => b.mastery_lift - a.mastery_lift);
  const drains = families.filter(f => !f.low_n && effect(f) < 0 && !builds(f)).sort((a, b) => effect(a) - effect(b));
  const blocks = new Map();
  for (const e of scored) {
    const h = Number(localParts(Date.parse(e.at), tz).time.slice(0, 2));
    const b = Math.floor(h / BLOCK_H) * BLOCK_H;
    if (!blocks.has(b)) blocks.set(b, []);
    blocks.get(b).push(e.mood);
  }
  const pad = n => String(n).padStart(2, '0');
  const time_of_day = [...blocks].sort((a, b) => a[0] - b[0])
    .map(([b, ms]) => ({ block: `${pad(b)}:00-${pad((b + BLOCK_H) % 24)}:00`, n: ms.length, avg: round(mean(ms)), lift: round(mean(ms) - baseline) }));
  return { days, entries: win.length, baseline: baseline == null ? null : round(baseline), baseline_mastery: mBase == null ? null : round(mBase), families, drains, builders, time_of_day, predictions: predictions(win) };
}

// Predicted vs actual for entries rated against a plan. Depression underpredicts how much an
// activity helps; a positive gap is that showing up in his own data.
export function predictions(entries) {
  // Asked in the app as worse / same / better than he expected.
  const vs = entries.filter(e => e.vs_predicted != null);
  const vsOut = vs.length ? { vs_expected: { n: vs.length, better: vs.filter(e => e.vs_predicted > 0).length, same: vs.filter(e => e.vs_predicted === 0).length, worse: vs.filter(e => e.vs_predicted < 0).length } } : {};
  const ps = entries.filter(e => e.predicted?.mood != null && e.mood != null);
  if (!ps.length) return vs.length ? vsOut : null;
  const sum = es => {
    const pm = es.filter(e => e.predicted.mastery != null && e.mastery != null);
    return {
      n: es.length, predicted: round(mean(es.map(e => e.predicted.mood))), actual: round(mean(es.map(e => e.mood))), gap: round(mean(es.map(e => e.mood - e.predicted.mood))),
      ...(pm.length ? { mastery_n: pm.length, mastery_gap: round(mean(pm.map(e => e.mastery - e.predicted.mastery))) } : {}),
    };
  };
  const by = new Map();
  for (const e of ps) { if (!by.has(e.family)) by.set(e.family, []); by.get(e.family).push(e); }
  return { ...sum(ps), by_family: [...by].map(([family, es]) => ({ family, ...sum(es) })).sort((a, b) => b.n - a.n), ...vsOut };
}

// Each day a plan was (or is) due, from `from` to today: done, skipped (excused habit day),
// missed (the day passed without it), upcoming, or dropped (the task was dropped or deleted).
export function planOccurrences(state, plan, { from, today, tz = 'UTC' }) {
  const entries = state.mood?.entries || [];
  const ratedOn = new Set(entries.filter(e => e.plan_id === plan.id).map(e => localParts(Date.parse(e.at), tz).date));
  const base = { plan_id: plan.id, family: plan.family, activity: plan.activity, time: plan.time, predicted: plan.predicted };
  if (plan.kind === 'task') {
    if (plan.date < from || plan.ended) return [];
    const t = state.tasks.find(x => x.id === plan.task_id);
    const rated = ratedOn.size > 0;
    const status = rated || t?.status === 'done' ? 'done' : !t || t.status === 'dropped' ? 'dropped' : plan.date < today ? 'missed' : 'upcoming';
    return [{ ...base, date: plan.date, status, rated }];
  }
  const h = state.habits.find(x => x.id === plan.habit_id);
  if (!h) return [];
  const out = [];
  const last = plan.ended && plan.ended <= today ? addDays(plan.ended, -1) : today; // ended = the first day it no longer applies
  for (let d = plan.since > from ? plan.since : from; d <= last; d = addDays(d, 1)) {
    if (!scheduledOn({ ...h, days: plan.days || h.days }, d)) continue;
    const log = h.log?.[d], rated = ratedOn.has(d);
    if (h.archived && !log && !rated) continue;
    out.push({ ...base, date: d, rated, status: log?.done || rated ? 'done' : log?.skipped ? 'skipped' : d < today ? 'missed' : 'upcoming' });
  }
  return out;
}

// Planned vs done over occurrences: missed counts against, skipped and upcoming don't.
export function followThrough(occ) {
  const sum = os => {
    const done = os.filter(o => o.status === 'done').length, missed = os.filter(o => o.status === 'missed').length;
    return { planned: done + missed, done, missed, rate: done + missed ? round(done / (done + missed)) : null };
  };
  const by = new Map();
  for (const o of occ) { if (!by.has(o.family)) by.set(o.family, []); by.get(o.family).push(o); }
  return { ...sum(occ), by_family: [...by].map(([family, os]) => ({ family, ...sum(os) })).filter(f => f.planned).sort((a, b) => a.rate - b.rate || b.planned - a.planned) };
}

// Average mood per local day for the last `days` days, oldest first (avg null on empty days).
export function dailyMeans(entries, { days = 14, now = Date.now(), tz = 'UTC' } = {}) {
  const by = new Map();
  for (const e of entries) {
    if (e.mood == null) continue;
    const d = localParts(Date.parse(e.at), tz).date;
    if (!by.has(d)) by.set(d, []);
    by.get(d).push(e.mood);
  }
  const today = localParts(now, tz).date, out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const ms = by.get(d) || [];
    out.push({ date: d, n: ms.length, avg: ms.length ? round(mean(ms)) : null });
  }
  return out;
}

// What he finished today that has no mood rating yet, newest first: tasks, habits and whole
// routines (steps roll up to their routine). Feeds the logger's quick picks and the evening recap,
// so anything skipped in the moment can still be rated against the right activity.
export function unratedToday(state, { now = Date.now(), tz = 'UTC', limit = 10 } = {}) {
  const today = localParts(now, tz).date;
  const onToday = iso => iso && localParts(Date.parse(iso), tz).date === today;
  const rated = new Set((state.mood?.entries || []).filter(e => e.linked && onToday(e.at)).map(e => e.linked.id));
  const out = [];
  for (const t of state.tasks || []) if (t.status === 'done' && onToday(t.completed)) out.push({ kind: 'task', id: t.id, label: t.title, at: t.completed });
  for (const h of state.habits || []) {
    const l = h.log?.[today];
    // A habit ticked through a routine step is rated with that routine.
    if (l?.done && !(l.via && l.via !== 'lift')) out.push({ kind: 'habit', id: h.id, label: h.name, at: l.at || null });
  }
  for (const r of state.routines || []) {
    const e = r.log?.[today];
    const ticks = Object.entries(e?.ticks || {}).filter(([, v]) => v === 'done');
    const open = (r.steps || []).some(st => !e?.ticks?.[st.id] && !(e?.short && !st.core));
    if (!ticks.length || (open && !e?.done)) continue;
    const at = ticks.map(([k]) => e.at?.[k]).filter(Boolean).sort().pop() || null;
    out.push({ kind: 'routine', id: r.id, label: r.name, at });
  }
  return out.filter(x => !rated.has(x.id)).sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, limit);
}

// Most recently used families first, for autocomplete.
export function recentFamilies(entries, limit = 30) {
  const seen = new Set(), out = [];
  for (const e of [...entries].sort((a, b) => b.at.localeCompare(a.at))) {
    if (e.family && !seen.has(e.family)) { seen.add(e.family); out.push(e.family); if (out.length >= limit) break; }
  }
  return out;
}

export const entryOut = e => ({ id: e.id, at: e.at, ...(e.mood != null ? { mood: e.mood } : {}), ...(e.change != null ? { change: e.change } : {}), ...(e.vs_predicted != null ? { vs_predicted: e.vs_predicted } : {}), ...(e.mastery != null ? { mastery: e.mastery } : {}), activity: e.activity, family: e.family, ...(e.linked ? { linked: e.linked } : {}), ...(e.plan_id ? { plan_id: e.plan_id } : {}), ...(e.predicted ? { predicted: e.predicted } : {}), ...(e.note ? { note: e.note } : {}) });

// What the queue shows on a card: a family that reliably lifts mood (lift >= 0.5) or builds
// mastery, over a longer window so the tag is stable. Drains are left off on purpose: a tag
// saying a task feels bad would only feed avoidance; builders cover the needed-but-unpleasant.
export const QUEUE_LIFT = 0.5, QUEUE_CHANGE = 0.5; // change: mean of worse/same/better as -1/0/1
export function moodTags(entries, { days = 28, now = Date.now(), tz = 'UTC' } = {}) {
  const ins = insights(entries, { days, now, tz });
  const builders = new Set(ins.builders.map(f => f.family));
  const out = new Map();
  for (const f of ins.families) {
    if (f.low_n) continue;
    if (f.lift >= QUEUE_LIFT || (f.change_n >= MIN_ENTRIES && f.change_avg >= QUEUE_CHANGE)) out.set(f.family, { lift: f.lift ?? f.change_avg });
    else if (builders.has(f.family)) out.set(f.family, { builds: true });
  }
  return out;
}

// The family a queue item's mood entries land under (same rule as resolveLink + snapping).
export function itemFamily(entries, x) {
  return snapMoodFamily(entries, x.family || x.title || x.name);
}
