// Ranking, habit and routine logic. Pure functions over the state object.
import { minutesByProject } from './focus.js';
import { buildState, rankItems, recentHits, SIZE_MIN } from './build.js';

// Manual priority levels (legacy / explicit override). p1 = highest. 3x per level:
// durations span ~2 to 90+ minutes, so flatter weights let 2-minute chores outrank p1s.
export const PRIORITY_WEIGHT = { 1: 27, 2: 9, 3: 3, 4: 1 };

// Derived priority: Claude tags each task with facts (what happens if it's late, how big,
// whether it can be undone) and the weight comes from those plus the area's importance.
// Scaled so typical tasks land in the same range as the p1-p4 weights above.
export const CONSEQUENCE = { none: 0.5, annoyance: 1, money: 2, health: 2.5, career: 2.5, legal: 3 };
export const MAGNITUDE = { 1: 1, 2: 2, 3: 4 }; // small, medium, large
export const IRREVERSIBLE = 1.5;
export const DEFAULT_AREA_IMPORTANCE = 2;

export function areaImportance(t, s) {
  return s.areas?.[t.project] ?? DEFAULT_AREA_IMPORTANCE;
}

export function taskWeight(t, s) {
  if (t.priority_override) return PRIORITY_WEIGHT[t.priority_override];
  const i = t.impact;
  if (i && CONSEQUENCE[i.consequence] != null) {
    return areaImportance(t, s) * CONSEQUENCE[i.consequence] * (MAGNITUDE[i.magnitude] || 1) * (i.reversible === false ? IRREVERSIBLE : 1);
  }
  return PRIORITY_WEIGHT[t.priority || 4];
}

