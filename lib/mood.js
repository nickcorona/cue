// Cue Mood: behavioral activation. Log what he did and how he felt (0-10), then compare each
// activity family's average against the overall baseline to find what actually lifts mood.
//
// state.mood = {
//   entries: [{ id, at, mood, mastery?, activity, family, linked?: { kind, id, step_id? }, note?,
//               plan_id?, predicted?: { mood, mastery? } }],   // predicted: from a plan, or a task's predicted_mood
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

export function validMood(m, what = 'mood') {
  const n = typeof m === 'number' || (typeof m === 'string' && m.trim() !== '') ? Number(m) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error(`${what} must be a whole number from 0 to 10`);
  return n;
}

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
  const baseline = mean(win.map(e => e.mood));
  const rated = win.filter(e => e.mastery != null);
  const mBase = rated.length ? mean(rated.map(e => e.mastery)) : null;
  const by = new Map();
  for (const e of win) { const f = e.family || 'other'; if (!by.has(f)) by.set(f, []); by.get(f).push(e); }
  const families = [...by].map(([family, es]) => {
    const avg = mean(es.map(e => e.mood)), ms = es.filter(e => e.mastery != null).map(e => e.mastery);
    return {
      family, n: es.length, avg: round(avg), lift: round(avg - baseline), ...(es.length < MIN_ENTRIES ? { low_n: true } : {}),
      ...(ms.length ? { mastery_n: ms.length, mastery_avg: round(mean(ms)), mastery_lift: round(mean(ms) - mBase) } : {}),
    };
  }).sort((a, b) => (!!a.low_n - !!b.low_n) || b.lift - a.lift || b.n - a.n);
  const builds = f => !f.low_n && f.mastery_n >= MIN_ENTRIES && f.mastery_lift > 0;
  const builders = families.filter(f => !f.low_n && f.lift <= 0 && builds(f)).sort((a, b) => b.mastery_lift - a.mastery_lift);
  const drains = families.filter(f => !f.low_n && f.lift < 0 && !builds(f)).sort((a, b) => a.lift - b.lift);
  const blocks = new Map();
  for (const e of win) {
    const h = Number(localParts(Date.parse(e.at), tz).time.slice(0, 2));
    const b = Math.floor(h / BLOCK_H) * BLOCK_H;
    if (!blocks.has(b)) blocks.set(b, []);
    blocks.get(b).push(e.mood);
  }
  const pad = n => String(n).padStart(2, '0');
  const time_of_day = [...blocks].sort((a, b) => a[0] - b[0])
    .map(([b, ms]) => ({ block: `${pad(b)}:00-${pad((b + BLOCK_H) % 24)}:00`, n: ms.length, avg: round(mean(ms)), lift: round(mean(ms) - baseline) }));
  return { days, entries: win.length, baseline: round(baseline), baseline_mastery: mBase == null ? null : round(mBase), families, drains, builders, time_of_day, predictions: predictions(win) };
}

// Predicted vs actual for entries rated against a plan. Depression underpredicts how much an
// activity helps; a positive gap is that showing up in his own data.
export function predictions(entries) {
  const ps = entries.filter(e => e.predicted?.mood != null);
  if (!ps.length) return null;
  const sum = es => {
    const pm = es.filter(e => e.predicted.mastery != null && e.mastery != null);
    return {
      n: es.length, predicted: round(mean(es.map(e => e.predicted.mood))), actual: round(mean(es.map(e => e.mood))), gap: round(mean(es.map(e => e.mood - e.predicted.mood))),
      ...(pm.length ? { mastery_n: pm.length, mastery_gap: round(mean(pm.map(e => e.mastery - e.predicted.mastery))) } : {}),
    };
  };
  const by = new Map();
  for (const e of ps) { if (!by.has(e.family)) by.set(e.family, []); by.get(e.family).push(e); }
  return { ...sum(ps), by_family: [...by].map(([family, es]) => ({ family, ...sum(es) })).sort((a, b) => b.n - a.n) };
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

// Most recently used families first, for autocomplete.
export function recentFamilies(entries, limit = 30) {
  const seen = new Set(), out = [];
  for (const e of [...entries].sort((a, b) => b.at.localeCompare(a.at))) {
    if (e.family && !seen.has(e.family)) { seen.add(e.family); out.push(e.family); if (out.length >= limit) break; }
  }
  return out;
}

export const entryOut = e => ({ id: e.id, at: e.at, mood: e.mood, ...(e.mastery != null ? { mastery: e.mastery } : {}), activity: e.activity, family: e.family, ...(e.linked ? { linked: e.linked } : {}), ...(e.plan_id ? { plan_id: e.plan_id } : {}), ...(e.predicted ? { predicted: e.predicted } : {}), ...(e.note ? { note: e.note } : {}) });

// What the queue shows on a card: a family that reliably lifts mood (lift >= 0.5) or builds
// mastery, over a longer window so the tag is stable. Drains are left off on purpose: a tag
// saying a task feels bad would only feed avoidance; builders cover the needed-but-unpleasant.
export const QUEUE_LIFT = 0.5;
export function moodTags(entries, { days = 28, now = Date.now(), tz = 'UTC' } = {}) {
  const ins = insights(entries, { days, now, tz });
  const builders = new Set(ins.builders.map(f => f.family));
  const out = new Map();
  for (const f of ins.families) {
    if (f.low_n) continue;
    if (f.lift >= QUEUE_LIFT) out.set(f.family, { lift: f.lift });
    else if (builders.has(f.family)) out.set(f.family, { builds: true });
  }
  return out;
}

// The family a queue item's mood entries land under (same rule as resolveLink + snapping).
export function itemFamily(entries, x) {
  return snapMoodFamily(entries, x.family || x.title || x.name);
}
