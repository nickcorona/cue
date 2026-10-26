// Push notifications to the installed app. Each ping is a message on a Vercel Queue delayed
// to the exact minute it's due; when it arrives (api/push-fire.js) we re-check that it still
// matters (the step isn't done, the habit is still open) and only then push. So nothing
// needs cancelling: a stale message just finds nothing to say. No per-minute polling, which
// keeps storage reads low.
import webpush from 'web-push';
import { send } from '@vercel/queue';
import { planOccurrences } from './mood.js';
import { localParts, localToEpoch, addDays, routineStatus, habitStatus, scheduledOn, effectiveTime, bedtimeStatus, nightRoutine } from './logic.js';

export const TOPIC = 'cue-push';
export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const prefs = s => ({ gates: true, times: false, dont_miss_twice: true, nudge_time: '20:30', bedtime: true, mood: false, ...(s.push || {}) });
export const MOOD_EVERY_H = 2;

// Queue a ping for epoch ms `at`. The key dedupes repeat schedules of the same ping.
export async function schedulePing(key, at, data = {}) {
  if (!pushReady()) return false;
  const delay = Math.max(0, Math.round((at - Date.now()) / 1000));
  if (delay > 604800) return false;
  await send(TOPIC, { key, at, ...data }, {
    idempotencyKey: `${key}@${at}`,
    delaySeconds: delay,
    retentionSeconds: Math.min(604800, Math.max(86400, delay + 3600)),
  });
  return true;
}

// Everything worth pinging today that can be scheduled ahead: timed routines and habits (if
// on), the evening don't-miss-twice check, tonight's wind-down and bedtime (if set), and
// tomorrow's 6am wake-up that keeps the chain going even on a day nobody opens Cue.
export function dayPlan(state, now = Date.now()) {
  const s = state.settings, p = prefs(s);
  const today = localParts(now, s.tz).date;
  const at = hm => localToEpoch(`${today}T${hm}`, s.tz);
  const out = [];
  if (p.times) {
    for (const x of [...state.routines, ...state.habits]) {
      const t = !x.archived && scheduledOn(x, today) && effectiveTime(x, today);
      if (t && at(t) > now) out.push({ key: `time:${x.id}:${today}:${t}`, at: at(t) });
    }
  }
  if (p.dont_miss_twice && at(p.nudge_time) > now) out.push({ key: `dmt:${today}`, at: at(p.nudge_time) });
  // Tonight is the evening of `today`, so plan from noon even when this runs at 6am.
  const bed = p.bedtime && bedtimeStatus(state, localToEpoch(`${today}T12:00`, s.tz));
  if (bed) {
    if (bed.wind_at > now) out.push({ key: `bed:${today}:wind`, at: bed.wind_at });
    if (bed.bed_at > now) out.push({ key: `bed:${today}:now`, at: bed.bed_at });
  }
  // Mood check-ins: every 2 hours from 2h after wake until an hour before bed (23:00 if unset).
  if (p.mood) {
    const first = at(s.wake || '07:00') + MOOD_EVERY_H * 3600e3;
    const bedAt = (bed || bedtimeStatus(state, localToEpoch(`${today}T12:00`, s.tz)))?.bed_at;
    const last = (bedAt || at('23:00')) - 3600e3;
    for (let t = first; t <= last; t += MOOD_EVERY_H * 3600e3) {
      if (t > now) out.push({ key: `mood:${today}:${localParts(t, s.tz).time.replace(':', '')}`, at: t });
    }
  }
  // Planned activities (Mood): today's task plans and habit plans, at their time.
  for (const pl of state.mood?.plans || []) {
    const o = planOccurrences(state, pl, { from: today, today, tz: s.tz })[0];
    if (o?.status === 'upcoming' && at(pl.time) > now) out.push({ key: `plan:${pl.id}:${today}`, at: at(pl.time) });
  }
  out.push({ key: `day:${addDays(today, 1)}`, at: localToEpoch(`${addDays(today, 1)}T06:00`, s.tz) });
  return out;
}