// 1-4 display level for a weight, so the UI and summaries can still say "p1".
export function weightLevel(w) {
  return w >= 20 ? 1 : w >= 7 ? 2 : w >= 2.5 ? 3 : 4;
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- time helpers (everything user-facing is local time) ----------

export function localParts(ts, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}`, dow: DOW.indexOf(p.weekday) };
}

function offsetAt(ts, tz) {
  const p = localParts(ts, tz);
  const [Y, M, D] = p.date.split('-').map(Number);
  const [h, m] = p.time.split(':').map(Number);
  return Date.UTC(Y, M - 1, D, h, m) - Math.floor(ts / 60000) * 60000;
}

// "2026-10-24" (treated as end of day) or "2026-10-24T14:30", local time -> epoch ms
export function localToEpoch(str, tz) {
  const [d, t = '23:59'] = str.split('T');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const guess = Date.UTC(Y, M - 1, D, h, m);
  let ts = guess;
  for (let i = 0; i < 3; i++) ts = guess - offsetAt(ts, tz);
  return ts;
}

export function addDays(dateStr, n) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(Y, M - 1, D + n)).toISOString().slice(0, 10);
}

export function dowOf(dateStr) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
}

export function advanceDue(due, repeat) {
  const [d, t] = due.split('T');
  const n = repeat.every || 1;
  let next;
  if (repeat.unit === 'day') next = addDays(d, n);
  else if (repeat.unit === 'week') next = addDays(d, 7 * n);
  else {
    const [Y, M, D] = d.split('-').map(Number);
    const months = repeat.unit === 'year' ? 12 * n : n;
    const target = new Date(Date.UTC(Y, M - 1 + months, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(D, last));
    next = target.toISOString().slice(0, 10);
  }
  return t ? `${next}T${t}` : next;
}

// ---------- similarity ----------
// Cheap lexical similarity for duplicate warnings and family-label snapping. The learned
// model can use embeddings offline; this only has to catch obvious near-duplicates.
const STOP = new Set('a an and the to of for in on at with from by my your me i it this that before after if or is be up out get do'.split(' '));
export function tokens(text) {
  return new Set(String(text || '').toLowerCase().replace(/-/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => w.replace(/(ing|ed|es|s)$/, '')));
}
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------- capacity ----------

// Focused task minutes available on a given local date (weekends can differ), minus time
// already booked on his calendar during personal hours (s.busy, attached per request when a
// calendar feed is connected).
export function baseCapacity(dateStr, s) {
  const dow = dowOf(dateStr);
  const weekend = dow === 0 || dow === 6;
  return weekend && s.capacity_weekend_min != null ? s.capacity_weekend_min : s.capacity_min_per_day;
}
export function capacityOn(dateStr, s) {
  return Math.max(0, baseCapacity(dateStr, s) - (s.busy?.[dateStr] || 0));
}

// ---------- energy ----------
// Deep work goes best in his peak hours and worst outside them (synchrony effect, May &
// Hasher); light admin is the reverse. Untagged tasks count as normal and aren't moved.
export const FOCUS_FIT = { deep: { peak: 1.5, off: 0.6 }, light: { peak: 0.8, off: 1.2 } };
export function inPeak(time, s) {
  const p = s.peak_hours;
  return !!p && time >= p.start && time < p.end;
}
export function focusFit(t, time, s) {
  const f = FOCUS_FIT[t.focus];
  if (!f || !s.peak_hours) return 1;
  return inPeak(time, s) ? f.peak : f.off;
}

// Working minutes between two instants: each local day contributes its capacity in
// proportion to how much of that day falls inside the window. Negative if `to` is past.
export function workMinutesBetween(from, to, s) {
  if (to <= from) {
    const avg = (5 * s.capacity_min_per_day + 2 * (s.capacity_weekend_min ?? s.capacity_min_per_day)) / 7;
    return ((to - from) / 60000) * avg / 1440;
  }
  let total = 0;
  let day = localParts(from, s.tz).date;
  for (let i = 0; i < 400; i++) {
    const start = localToEpoch(day + 'T00:00', s.tz);
    const end = localToEpoch(addDays(day, 1) + 'T00:00', s.tz);
    const overlap = Math.min(end, to) - Math.max(start, from);
    if (overlap > 0) total += (overlap / (end - start)) * capacityOn(day, s);
    if (end >= to) return total;
    day = addDays(day, 1);
  }
  return total; // beyond ~13 months the exact number doesn't change the ranking
}

// ---------- planning-fallacy correction ----------
// log(actual/estimate) ~ Normal(mu, sigma^2). Conjugate normal prior on mu centred on
// a 1.3x overrun (Buehler et al. 1994 style underestimation). Posterior mean of the
// lognormal gives the expected multiplier to apply to raw estimates.
export function durationModel(state) {
  const sigma = 0.6, mu0 = Math.log(1.3), tau0 = 0.5;
  const logs = state.estimates.slice(-300).filter(e => e.est > 0 && e.actual > 0);
  const sum = logs.reduce((a, e) => a + Math.log(e.actual / e.est), 0);
  const prec = 1 / tau0 ** 2 + logs.length / sigma ** 2;
  const mu = (mu0 / tau0 ** 2 + sum / sigma ** 2) / prec;
  return {
    observations: logs.length,
    median_multiplier: +Math.exp(mu).toFixed(2),
    expected_multiplier: +Math.exp(mu + sigma ** 2 / 2).toFixed(2),
    posterior_sd_log: +Math.sqrt(1 / prec).toFixed(3),
    // Predictive spread of log(actual/estimate) for a new task: noise plus uncertainty in mu.
    predictive_sd_log: +Math.sqrt(sigma ** 2 + 1 / prec).toFixed(3),
    mu_log: mu,
  };
}

// Standard normal CDF (Abramowitz & Stegun 26.2.17, error < 7.5e-8).
export function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

// Probability a task's actual duration exceeds the working minutes available for it.
// Duration is lognormal: log D ~ N(log(estimate) + mu, sd^2), from the duration model.
export function lateProbability(estMin, availMin, dm) {
  if (availMin <= 0) return 1;
  return 1 - normCdf((Math.log(availMin) - (Math.log(estMin) + dm.mu_log)) / dm.predictive_sd_log);
}

// ---------- goals ----------
// A goal is an outcome with a horizon ("Signed DS director offer by 2027-03-31"), tied to an
// area (project). Its main job is keeping a next action in the queue: the usual way a
// long-term aim dies is that nothing under it is ever ready to do. A goal can also carry a
// weekly time minimum; while that's behind, its tasks get boosted in proportion to the
// shortfall, which counters the short-task bias of value-per-minute ranking. Minutes are
// what actually got done in the last 7 days (reported actual time, else corrected estimate).
export const GOAL_BOOST = 4; // max multiplier is 1 + GOAL_BOOST when nothing was done
export const STALL_DAYS = 7;

export function goalStatus(state, now = Date.now()) {
  const factor = durationModel(state).expected_multiplier;
  const since = now - 7 * 864e5;
  const today = localParts(now, state.settings.tz).date;
  return (state.goals || []).filter(g => !g.archived && (g.status || 'active') === 'active').map(g => {
    // Focus sessions count as they happen; a task finished from Focus is already counted there.
    let spent = state.focus ? minutesByProject(state.focus, since, now)[g.project] || 0 : 0, last = 0;
    for (const s of state.focus?.sessions || []) if (s.project === g.project && s.ended) last = Math.max(last, Date.parse(s.ended));
    for (const t of state.tasks) {
      if (t.project !== g.project) continue;
      for (const h of t.history || []) {
        const ts = Date.parse(h.done);
        if (ts >= since && !h.from_focus) spent += h.actual_min || (t.est_min || state.settings.default_est_min) * factor;
        if (ts > last) last = ts;
      }
    }
    const next = state.tasks.filter(t => t.project === g.project && isAvailable(t, state, today));
    const age = g.created ? (now - Date.parse(g.created)) / 864e5 : Infinity;
    const stalled = age >= STALL_DAYS && last < now - STALL_DAYS * 864e5;
    const shortfall = g.weekly_min ? Math.max(0, 1 - spent / g.weekly_min) : 0;
    return {
      project: g.project,
      ...(g.title ? { title: g.title } : {}),
      ...(g.by ? { by: g.by, days_left: Math.round((Date.parse(g.by.slice(0, 10) + 'T00:00Z') - Date.parse(today + 'T00:00Z')) / 864e5) } : {}),
      ...(g.weekly_min ? { weekly_min: g.weekly_min, spent_7d_min: Math.round(spent), shortfall: +shortfall.toFixed(2) } : { shortfall: 0 }),
      next_actions: next.length,
      last_progress: last ? localParts(last, state.settings.tz).date : null,
      ...(next.length ? {} : { needs_next_action: true }),
      ...(stalled ? { stalled: true } : {}),
    };
  });
}

// ---------- task availability + ATC ranking ----------

export function isAvailable(t, state, today) {
  if (t.status !== 'open') return false;
  if (t.start && t.start.slice(0, 10) > today) return false;
  if (t.blocked_by?.length) {
    const open = t.blocked_by.some(id => state.tasks.find(x => x.id === id && x.status !== 'done' && x.status !== 'dropped'));
    if (open) return false;
  }
  return true;
}

// ---------- shopping lists ----------
// Things to buy live on per-store lists, and each non-empty list ranks as one errand: the
// trip is the task, not each item. A run takes a base trip time plus a little per item,
// takes the most important item's impact, and the earliest need-by date as a soft due.
export const RUN_BASE_MIN = { errands: 10, computer: 5 };
export const RUN_PER_ITEM_MIN = 2;

export function listTasks(state) {
  const s = state.settings;
  return (state.lists || []).filter(l => !l.archived && l.items?.length).map(l => {
    const items = l.items;
    const impactOf = it => ({ consequence: it.consequence || 'annoyance', magnitude: it.magnitude || 1 });
    const best = items.map(impactOf).sort((a, b) => taskWeight({ impact: b, project: l.project }, s) - taskWeight({ impact: a, project: l.project }, s))[0];
    const due = items.map(it => it.need_by).filter(Boolean).sort()[0];
    const names = items.map(it => it.title);
    return {
      id: `l_${l.id}`, list_id: l.id, status: 'open', who: 'me', focus: 'light',
      title: `${l.name}${l.context === 'computer' ? ' order' : ' run'}: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}`,
      est_min: (RUN_BASE_MIN[l.context] ?? 10) + RUN_PER_ITEM_MIN * items.length,
      impact: best, project: l.project || 'Errands & shopping', context: l.context || 'errands',
      ...(due ? { due } : {}),
      created: items.map(it => it.added).sort()[0],
      items: items.map(it => ({ id: it.id, title: it.title, ...(it.note ? { note: it.note } : {}), ...(it.need_by ? { need_by: it.need_by } : {}) })),
    };
  });
}

// ---------- build backlogs ----------
// Each project puts its single top item (building, else the best ready one) into the queue,
// so project work competes with everything else without flooding it. More hits = bigger.
export function buildTasks(state, today) {
  const b = buildState({ ...state, build: state.build || { projects: [], items: [] } });
  const out = [];
  for (const p of b.projects.filter(x => !x.archived)) {
    const open = b.items.filter(it => it.project_id === p.id && ['building', 'ready'].includes(it.stage) && !(it.not_before && it.not_before > today));
    const top = rankItems(open, Date.now(), today)[0];
    if (!top) continue;
    out.push({
      id: `b_${top.id}`, build_id: top.id, status: 'open', who: 'me', focus: 'deep', context: 'computer',
      title: `${p.name}: ${top.title}`, est_min: SIZE_MIN[top.size] || 90,
      impact: { consequence: 'annoyance', magnitude: Math.min(3, Math.max(1, recentHits(top))) },
      project: p.area || p.name, created: top.created,
    });
  }
  return out;
}

// Value per minute plus expected lateness cost:
//   score = (w / p) * (1 + U * P(late if left past today))      (undated: 0)
// w/p is Smith's rule (value per minute), so every task competes on value. A deadline
// only adds pressure in proportion to the real chance of missing it if you don't do it
// today: the probability that the task's lognormal duration exceeds the working minutes
// left before its due date after today, minus dated work due earlier (competing for the
// same hours). Asking "if not today" rather than "right now" makes a task rise the day
// before it's needed instead of once it's already likely late.
// U is how much worse late is than on time (hard vs soft deadline). Far-off dates add
// nothing, which keeps urgency from crowding out important work (mere urgency effect,
// Zhu, Yang & Hsee 2018), while big uncertain tasks start rising early. Working minutes
// use capacity_min_per_day on weekdays and capacity_weekend_min on weekends.
export function rankTasks(state, now = Date.now()) {
  const s = state.settings;
  const lpNow = localParts(now, s.tz);
  const today = lpNow.date;
  const dm = durationModel(state);
  const factor = dm.expected_multiplier;
  const pool = [...state.tasks, ...listTasks(state), ...buildTasks(state, today)].filter(t => t.who !== 'claude' && isAvailable(t, state, today));
  const raw = t => Math.max(5, t.est_min || s.default_est_min);
  const eff = t => raw(t) * factor;

  // Dated work due before each task competes for the same hours (earliest-due-date order).
  // Overdue tasks are left out: they already carry full urgency, and a backlog of missed
  // chores shouldn't make every later deadline look unreachable.
  const ahead = {};
  let cum = 0;
  // Same due time: shorter first, so a quick task isn't charged a long one's hours.
  for (const t of pool.filter(t => t.due).sort((a, b) => (localToEpoch(a.due, s.tz) - localToEpoch(b.due, s.tz)) || (raw(a) - raw(b)))) {
    ahead[t.id] = cum;
    if (localToEpoch(t.due, s.tz) >= now) cum += eff(t);
  }

  const todayLeft = workMinutesBetween(now, localToEpoch(addDays(today, 1) + 'T00:00', s.tz), s);
  const goals = Object.fromEntries(goalStatus(state, now).map(g => [g.project, g]));
  const scored = pool.map(t => {
    const p = eff(t);
    const goal = goals[t.project];
    const goalBoost = goal ? 1 + GOAL_BOOST * goal.shortfall : 1;
    const w = taskWeight(t, s);
    let urgency = 1, slack = null, overdue = false, pLate = 0;
    if (t.due) {
      const dueTs = localToEpoch(t.due, s.tz);
      overdue = dueTs < now;
      const avail = workMinutesBetween(now, dueTs, s) - ahead[t.id];
      slack = avail - p;
      pLate = overdue ? 1 : lateProbability(raw(t), avail - todayLeft, dm);
      const U = t.hard ? s.urgency_hard : s.urgency_soft;
      urgency = 1 + U * pLate;
    }
    const nudge = t.nudge || 1; // manual reorder: a lasting multiplier set when he moves a task
    const pinned = t.pin === today; // "Top" pins a task above everything for the day
    const fit = focusFit(t, lpNow.time, s); // deep work in peak hours, light work outside them
    const score = (w / p) * 60 * urgency * goalBoost * nudge * fit; // value per hour, scaled by deadline, goal, energy and manual pressure
    return { t, score, p, w, slack, urgency, overdue, pLate, goalBoost, nudge, pinned, fit };
  }).sort((a, b) => (b.pinned - a.pinned) || (b.score - a.score));

  // Batch by context when it's nearly free: if the next item is within 15% of the
  // current one and matches the context you were just in, let it go first
  // (attention residue, Leroy 2009).
  const lastCtx = state.meta.last_context;
  if (lastCtx) {
    for (let i = 0; i < scored.length - 1; i++) {
      const a = scored[i], b = scored[i + 1];
      const manual = a.pinned || b.pinned || a.nudge !== 1 || b.nudge !== 1; // never undo a manual move
      if (!manual && a.t.context !== lastCtx && b.t.context === lastCtx && b.score >= 0.85 * a.score) {
        scored[i] = b; scored[i + 1] = a;
      }
    }
  }
  return { scored, factor, today };
}

export function why(x) {
  const i = x.t.impact;
  const head = x.t.priority_override ? `p${x.t.priority_override} (set by you)`
    : i ? `${i.consequence}${i.magnitude ? ['', ', small', ', medium', ', large'][i.magnitude] : ''}${i.reversible === false ? ', irreversible' : ''}`
    : `p${x.t.priority || 4}`;
  const bits = [head, `~${Math.round(x.p)}m`];
  if (x.t.due) {
    if (x.overdue) bits.push('OVERDUE');
    else if (x.pLate >= 0.05) bits.push(`due ${x.t.due}, ${Math.round(x.pLate * 100)}% risk if left past today`);
    else bits.push(`due ${x.t.due}, low risk`);
    if (x.t.hard) bits.push('hard deadline');
  }
  if (x.goalBoost > 1.05) bits.push(`${x.t.project} goal behind`);
  if (x.fit > 1) bits.push(x.t.focus === 'deep' ? 'deep work, peak hours' : 'light task, off-peak');
  else if (x.fit < 1) bits.push(x.t.focus === 'deep' ? 'deep work, better in peak hours' : 'light task, saved for off-peak');
  if (x.pinned) bits.push('pinned to top today');
  else if (x.nudge > 1.01) bits.push('moved up by you');
  else if (x.nudge < 0.99) bits.push('moved down by you');
  return bits.join(', ');
}

// ---------- habits ----------

// h.dates overrides the weekly pattern for single days: "HH:MM" schedules it that day at that
// time, false takes that day off (the class booker moves lift habits this way).
export function scheduledOn(h, dateStr) {
  if (dateStr < (h.start_date || '0000')) return false;
  const o = h.dates?.[dateStr];
  if (o !== undefined) return !!o;
  const days = h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
  return days.includes(dowOf(dateStr));
}

// A habit or routine can be snoozed to a later time today, or skipped for the day.
// A skip is an excused day (sick, travelling): not a miss, and left out of the rate.
export function effectiveTime(x, today) {
  if (x.snooze?.date === today) return x.snooze.until;
  return typeof x.dates?.[today] === 'string' ? x.dates[today] : x.time;
}

// Merge date overrides (null clears one) and drop those more than two weeks old.
export function mergeDates(current, changes, today) {
  const out = { ...(current || {}) };
  for (const [d, v] of Object.entries(changes || {})) {
    if (!/^\d{4}-\d\d-\d\d$/.test(d)) throw new Error(`dates: bad date ${d}`);
    if (v === null) delete out[d];
    else if (v === false || /^\d\d:\d\d$/.test(v)) out[d] = v;
    else throw new Error(`dates: ${d} must be HH:MM, false or null`);
  }
  for (const d of Object.keys(out)) if (d < addDays(today, -14)) delete out[d];
  return out;
}

export function habitStatus(h, today) {
  const doneToday = !!h.log?.[today]?.done;
  const skippedToday = !!h.log?.[today]?.skipped;
  let prev = null;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, -i);
    if (d < (h.start_date || '0000')) break;
    if (scheduledOn(h, d)) { prev = d; break; }
  }
  const missedLast = prev ? !(h.log?.[prev]?.done || h.log?.[prev]?.skipped) : false;

  let scheduled = 0, done = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, -i);
    if (d < (h.start_date || '0000')) break;
    if (i === 0 && !doneToday) continue; // today isn't a miss yet
    if (scheduledOn(h, d) && !h.log?.[d]?.skipped) { scheduled++; if (h.log?.[d]?.done) done++; }
  }
  const lastSrbai = h.srbai?.at(-1);
  const ageDays = h.start_date ? Math.round((localToEpoch(today, 'UTC') - localToEpoch(h.start_date, 'UTC')) / 864e5) : 0;
  const srbaiDue = ageDays >= 7 && (!lastSrbai || addDays(lastSrbai.date, 7) <= today);
  return {
    due_today: scheduledOn(h, today) && !doneToday && !skippedToday,
    done_today: doneToday,
    skipped_today: skippedToday,
    dont_miss_twice: scheduledOn(h, today) && !doneToday && !skippedToday && missedLast,
    rate_28d: scheduled ? +(done / scheduled).toFixed(2) : null,
    automaticity: lastSrbai ? { date: lastSrbai.date, score: lastSrbai.mean } : null,
    automaticity_check_due: srbaiDue,
    days_since_start: ageDays,
  };
}

// ---------- routines ----------
// A day's log keys ticks by step id ('done' or 'skip'), so reordering or editing steps never
// moves a check-off onto a different step. A step can wait on an earlier one
// (not_before: {after_step, min}); while that gap is running it isn't offered as next, and
// steps without a gate fill the wait. Gates only reorder suggestions, never block a check-off.
// A step or temp note in effect on a day (from/until dates; see lib/steps.js).
export const activeOn = (x, day) => !(x.from && day < x.from) && !(x.until && day > x.until);

// A trial step's off day (lib/steps.js trialDay, inlined to keep this module standalone):
// alternating blocks from metric.trial.start, even blocks on.
function trialOff(st, day) {
  const t = st.metric?.trial;
  if (!t?.start || day < t.start || (t.end && day > t.end)) return false;
  const k = Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(t.start + 'T00:00:00Z')) / 864e5);
  return Math.floor(k / (t.block_days || 14)) % 2 === 1;
}

export function routineStatus(r, today, now = Date.now(), tz = 'UTC') {
  const scheduled = scheduledOn(r, today);
  const entry = r.log?.[today];
  const ticks = entry?.ticks || {}, at = entry?.at || {};
  // Steps outside their from/until window don't exist that day; index stays the step's place in r.steps.
  const steps = r.steps.map((st, i) => [st, i]).filter(([st]) => activeOn(st, today)).map(([st, i]) => {
    const tick = ticks[st.id];
    // Short day: only core steps are asked for; the rest count as excused skips.
    const shortSkip = !tick && entry?.short && !st.core;
    const x = { ...st, index: i, done: tick === 'done', skipped: tick === 'skip' || shortSkip, ...(shortSkip ? { short_skip: true } : {}),
      ...(st.metric ? { scored: entry?.values?.[st.id] != null } : {}), ...(trialOff(st, today) ? { trial_off: true } : {}) };
    const g = st.not_before;
    if (!tick && g?.after_step && ticks[g.after_step] === 'done' && at[g.after_step]) {
      const ready = Date.parse(at[g.after_step]) + (g.min || 0) * 60000;
      if (ready > now) { x.ready_ts = ready; x.wait_until = localParts(ready, tz).time; }
    }
    return x;
  });
  const open = steps.filter(x => !x.done && !x.skipped);
  const resolved = steps.length > 0 && !open.length;
  const next = open.find(x => !x.ready_ts) || [...open].sort((a, b) => a.ready_ts - b.ready_ts)[0] || null;
  return {
    scheduled,
    done: !!entry?.done || (resolved && steps.some(x => x.done)),
    skipped: !!entry?.skipped || (resolved && !steps.some(x => x.done)),
    steps,
    next_step: next,
  };
}

// Steps that keep getting skipped, or where the routine stalls (the first step left undone
// on a day it was started but not finished), over the last two weeks. Short days don't count
// against non-core steps, and fully skipped or away days don't count at all.
export function routineFriction(r, today, days = 14, min = 3) {
  const counts = Object.fromEntries(r.steps.map(st => [st.id, { skips: 0, stalls: 0 }]));
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    const e = r.log?.[d];
    if (!e || e.skipped || !scheduledOn(r, d)) continue;
    const ticks = e.ticks || {};
    const live = r.steps.filter(st => activeOn(st, d) && !trialOff(st, d)); // planned skips aren't friction
    for (const st of live) if (ticks[st.id] === 'skip') counts[st.id].skips++;
    const started = Object.values(ticks).includes('done');
    if (started && !e.done) {
      const stall = live.find(st => !ticks[st.id] && !(e.short && !st.core));
      if (stall) counts[stall.id].stalls++;
    }
  }
  return r.steps.map(st => ({ step_id: st.id, title: st.title, ...counts[st.id] }))
    .filter(x => x.skips + x.stalls >= min);
}

// Working days after a date (Sat/Sun don't count): a wait started Thursday + 3 = Tuesday.
export function addBusinessDays(dateStr, n) {
  let d = dateStr;
  for (let k = 0; k < n;) { d = addDays(d, 1); const w = dowOf(d); if (w !== 0 && w !== 6) k++; }
  return d;
}

// ---------- backlog hygiene ----------
// Obligations (real consequences) get shrunk to a first step when they keep getting skipped;
// wishes get parked. Tasks without impact tags are neither: they're never parked.
export const OBLIGATION = new Set(['money', 'legal', 'health', 'career']);
export const WISH = new Set(['none', 'annoyance']);
export const STRIKES = 3;
export const PARK_AFTER_DAYS = 14;
export const isObligation = t => OBLIGATION.has(t.impact?.consequence);
export const isWish = t => WISH.has(t.impact?.consequence);

// Last time Nick did anything with a task: created, edited, rescheduled, moved, checked off.
export function lastTouch(t) {
  return Math.max(Date.parse(t.created || 0) || 0, Date.parse(t.updated || 0) || 0, ...(t.history || []).map(h => Date.parse(h.done) || 0));
}

// ---------- bedtime ----------
// settings.bedtime = { time: 'HH:MM', wind_down_min }. A time before noon counts as after
// midnight, so the evening it belongs to started the day before. The night routine is the one
// named like "night" or "bed"; it's what winding down means.
export function nightRoutine(state) {
  return state.routines.find(r => !r.archived && /night|bed/i.test(r.name)) || null;
}
export function bedtimeStatus(state, now = Date.now()) {
  const s = state.settings, b = s.bedtime;
  if (!b?.time) return null;
  const lp = localParts(now, s.tz);
  const evening = lp.time < '12:00' ? addDays(lp.date, -1) : lp.date;
  const bedDate = b.time < '12:00' ? addDays(evening, 1) : evening;
  const bedAt = localToEpoch(`${bedDate}T${b.time}`, s.tz);
  const windMin = b.wind_down_min ?? 60;
  const windAt = bedAt - windMin * 60000;
  const r = nightRoutine(state);
  const st = r ? routineStatus(r, evening, now, s.tz) : null;
  const base = { evening, time: b.time, wind_down_at: localParts(windAt, s.tz).time, bed_at: bedAt, wind_at: windAt,
    ...(r ? { routine_id: r.id, routine_done: !!(st.done || st.skipped) } : {}) };
  if (now < windAt || now > bedAt + 6 * 3600e3) return { ...base, phase: null };
  if (now < bedAt) return { ...base, phase: 'wind_down', min_left: Math.ceil((bedAt - now) / 60000) };
  return { ...base, phase: 'past', min_over: Math.floor((now - bedAt) / 60000) };
}
