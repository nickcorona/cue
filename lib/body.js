// Body stats from the scale repo (nickcorona/scale): its GitHub Action posts the recent
// weigh-ins, the Kalman model's latest estimate and the cut plan after each sync. Home shows
// one line from them: the trend weight, not the day's weigh-in, which swings a pound or two on
// water and salt; how it moved over the week; and where it sits against the plan.
import { localParts } from './logic.js';

const DAY = 86400e3;
const ALPHA = 0.1; // per day, as in the Hacker's Diet trend: about a 10-day memory

// Trend weight by day: one value per day with a weigh-in (that day's mean), each pulling the
// trend 10% per day elapsed toward it, so a gap of several days moves it further.
export function trend(weighins, tz) {
  const days = new Map();
  for (const w of weighins) {
    const lb = +w.lb;
    const t = Date.parse(w.at);
    if (!(lb > 50 && lb < 600) || !Number.isFinite(t)) continue;
    const d = localParts(t, tz).date;
    days.set(d, [...(days.get(d) || []), lb]);
  }
  const out = [];
  let prev = null;
  for (const d of [...days.keys()].sort()) {
    const lb = days.get(d).reduce((a, b) => a + b, 0) / days.get(d).length;
    if (!prev) { out.push({ date: d, lb, trend: lb }); prev = out[0]; continue; }
    const gap = Math.max(1, Math.round((Date.parse(d) - Date.parse(prev.date)) / DAY));
    const tr = prev.trend + (1 - (1 - ALPHA) ** gap) * (lb - prev.trend);
    prev = { date: d, lb, trend: tr };
    out.push(prev);
  }
  return out;
}

// The plan's target for a date: weekly targets, straight-line between them.
export function planTarget(plan, date) {
  const rows = (plan || []).filter(r => r.date && Number.isFinite(+r.target_lb)).sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length || date < rows[0].date) return null;
  for (let i = 1; i < rows.length; i++) {
    if (date <= rows[i].date) {
      const a = rows[i - 1], b = rows[i];
      const f = (Date.parse(date) - Date.parse(a.date)) / (Date.parse(b.date) - Date.parse(a.date));
      return +a.target_lb + f * (+b.target_lb - +a.target_lb);
    }
  }
  return +rows[rows.length - 1].target_lb;
}

export function bodySummary(state, now = Date.now()) {
  const b = state.body;
  if (!b?.weighins?.length) return null;
  const tz = state.settings.tz;
  // The scale model's own trend (fat + dry lean, water swing taken out) when it sent one: it
  // has no lag. Otherwise a plain moving average of the weigh-ins, which trails a cut by a
  // pound or two.
  const raw = trend(b.weighins, tz);
  if (!raw.length) return null;
  const model = (b.trend || []).map(x => ({ date: x.date, trend: x.lb }));
  const tr = model.length ? model : raw;
  const last = { ...tr[tr.length - 1], lb: raw[raw.length - 1].lb };
  if (raw[raw.length - 1].date > last.date) last.date = raw[raw.length - 1].date;
  const today = localParts(now, tz).date;
  // Stale data says nothing about now: after two weeks without a weigh-in, show nothing.
  if (Date.parse(today) - Date.parse(last.date) > 14 * DAY) return null;
  // The week's move: today's trend against the trend as it stood 7 days before the last weigh-in.
  const weekAgo = new Date(Date.parse(last.date) - 7 * DAY).toISOString().slice(0, 10);
  const before = [...tr].reverse().find(x => x.date <= weekAgo);
  const week = before ? last.trend - before.trend : null;
  const target = planTarget(b.plan, last.date);
  const vsPlan = target == null ? null : last.trend - target;
  const est = b.estimate || {};
  return {
    trend_lb: +last.trend.toFixed(1), last_weighin: { date: last.date, lb: +last.lb.toFixed(1) },
    week_lb: week == null ? null : +week.toFixed(1), plan_lb: target == null ? null : +target.toFixed(1),
    vs_plan_lb: vsPlan == null ? null : +vsPlan.toFixed(1),
    bf: Number.isFinite(+est.bf) ? +(+est.bf).toFixed(1) : null, bf_sd: Number.isFinite(+est.bf_sd) ? +(+est.bf_sd).toFixed(1) : null,
    line: bodyLine(last.trend, week, vsPlan, +est.bf),
    short: bodyShort(last.trend, week, vsPlan),
  };
}

// "214.9 lb · −1.6 this week · 0.8 under plan · 21% fat"
// Cue Home's version: one phone-width line, so no body fat and short words.
const sign = x => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);

export function bodyShort(tr, week, vsPlan) {
  return [`${tr.toFixed(1)} lb`, week == null ? null : `${sign(week)}/wk`,
    vsPlan == null ? null : Math.abs(vsPlan) < 0.5 ? 'on plan' : `${sign(vsPlan)} vs plan`].filter(Boolean).join('  ·  ');
}

export function bodyLine(tr, week, vsPlan, bf) {
  return [
    `${tr.toFixed(1)} lb`,
    week == null ? null : `${sign(week)} this week`,
    vsPlan == null ? null : Math.abs(vsPlan) < 0.5 ? 'on plan' : `${Math.abs(vsPlan).toFixed(1)} ${vsPlan < 0 ? 'under' : 'over'} plan`,
    Number.isFinite(bf) ? `${Math.round(bf)}% fat` : null,
  ].filter(Boolean).join('  ·  ');
}

// What the scale repo sends, checked and trimmed: weigh-ins from the last 120 days, the model's
// latest estimate and daily trend, and the plan.
export function cleanBody(input, now = Date.now()) {
  const since = now - 120 * DAY;
  const weighins = (Array.isArray(input?.weighins) ? input.weighins : [])
    .map(w => ({ at: String(w.at || ''), lb: +w.lb }))
    .filter(w => Number.isFinite(Date.parse(w.at)) && Date.parse(w.at) >= since && w.lb > 50 && w.lb < 600)
    .slice(-500);
  const e = input?.estimate || {};
  const num = x => (Number.isFinite(+x) && x !== null && x !== '' ? +(+x).toFixed(2) : null);
  const estimate = /^\d{4}-\d{2}-\d{2}/.test(e.date || '') ? { date: String(e.date).slice(0, 10), fat_lb: num(e.fat_lb), lean_lb: num(e.lean_lb), bf: num(e.bf), bf_sd: num(e.bf_sd) } : null;
  const plan = (Array.isArray(input?.plan) ? input.plan : []).slice(0, 200)
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r?.date || '') && Number.isFinite(+r.target_lb))
    .map(r => ({ date: r.date, target_lb: +r.target_lb }));
  const trend = (Array.isArray(input?.trend) ? input.trend : []).slice(-60)
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r?.date || '') && +r.lb > 50 && +r.lb < 600)
    .map(r => ({ date: r.date, lb: +(+r.lb).toFixed(2) }));
  return { weighins, estimate, trend, plan, at: new Date(now).toISOString() };
}