// What a ping should say right now, or null if it no longer applies. `check` (a check_off
// item) gives the notification a Done button that ticks it without opening the app.
export function pingContent(state, key, now = Date.now(), msg = null) {
  const s = state.settings, p = prefs(s);
  const today = localParts(now, s.tz).date;
  const [kind, id, date, ...rest] = key.split(':');
  const extra = rest.join(':'); // a step id, or an HH:MM time (which has its own colon)
  if (kind === 'gate' && p.gates) {
    const r = state.routines.find(x => x.id === id);
    if (!r || date !== today) return null;
    const st = routineStatus(r, today, now, s.tz);
    const step = st.steps.find(x => x.id === extra);
    if (!step || step.done || step.skipped || st.done || st.skipped) return null;
    return { title: `Ready: ${step.title}`, body: `${r.name} · the wait is over`, tag: key, check: { kind: 'routine_step', id: r.id, step_id: step.id, date: today } };
  }
  // time: a routine or habit's set time (if times are on); snooze: the time he moved it to.
  if ((kind === 'time' && p.times || kind === 'snooze') && date === today) {
    const x = state.routines.find(y => y.id === id) || state.habits.find(y => y.id === id);
    if (kind === 'time' && x?.snooze?.date === today) return null; // the snooze ping covers it
    const r = state.routines.find(x => x.id === id);
    if (r) {
      const st = routineStatus(r, today, now, s.tz);
      if (st.done || st.skipped || effectiveTime(r, today) !== extra) return null;
      return { title: r.name, body: st.next_step ? `Next: ${st.next_step.title}` : 'Time to start', tag: key };
    }
    const h = state.habits.find(x => x.id === id);
    if (!h || !habitStatus(h, today).due_today || effectiveTime(h, today) !== extra) return null;
    return { title: h.name, body: `After I ${h.cue || '...'}, I will ${h.behavior || h.name}`, tag: key, check: { kind: 'habit', id: h.id, date: today } };
  }
  if (kind === 'dmt' && p.dont_miss_twice && id === today) {
    const flagged = state.habits.filter(h => !h.archived && habitStatus(h, today).dont_miss_twice);
    if (!flagged.length) return null;
    return { title: "Don't miss twice", body: `${flagged.map(h => h.name).join(', ')}: missed yesterday. The small version tonight keeps it alive.`, tag: key };
  }
  // bed:<evening>:wind|now: start winding down (unless the night routine is already done), then bed.
  if (kind === 'bed' && p.bedtime) {
    const b = bedtimeStatus(state, now);
    if (!b || b.evening !== id) return null;
    const r = nightRoutine(state), st = r && routineStatus(r, id, now, s.tz);
    if (date === 'wind') {
      if (b.routine_done) return null;
      return { title: 'Wind down', body: `Bed at ${b.time}.` + (st?.next_step ? ` ${r.name}: ${st.next_step.title}` : ''), tag: 'cue-bed' };
    }
    if (date === 'now') {
      const left = st && !b.routine_done ? st.steps.filter(x => !x.done && !x.skipped).length : 0;
      return { title: 'Bedtime', body: left ? `${left} night routine step${left > 1 ? 's' : ''} left. Core only, then lights out.` : 'Phone down, lights out.', tag: 'cue-bed' };
    }
    return null;
  }
  // rest:<session>:<sets logged>: rest after a set is over, unless he's already logged another.
  if (kind === 'rest') {
    const sess = state.lift?.sessions?.find(x => x.id === id);
    if (!sess || sess.finished || String(sess.sets.length) !== date) return null;
    return { title: 'Rest over', body: `Next: ${msg?.next || 'your next set'}`, tag: 'cue-rest' };
  }
  // focus:<session>:<end ms>: the block ran out (still running, not paused or extended).
  if (kind === 'focus') {
    const sess = state.focus?.sessions?.find(x => x.id === id);
    if (!sess || sess.ended || sess.paused_at) return null;
    const end = Date.parse(sess.started) + (sess.paused_ms || 0) + sess.planned_min * 60000;
    if (Math.abs(end - Number(date)) > 2000) return null;
    return { title: 'Focus block done', body: `${sess.title} · log how it went`, tag: 'cue-focus' };
  }
  if (kind === 'break') {
    const b = state.focus?.brk;
    if (!b || String(b.until) !== date || state.focus.sessions.some(x => !x.ended)) return null;
    const sess = state.focus.sessions.find(x => x.id === id);
    return { title: 'Break over', body: sess ? `Back to: ${sess.title}` : 'Back to it', tag: 'cue-focus' };
  }
  // cook:<cook>:<end ms>: a kitchen timer ran out (and wasn't cancelled or the cook finished).
  if (kind === 'cook') {
    const c = state.cook?.cooks?.find(x => x.id === id);
    const t = c && !c.finished && c.timers.find(x => String(Date.parse(x.ends)) === date);
    if (!t) return null;
    return { title: 'Timer done', body: t.label, tag: `cue-cook-${date}` };
  }
  // mood:<date>:<HHMM>: a check-in, unless he logged one in the last hour.
  if (kind === 'mood' && p.mood && id === today) {
    if ((state.mood?.entries || []).some(e => now - Date.parse(e.at) < 3600e3)) return null;
    return { title: 'What are you doing?', body: 'Mood 0-10. Tap to log it.', tag: 'cue-mood', url: '/?mood=1' };
  }
  // plan:<plan>:<date>: a planned activity is due, unless it's done, rated or no longer planned.
  if (kind === 'plan' && id && date === today) {
    const pl = state.mood?.plans?.find(x => x.id === id);
    const o = pl && planOccurrences(state, pl, { from: today, today, tz: s.tz })[0];
    if (!o || o.status !== 'upcoming' || o.rated) return null;
    return { title: `Planned: ${pl.activity}`, body: `You predicted ${pl.predicted.mood}/10. Tap to rate it when you're done.`, tag: key, url: `/mood?plan=${pl.id}` };
  }
  if (kind === 'test') return { title: 'Cue notifications are on', body: 'Wait timers and nudges will show up here.', tag: 'test' };
  return null;
}

// Push to every subscribed device; returns endpoints that are gone so the caller can drop them,
// and why any other send failed (a bad VAPID key or payload shows up here, not as silence).
export async function pushAll(state, msg) {
  if (!pushReady()) return { sent: 0, gone: [], errors: [] };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:cue@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const gone = [], errors = [];
  let sent = 0;
  for (const sub of state.push?.subs || []) {
    try { await webpush.sendNotification(sub, JSON.stringify({ url: '/', ...msg }), { TTL: 3600 }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) gone.push(sub.endpoint);
      else errors.push(`${e.statusCode || 'error'} ${String(e.body || e.message || '').slice(0, 160)}`.trim());
    }
  }
  return { sent, gone, errors };
}
