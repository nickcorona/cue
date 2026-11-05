// Good days: one 0-10 rating of the whole day, the day's facts filled in without logging, and
// a model of which of them move the rating. The question is "what makes a good day for me",
// answered with as little effort as possible: one tap at night, an optional line.
//
// state.days = { 'YYYY-MM-DD': {
//   rating?, note?, rated_at?,                // his one input (the note is optional)
//   tags?: { social, people[], exercise, outdoors, alcohol, sick, work_heavy, extra[] },
//   events?: ['19:00 Dinner with Karam'],     // the calendar, kept: the feed only goes back a day
//   at? } }                                    // when the facts were last filled in
//
// Everything else (check-offs, focus time, phone and browser use, weekday) is read from the
// rest of the state when the model runs, so nothing is stored twice.
import { localParts, addDays, dowOf } from './logic.js';

export const MIN_DAYS = 10;   // fewer rated days than this and no effect is reported
const LOOKBACK = 120;         // days the model fits on

export function daysState(state) { return (state.days ||= {}); }

// The day a rating belongs to: before 5am it's still last night's day, so a rating after
// midnight, the ping for it and the Mood page all agree on which day it is.
export const DAY_ENDS = '05:00';
export function ratingDay(now, tz) {
  const lp = localParts(now, tz);
  return lp.time < DAY_ENDS ? addDays(lp.date, -1) : lp.date;
}

export function validRating(r) {
  const n = Number(r);
  if (!Number.isInteger(n) || n < 0 || n > 10 || r === '' || r == null) throw new Error('rating must be a whole number from 0 to 10');
  return n;
}

// What Cue saw him do on a date: task, habit and routine check-offs, by name and family.
export function checkoffs(state, date, tz) {
  const day = iso => iso && localParts(Date.parse(iso), tz).date === date;
  const out = [];
  for (const t of state.tasks || []) for (const h of t.history || []) if (day(h.done)) out.push({ kind: 'task', title: t.title, family: t.family || null, est_min: t.est_min || 0 });
  for (const h of state.habits || []) if (h.log?.[date]?.done) out.push({ kind: 'habit', title: h.name, family: (h.family || h.name || '').toLowerCase() });
  for (const r of state.routines || []) if (Object.values(r.log?.[date]?.ticks || {}).some(v => v === 'done')) out.push({ kind: 'routine', title: r.name, family: r.name.toLowerCase() });
  return out;
}

function focusMinutes(state, date, tz) {
  let m = 0;
  for (const s of state.focus?.sessions || []) if (s.ended && localParts(Date.parse(s.started), tz).date === date) m += s.minutes || 0;
  return m;
}

// Words that mark a check-off or event as exercise or time outside without asking a model.
const EXERCISE = /\b(lift(ing|ed)?|gym|workout|pilates|run(ning)?|ride|cycling|spin|yoga|swim(ming)?|climb(ing|ed)?|bouldering|push day|pull day|legs|cardio|hik(e|ed|ing)|tennis|basketball|soccer)\b/i;
const OUTDOORS = /\b(dog park|walk(ed|ing)?|hik(e|ed|ing)|park|beach|outside|outdoors|patio|rooftop|lake)\b/i;

// The day's facts as numbers, from its stored tags and the rest of the state. prev_* are
// yesterday's, since a late or social night can show up in the next day's rating.
export function features(state, date) {
  const tz = state.settings.tz, d = state.days?.[date] || {}, y = state.days?.[addDays(date, -1)] || {};
  const done = checkoffs(state, date, tz);
  const names = [...done.map(x => `${x.title} ${x.family || ''}`), ...(d.events || [])].join(' | ');
  const tg = d.tags || {}, ty = y.tags || {};
  const usage = state.usage?.[date];
  const dow = dowOf(date);
  return {
    social: tg.social ? 1 : 0,
    exercise: tg.exercise || EXERCISE.test(names) ? 1 : 0,
    outdoors: tg.outdoors || OUTDOORS.test(names) ? 1 : 0,
    alcohol: tg.alcohol ? 1 : 0,
    sick: tg.sick ? 1 : 0,
    work_heavy: tg.work_heavy ? 1 : 0,
    weekend: dow === 0 || dow === 6 ? 1 : 0,
    tasks_done: done.filter(x => x.kind === 'task').length,
    focus_h: focusMinutes(state, date, tz) / 60,
    // From the phone only: Chrome unlocks are time boxes chosen, not time spent.
    ...(usage ? { screen_h: (usage.screen_min || 0) / 60, feeds_h: (usage.gated_min || 0) / 60 } : {}),
    prev_social: ty.social ? 1 : 0,
    prev_alcohol: ty.alcohol ? 1 : 0,
  };
}

