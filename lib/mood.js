// Cue Mood: behavioral activation. Log what he did and how he felt (0-10), then compare each
// activity family's average against the overall baseline to find what actually lifts mood.
//
// state.mood = {
//   entries: [{ id, at, mood, activity, family, linked?: { kind, id, step_id? }, note? }]
// }
// Families are their own vocabulary (walk, gym, scrolling, work deep, social), lowercase and
// snapped to an existing label when close, so insights stay comparable over time.
import { similarity, localParts, addDays } from './logic.js';

export const MIN_ENTRIES = 3;   // below this a family's average is noise: shown greyed, never a lifter or drain
export const BLOCK_H = 2;       // time-of-day blocks

export function moodState(state) {
  state.mood ||= { entries: [] };
  state.mood.entries ||= [];
  return state.mood;
}

export function validMood(m) {
  const n = typeof m === 'number' || (typeof m === 'string' && m.trim() !== '') ? Number(m) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error('mood must be a whole number from 0 to 10');
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
// every entry in the window). Families under MIN_ENTRIES are flagged low_n and sorted last.
// Drains are the families with enough entries that sit below baseline, worst first.
// Time of day: average mood per 2-hour local block that has entries.
export function insights(entries, { days = 14, now = Date.now(), tz = 'UTC' } = {}) {
  const win = inWindow(entries, days, now);
  if (!win.length) return { days, entries: 0, baseline: null, families: [], drains: [], time_of_day: [] };
  const baseline = mean(win.map(e => e.mood));
  const by = new Map();
  for (const e of win) { const f = e.family || 'other'; if (!by.has(f)) by.set(f, []); by.get(f).push(e.mood); }
  const families = [...by].map(([family, ms]) => {
    const avg = mean(ms);
    return { family, n: ms.length, avg: round(avg), lift: round(avg - baseline), ...(ms.length < MIN_ENTRIES ? { low_n: true } : {}) };
  }).sort((a, b) => (!!a.low_n - !!b.low_n) || b.lift - a.lift || b.n - a.n);
  const drains = families.filter(f => !f.low_n && f.lift < 0).sort((a, b) => a.lift - b.lift);
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
  return { days, entries: win.length, baseline: round(baseline), families, drains, time_of_day };
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

export const entryOut = e => ({ id: e.id, at: e.at, mood: e.mood, activity: e.activity, family: e.family, ...(e.linked ? { linked: e.linked } : {}), ...(e.note ? { note: e.note } : {}) });
