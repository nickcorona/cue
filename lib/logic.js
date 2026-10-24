// Ranking, habit and routine logic. Pure functions over the state object.

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

// ---------- capacity ----------

// Focused task minutes available on a given local date (weekends can differ).
export function capacityOn(dateStr, s) {
  const dow = dowOf(dateStr);
  const weekend = dow === 0 || dow === 6;
  return weekend && s.capacity_weekend_min != null ? s.capacity_weekend_min : s.capacity_min_per_day;
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
  };
}

// ---------- goal minimums ----------
// A goal guarantees a project some time each week. Minutes are what actually got done in
// the last 7 days (reported actual time, else the corrected estimate). While a goal is
// behind, its tasks get boosted in proportion to the shortfall, which counters the
// short-task bias of value-per-minute ranking for important undated work.
export const GOAL_BOOST = 4; // max multiplier is 1 + GOAL_BOOST when nothing was done

export function goalStatus(state, now = Date.now()) {
  const factor = durationModel(state).expected_multiplier;
  const since = now - 7 * 864e5;
  return (state.goals || []).filter(g => !g.archived).map(g => {
    let spent = 0;
    for (const t of state.tasks) {
      if (t.project !== g.project) continue;
      for (const h of t.history || []) {
        if (Date.parse(h.done) >= since) spent += h.actual_min || (t.est_min || state.settings.default_est_min) * factor;
      }
    }
    const shortfall = Math.max(0, 1 - spent / g.weekly_min);
    return { project: g.project, weekly_min: g.weekly_min, spent_7d_min: Math.round(spent), shortfall: +shortfall.toFixed(2) };
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

// Apparent Tardiness Cost (Vepsalainen & Morton 1987), adapted for one person.
//   score = (w / p) * (1 + U * exp(-max(slack, 0) / (k * pbar)))      (undated: U = 0)
// w/p is Smith's rule (value per minute). Every task competes on value; a due date only
// adds a boost once its slack runs low, so far-off dates don't crowd out important
// work (mere urgency effect, Zhu, Yang & Hsee 2018). Tasks that can't be done yet
// should use start, not a low score. Slack is measured in *your* working minutes
// (capacity_min_per_day on weekdays, capacity_weekend_min on weekends), not wall-clock minutes.
export function rankTasks(state, now = Date.now()) {
  const s = state.settings;
  const today = localParts(now, s.tz).date;
  const dm = durationModel(state);
  const factor = dm.expected_multiplier;
  const pool = state.tasks.filter(t => t.who !== 'claude' && isAvailable(t, state, today));
  const eff = t => Math.max(5, t.est_min || s.default_est_min) * factor;
  const pbar = pool.length ? pool.reduce((a, t) => a + eff(t), 0) / pool.length : s.default_est_min * factor;

  const goals = Object.fromEntries(goalStatus(state, now).map(g => [g.project, g]));
  const scored = pool.map(t => {
    const p = eff(t);
    const goal = goals[t.project];
    const goalBoost = goal ? 1 + GOAL_BOOST * goal.shortfall : 1;
    const w = taskWeight(t, s);
    let urgency = 1, slack = null, overdue = false;
    if (t.due) {
      const dueTs = localToEpoch(t.due, s.tz);
      overdue = dueTs < now;
      slack = workMinutesBetween(now, dueTs, s) - p;
      const U = t.hard ? s.urgency_hard : s.urgency_soft;
      urgency = 1 + U * Math.exp(-Math.max(slack, 0) / (s.k * pbar));
    }
    const score = (w / p) * 60 * urgency * goalBoost; // value per hour, scaled by deadline and goal pressure
    return { t, score, p, w, slack, urgency, overdue, goalBoost };
  }).sort((a, b) => b.score - a.score);

  // Batch by context when it's nearly free: if the next item is within 15% of the
  // current one and matches the context you were just in, let it go first
  // (attention residue, Leroy 2009).
  const lastCtx = state.meta.last_context;
  if (lastCtx) {
    for (let i = 0; i < scored.length - 1; i++) {
      const a = scored[i], b = scored[i + 1];
      if (a.t.context !== lastCtx && b.t.context === lastCtx && b.score >= 0.85 * a.score) {
        scored[i] = b; scored[i + 1] = a;
      }
    }
  }
  return { scored, factor, pbar, today };
}

export function why(x) {
  const i = x.t.impact;
  const head = x.t.priority_override ? `p${x.t.priority_override} (set by you)`
    : i ? `${i.consequence}${i.magnitude ? ['', ', small', ', medium', ', large'][i.magnitude] : ''}${i.reversible === false ? ', irreversible' : ''}`
    : `p${x.t.priority || 4}`;
  const bits = [head, `~${Math.round(x.p)}m`];
  if (x.t.due) {
    if (x.overdue) bits.push('OVERDUE');
    else if (x.urgency > 2) bits.push(`due ${x.t.due}, slack tight`);
    else if (x.urgency < 1.05) bits.push(`due ${x.t.due}, not urgent yet`);
    else bits.push(`due ${x.t.due}`);
    if (x.t.hard) bits.push('hard deadline');
  }
  if (x.goalBoost > 1.05) bits.push(`${x.t.project} goal behind`);
  return bits.join(', ');
}

// ---------- habits ----------

export function scheduledOn(h, dateStr) {
  const days = h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
  return days.includes(dowOf(dateStr)) && dateStr >= (h.start_date || '0000');
}

export function habitStatus(h, today) {
  const doneToday = !!h.log?.[today]?.done;
  let prev = null;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, -i);
    if (d < (h.start_date || '0000')) break;
    if (scheduledOn(h, d)) { prev = d; break; }
  }
  const missedLast = prev ? !h.log?.[prev]?.done : false;

  let scheduled = 0, done = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, -i);
    if (d < (h.start_date || '0000')) break;
    if (i === 0 && !doneToday) continue; // today isn't a miss yet
    if (scheduledOn(h, d)) { scheduled++; if (h.log?.[d]?.done) done++; }
  }
  const lastSrbai = h.srbai?.at(-1);
  const ageDays = h.start_date ? Math.round((localToEpoch(today, 'UTC') - localToEpoch(h.start_date, 'UTC')) / 864e5) : 0;
  const srbaiDue = ageDays >= 7 && (!lastSrbai || addDays(lastSrbai.date, 7) <= today);
  return {
    due_today: scheduledOn(h, today) && !doneToday,
    done_today: doneToday,
    dont_miss_twice: scheduledOn(h, today) && !doneToday && missedLast,
    rate_28d: scheduled ? +(done / scheduled).toFixed(2) : null,
    automaticity: lastSrbai ? { date: lastSrbai.date, score: lastSrbai.mean } : null,
    automaticity_check_due: srbaiDue,
    days_since_start: ageDays,
  };
}

// ---------- routines ----------

export function routineStatus(r, today) {
  const scheduled = scheduledOn(r, today);
  const entry = r.log?.[today];
  const steps = r.steps.map((st, i) => ({ ...st, index: i, done: !!entry?.steps?.[i] }));
  const done = !!entry?.done || (steps.length > 0 && steps.every(x => x.done));
  return { scheduled, done, steps, next_step: steps.find(x => !x.done) || null };
}
