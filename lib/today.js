// Today's list: a short list of tasks locked in for the day, sized to what he has actually been
// getting done lately (not to capacity), so finishing it is a realistic, real day. On a low
// day it shrinks to one thing. Finishing either counts as done; the Now notification and the
// queue keep offering more as bonus, never as a shortfall.
//
// Sizing and the low-day floor follow graded task assignment in behavioural activation: start
// below what feels possible and build. A target above recent output turns most days into
// misses; one far below it invites stopping early (goals act as reference points), so the
// budget tracks the last week's pace with a little stretch.
import { localParts, rankTasks, addDays } from './logic.js';

export const LOW_MOOD = 4;         // a mood entry today at or below this makes it a low day
export const LOW_BY = '11:00';     // nothing done by then: assume a low day
export const MAX_ITEMS = 5;
const STRETCH = 1.1, MIN_BUDGET = 15;

const dayOf = (iso, tz) => localParts(Date.parse(iso), tz).date;

// Corrected minutes of task work finished per day, averaged over the last 7 days (zero days
// included, so a bad week makes a smaller list rather than a longer streak of misses).
export function recentPace(state, today, factor) {
  const s = state.settings, from = addDays(today, -7);
  let min = 0;
  for (const t of state.tasks) {
    for (const h of t.history || []) {
      const d = dayOf(h.done, s.tz);
      if (d >= from && d < today) min += h.actual_min || (t.est_min || s.default_est_min || 15) * factor;
    }
  }
  return min / 7;
}

export function budgetFor(state, today, factor) {
  const s = state.settings;
  const cap = [0, 6].includes(localParts(Date.parse(today + 'T12:00:00Z'), 'UTC').dow) ? s.capacity_weekend_min : s.capacity_min_per_day;
  return Math.max(MIN_BUDGET, Math.min(cap || 120, Math.round(recentPace(state, today, factor) * STRETCH / 5) * 5));
}

// Pick the day's list from the ranking: top tasks until their corrected minutes fill the budget.
export function planDay(state, now = Date.now()) {
  const { scored, factor, today } = rankTasks(state, now);
  const budget = budgetFor(state, today, factor);
  const ids = [];
  let sum = 0;
  for (const x of scored) {
    if (ids.length >= MAX_ITEMS || (ids.length && sum >= budget)) break;
    ids.push(x.t.id);
    sum += x.p;
  }
  return { date: today, ids, budget_min: budget };
}

// Lock today's list the first time it's needed (the daily sweep, or the first read).
export function ensureToday(state, now = Date.now()) {
  const today = localParts(now, state.settings.tz).date;
  if (state.meta.today?.date !== today) state.meta.today = { ...planDay(state, now), mode: null };
  return state.meta.today;
}

function didSomethingToday(state, today) {
  const tz = state.settings.tz;
  if (state.tasks.some(t => (t.history || []).some(h => dayOf(h.done, tz) === today))) return true;
  if (state.habits.some(h => h.log?.[today]?.done)) return true;
  return state.routines.some(r => Object.values(r.log?.[today]?.ticks || {}).includes('done'));
}

// Is today a low day, and why. He can say so (mode low/normal wins); otherwise the latest mood
// entry today at or below LOW_MOOD, or nothing done by LOW_BY.
export function lowDay(state, now = Date.now(), mode = null) {
  if (mode === 'low') return 'you said so';
  if (mode === 'normal') return null;
  const tz = state.settings.tz, lp = localParts(now, tz);
  const mood = (state.mood?.entries || []).filter(e => dayOf(e.at, tz) === lp.date && Date.parse(e.at) <= now).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  if (mood) return mood.mood <= LOW_MOOD ? `mood ${mood.mood}/10` : null;
  if (lp.time >= LOW_BY && !didSomethingToday(state, lp.date)) return `nothing done by ${LOW_BY}`;
  return null;
}

// The day's list as it stands: what's done, what to show next, and whether the day is complete.
// A task that left the queue without being done today (deferred, dropped) just leaves the list.
export function todayView(state, now = Date.now()) {
  const tz = state.settings.tz, today = localParts(now, tz).date;
  const plan = state.meta.today?.date === today ? state.meta.today : { ...planDay(state, now), mode: null };
  const { scored } = rankTasks(state, now);
  const open = new Map(scored.map(x => [x.t.id, x]));
  const items = [];
  for (const id of plan.ids) {
    const t = state.tasks.find(x => x.id === id);
    const done = t ? (t.history || []).some(h => dayOf(h.done, tz) === today) : !open.has(id);
    if (done) items.push({ id, done: true });
    else if (open.has(id)) items.push({ id, done: false });
  }
  const done = items.filter(x => x.done).length;
  const low = lowDay(state, now, plan.mode);
  let show = items.filter(x => !x.done).map(x => x.id);
  if (low) {
    // One thing: the quickest of today's list, unless one is already done.
    show = done ? [] : show.sort((a, b) => open.get(a).p - open.get(b).p).slice(0, 1);
  }
  const total = low ? Math.max(1, done) : items.length;
  return {
    date: today, mode: low ? 'low' : 'normal', ...(low ? { low_because: low } : {}), ...(plan.mode ? { set_by_you: true } : {}),
    budget_min: plan.budget_min, done, total, show, complete: done >= total && !show.length,
  };
}