// What each feature means in words, its prior (how big an effect is plausible before any data,
// in rating points per unit) and the unit it's read in.
export const FEATURES = {
  social: { label: 'Days you see friends', prior: 1.5 },
  exercise: { label: 'Days you exercise', prior: 1.5 },
  outdoors: { label: 'Days you get outside', prior: 1 },
  alcohol: { label: 'Days you drink', prior: 1 },
  sick: { label: 'Sick days', prior: 2 },
  work_heavy: { label: 'Heavy work days', prior: 1 },
  weekend: { label: 'Weekends', prior: 1 },
  tasks_done: { label: 'Each task done', prior: 0.3, unit: 'per task' },
  focus_h: { label: 'Each hour of focus', prior: 0.5, unit: 'per hour' },
  screen_h: { label: 'Each hour on your phone', prior: 0.5, unit: 'per hour' },
  feeds_h: { label: 'Each hour on feeds', prior: 0.75, unit: 'per hour' },
  prev_social: { label: 'The day after seeing friends', prior: 1 },
  prev_alcohol: { label: 'The day after drinking', prior: 1 },
};

// Small dense linear algebra for the fit: a few features, a few hundred days at most.
function solve(A, b) { // A x = b by Gauss-Jordan with partial pivoting; A is k x k
  const k = A.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const v = M[c][c] || 1e-12;
    for (let j = c; j <= k; j++) M[c][j] /= v;
    for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r[k]);
}
function inverse(A) { return A.map((_, i) => solve(A, A.map((__, j) => (i === j ? 1 : 0)))).map((col, i, cols) => cols.map(c => c[i])); }

// Bayesian linear regression of the day rating on its features: each effect gets a normal prior
// centred on zero (FEATURES[f].prior is its sd), the intercept a flat one, and the noise variance
// is re-estimated from the residuals a few times. The prior is what keeps a handful of lucky days
// from reading as a finding: an effect has to show up across many days to move off zero.
// Only features that vary (seen on at least 3 rated days and missing on at least 3) are fitted.
export function fitDays(state, now = Date.now()) {
  const tz = state.settings.tz, today = ratingDay(now, tz);
  const rows = [];
  for (let i = 0; i < LOOKBACK; i++) {
    const date = addDays(today, -i), d = state.days?.[date];
    if (d?.rating == null) continue;
    rows.push({ date, y: d.rating, x: features(state, date) });
  }
  const n = rows.length;
  const mean = n ? rows.reduce((a, r) => a + r.y, 0) / n : null;
  if (n < MIN_DAYS) return { n, mean, need: MIN_DAYS - n, effects: [] };
  const names = Object.keys(FEATURES).filter(f => {
    const vals = rows.map(r => r.x[f]).filter(v => v != null);
    if (vals.length < n) return false; // screen time missing on some days: left out rather than imputed
    const on = vals.filter(v => v > 0).length;
    return on >= 3 && n - on >= 3;
  });
  if (!names.length) return { n, mean, effects: [] };
  // Centre each feature and the rating so the intercept drops out.
  const fm = names.map(f => rows.reduce((a, r) => a + r.x[f], 0) / n);
  const X = rows.map(r => names.map((f, j) => r.x[f] - fm[j])), y = rows.map(r => r.y - mean);
  const XtX = names.map((_, a) => names.map((__, b) => X.reduce((s, row) => s + row[a] * row[b], 0)));
  const Xty = names.map((_, a) => X.reduce((s, row, i) => s + row[a] * y[i], 0));
  let s2 = y.reduce((a, v) => a + v * v, 0) / Math.max(1, n - 1) || 1, beta = names.map(() => 0), cov = null;
  for (let it = 0; it < 5; it++) {
    const P = XtX.map((row, a) => row.map((v, b) => v + (a === b ? s2 / FEATURES[names[a]].prior ** 2 : 0)));
    beta = solve(P, Xty);
    cov = inverse(P).map(row => row.map(v => v * s2));
    const res = y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0));
    s2 = Math.max(0.25, res.reduce((a, v) => a + v * v, 0) / Math.max(1, n - 1));
  }
  const effects = names.map((f, j) => {
    const sd = Math.sqrt(Math.max(0, cov[j][j])), est = beta[j];
    const z = sd ? est / sd : 0;
    return {
      feature: f, label: FEATURES[f].label, ...(FEATURES[f].unit ? { unit: FEATURES[f].unit } : {}),
      effect: Math.round(est * 100) / 100, sd: Math.round(sd * 100) / 100,
      // How sure: the posterior chance the effect has the sign it shows.
      sure: Math.round(normCdf(Math.abs(z)) * 100) / 100,
      days: rows.filter(r => r.x[f] > 0).length,
    };
  }).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  return { n, mean: Math.round(mean * 10) / 10, sigma: Math.round(Math.sqrt(s2) * 10) / 10, effects };
}

function normCdf(z) { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + e) / 2 : (1 - e) / 2;
}

