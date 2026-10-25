// Cue Lift: workout programs, logged sessions and progression. Pure functions over the
// state; tools.js wraps them in tool handlers and lib/liftui.js is the phone screen.
//
// state.lift = {
//   unit: 'lb' | 'kg',
//   programs: { [habit_id]: { name, exercises: [Exercise] } },
//   sessions: [{ id, habit_id, name, date, started, finished?, sets: [{ key, i, weight, reps, at }] }],
// }
// Exercise = { key, name, sets, min, max, kind: 'weight'|'bodyweight'|'check', muscles: [..], rest, note? }
//   weight: load x reps; bodyweight: added load (0 = none) x reps; check: just tick each set.
import { localParts, addDays, dowOf } from './logic.js';

export const MUSCLES = ['chest', 'side delts', 'front delts', 'rear delts', 'back', 'biceps', 'triceps', 'core', 'glutes'];
export const TARGET_SETS = 10; // hard sets per muscle per week (Schoenfeld et al. 2017)
const INC = { lb: 5, kg: 2.5 };

export const slug = s => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function liftState(state) {
  state.lift ||= { unit: 'lb', programs: {}, sessions: [] };
  state.lift.programs ||= {};
  state.lift.sessions ||= [];
  state.lift.unit ||= 'lb';
  return state.lift;
}

export function normalizeExercise(e) {
  const kind = ['weight', 'bodyweight', 'check'].includes(e.kind) ? e.kind : 'weight';
  return {
    key: e.key || slug(e.name),
    name: e.name,
    sets: Math.max(1, Math.round(e.sets || 3)),
    min: e.min ?? 8, max: e.max ?? e.min ?? 12,
    kind,
    muscles: (e.muscles || []).filter(m => MUSCLES.includes(m)),
    rest: e.rest ?? (kind === 'check' ? 30 : 90),
    ...(e.note ? { note: e.note } : {}),
  };
}

// Sets of an exercise from its most recent finished session (excluding `skipId`).
export function lastPerformance(lift, key, skipId) {
  for (let i = lift.sessions.length - 1; i >= 0; i--) {
    const s = lift.sessions[i];
    if (s.id === skipId || !s.finished) continue;
    const sets = s.sets.filter(x => x.key === key).sort((a, b) => a.i - b.i);
    if (sets.length) return { date: s.date, sets };
  }
  return null;
}

// Double progression: add a rep per set until every set reaches the top of the range at the
// same load, then add one increment and start again from the bottom of the range.
export function targets(lift, ex, skipId) {
  const last = lastPerformance(lift, ex.key, skipId);
  const out = [];
  if (ex.kind === 'check') { for (let i = 0; i < ex.sets; i++) out.push({ i }); return { last, sets: out }; }
  if (!last) {
    for (let i = 0; i < ex.sets; i++) out.push({ i, weight: ex.kind === 'bodyweight' ? 0 : null, reps: ex.min });
    return { last: null, sets: out };
  }
  const top = Math.max(...last.sets.map(s => s.weight || 0));
  const atTop = last.sets.filter(s => (s.weight || 0) === top);
  const levelUp = atTop.length >= ex.sets && atTop.slice(0, ex.sets).every(s => s.reps >= ex.max);
  for (let i = 0; i < ex.sets; i++) {
    if (levelUp) out.push({ i, weight: top + INC[lift.unit], reps: ex.min });
    else {
      const prev = atTop[i]?.reps ?? atTop[atTop.length - 1]?.reps ?? ex.min;
      out.push({ i, weight: top, reps: Math.min(ex.max, Math.max(ex.min, prev + 1)) });
    }
  }
  return { last, sets: out, ...(levelUp ? { level_up: true } : {}) };
}

const e1rm = (w, r) => (w || 0) * (1 + r / 30); // Epley

// What a session beat: heavier estimated max (weighted), or more reps at bodyweight.
export function prs(lift, session) {
  const out = [];
  const keys = [...new Set(session.sets.map(s => s.key))];
  for (const key of keys) {
    const mine = session.sets.filter(s => s.key === key && s.reps);
    if (!mine.length) continue;
    const before = lift.sessions.filter(s => s.id !== session.id && s.finished).flatMap(s => s.sets.filter(x => x.key === key && x.reps));
    if (!before.length) continue;
    const best = arr => Math.max(...arr.map(s => (s.weight ? e1rm(s.weight, s.reps) : s.reps)));
    if (best(mine) > best(before)) {
      const top = mine.reduce((a, b) => ((b.weight ? e1rm(b.weight, b.reps) : b.reps) > (a.weight ? e1rm(a.weight, a.reps) : a.reps) ? b : a));
      out.push({ key, weight: top.weight, reps: top.reps });
    }
  }
  return out;
}

// Monday of the local week containing `date`.
export const weekStart = date => addDays(date, -((dowOf(date) + 6) % 7));

// Hard sets per muscle this week (checks don't count), from every logged set.
export function weeklySets(lift, today) {
  const from = weekStart(today);
  const exByKey = {};
  for (const p of Object.values(lift.programs)) for (const e of p.exercises) exByKey[e.key] ||= e;
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  for (const s of lift.sessions) {
    if (s.date < from || s.date > today) continue;
    for (const set of s.sets) {
      const ex = exByKey[set.key];
      if (!ex || ex.kind === 'check' || !set.reps) continue;
      for (const m of ex.muscles) out[m]++;
    }
  }
  return out;
}

// Which program is due today: a habit with a program scheduled on today's weekday.
export function dueProgram(state, today) {
  const lift = liftState(state);
  const dow = dowOf(today);
  return Object.keys(lift.programs).find(hid => {
    const h = state.habits.find(x => x.id === hid);
    return h && !h.archived && (!h.days?.length || h.days.includes(dow)) && !h.log?.[today]?.done;
  }) || null;
}

export function sessionView(lift, s) {
  const p = lift.programs[s.habit_id] || { name: s.name, exercises: [] };
  return {
    id: s.id, habit_id: s.habit_id, name: p.name, date: s.date, started: s.started, finished: s.finished || null,
    unit: lift.unit,
    exercises: p.exercises.map(ex => ({ ...ex, ...targets(lift, ex, s.id), logged: s.sets.filter(x => x.key === ex.key).sort((a, b) => a.i - b.i) })),
  };
}

export function today(state) {
  return localParts(Date.now(), state.settings.tz).date;
}