// People from the tagged days: who, how often, and how long since he saw them.
export function people(state, now = Date.now()) {
  const today = localParts(now, state.settings.tz).date, seen = {};
  for (const [date, d] of Object.entries(state.days || {})) for (const p of d.tags?.people || []) {
    const k = p.trim();
    if (!k) continue;
    const s = (seen[k.toLowerCase()] ||= { name: k, days: 0, last: date });
    s.days++;
    if (date > s.last) s.last = date;
  }
  return Object.values(seen).map(p => ({ ...p, days_ago: daysBetween(p.last, today) })).sort((a, b) => b.days - a.days);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

// Social days in the last 7, and his usual (the weekly average over the last 8 weeks of ratings).
export function socialWeek(state, now = Date.now()) {
  const today = localParts(now, state.settings.tz).date;
  const count = (from, to) => { let c = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (state.days?.[d]?.tags?.social) c++; return c; };
  const week = count(addDays(today, -6), today);
  const tagged = Object.keys(state.days || {}).filter(d => state.days[d].tags && d > addDays(today, -56)).length;
  const usual = tagged >= 14 ? Math.round(count(addDays(today, -55), today) / (tagged / 7) * 10) / 10 : null;
  return { week, usual };
}

// What to suggest: friends not seen in a while, longest gap first, when this week is light on
// seeing people. He decides; Cue only puts the first step (a text) one tap away.
export function socialNudges(state, now = Date.now(), { limit = 3 } = {}) {
  const { week, usual } = socialWeek(state, now);
  const light = week < Math.max(2, usual ?? 2);
  const ppl = people(state, now).filter(p => p.days_ago >= 10).sort((a, b) => b.days_ago - a.days_ago).slice(0, limit);
  return { light, week, usual, people: ppl };
}

// Tag a day from its calendar, check-offs and his note. With a model client the tags come from
// a short tool call (people's names, and "drinks at the pub" read as social and alcohol); with
// none, from word lists, so a rating never waits on or fails for want of the model.
const TAG_TOOL = {
  name: 'tag_day',
  description: 'What the day held, from its calendar, check-offs and note.',
  input_schema: {
    type: 'object',
    properties: {
      social: { type: 'boolean', description: 'He spent time with friends, family or a date (in person or a real call), not work meetings or errands' },
      people: { type: 'array', items: { type: 'string' }, description: 'First names of the people he saw socially, as written' },
      exercise: { type: 'boolean' }, outdoors: { type: 'boolean', description: 'Real time outside (a walk, the park, a patio), not a commute' },
      alcohol: { type: 'boolean' }, sick: { type: 'boolean' }, work_heavy: { type: 'boolean', description: 'Long or stressful work day' },
      extra: { type: 'array', items: { type: 'string' }, description: 'Up to 3 other short lowercase labels worth tracking (gaming, date, family, therapy, travel)' },
    },
    required: ['social', 'people', 'exercise', 'outdoors', 'alcohol', 'sick', 'work_heavy'],
  },
};

export function plainTags({ note = '', events = [], done = [] }) {
  const all = [note, ...events, ...done.map(x => x.title)].join(' | ');
  return {
    social: /\b(friends?|dinner with|drinks|party|hang(ing)? out|date|bf|gf|family|visit(ed)?|brunch with|lunch with)\b/i.test(all),
    people: [], exercise: EXERCISE.test(all), outdoors: OUTDOORS.test(all),
    alcohol: /\b(drinks?|beers?|wine|bar|pub|drunk|hungover)\b/i.test(all), sick: /\b(sick|ill|fever|flu|cold)\b/i.test(all),
    work_heavy: /\b(long day at work|crunch|deadline|stressful (day|work))\b/i.test(all), extra: [],
  };
}

export async function tagDay({ note = '', events = [], done = [] }, { client } = {}) {
  if (!client) return plainTags({ note, events, done });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-5-5', max_tokens: 600, output_config: { effort: 'low' },
      system: 'You tag one day of Nick\'s life for a mood diary. Read the calendar, what he checked off and his note; call tag_day once. Be literal: only mark what the text supports.',
      tools: [TAG_TOOL], tool_choice: { type: 'tool', name: 'tag_day' },
      messages: [{ role: 'user', content: `Calendar:\n${events.join('\n') || '(none)'}\n\nChecked off:\n${done.map(x => x.title).join('\n') || '(none)'}\n\nHis note: ${note || '(none)'}` }],
    });
    const t = res.content.find(b => b.type === 'tool_use')?.input;
    if (!t) return plainTags({ note, events, done });
    return {
      social: !!t.social, people: (t.people || []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 8),
      exercise: !!t.exercise, outdoors: !!t.outdoors, alcohol: !!t.alcohol, sick: !!t.sick, work_heavy: !!t.work_heavy,
      extra: (t.extra || []).map(s => String(s).toLowerCase().slice(0, 24)).slice(0, 3),
    };
  } catch (e) {
    console.error('day tagging failed', e.message);
    return plainTags({ note, events, done });
  }
}
