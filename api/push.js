// Push subscription management for the installed app (signed-in cookie or /push?key=).
import { authorized } from './mcp.js';
import { read, mutate } from '../lib/store.js';
import { pushAll, pingContent, schedulePing, pushReady, dayPlan, nowContent, idlePing } from '../lib/push.js';
import { localParts, rankTasks, routineStatus } from '../lib/logic.js';
import { todayView } from '../lib/today.js';
import { callTool, lastDone } from '../lib/tools.js';
import { upcoming } from '../lib/calendar.js';

// The next Now item after a Done, Start or Not now: one read, and the idle check re-armed in
// parallel. This is the slow part of a button tap, so it skips recording now_last (a stale
// value only costs a duplicate quiet refresh later).
async function nextNow({ active = false } = {}) {
  const state = await read();
  const ping = active && idlePing(state);
  if (ping) await schedulePing(ping.key, ping.at).catch(e => console.error('idle ping failed', e.message));
  return nowContent(state, Date.now(), { loud: false });
}

// Today's list for the widget: what's left in order, then how many are done.
export function widgetData(state, now = Date.now()) {
  const day = todayView(state, now);
  const titles = new Map(rankTasks(state, now).scored.map(x => [x.t.id, x.t]));
  const today = day.show.map(id => titles.get(id)).filter(Boolean).slice(0, 5)
    .map(t => ({ id: t.id, title: t.title, est_min: t.est_min || state.settings.default_est_min || 15 }));
  // Routines put off with Later (Not now) today, so Cue Home can offer to resume them
  // instead of letting them vanish.
  const tz = state.settings.tz, date = localParts(now, tz).date;
  const hidden = state.push?.now_skip?.date === date ? state.push.now_skip.keys : [];
  const paused = state.routines.filter(r => !r.archived && hidden.some(k => k.startsWith(`step:${r.id}:`))).map(r => {
    const st = routineStatus(r, date, now, tz);
    if (!st.scheduled || st.done || st.skipped) return null;
    return { id: r.id, name: r.name, done: st.steps.filter(x => x.done || x.skipped).length, total: st.steps.length };
  }).filter(Boolean);
  // last_done lets Cue Home offer Undo for a mis-tap, like the queue's Undo row. after_done is
  // what Now would show once the current item is ticked, so Home can move on the moment Done
  // is tapped instead of waiting on the save; the reply corrects it if anything differs.
  const current = nowContent(state, now, { loud: false });
  return { now: current, after_done: afterDone(state, current, now), after_skip: afterSkip(state, current, now), today, done: day.done, total: day.total, mode: day.mode, last_done: lastDone(state, now), paused, at: now };
}

// Now after ticking `current` on a copy of the state (a step, a habit, or a task), or
// undefined when that can't be predicted (focus blocks, nothing up).
export function afterDone(state, current, now = Date.now()) {
  const c = current?.check;
  if (!c || !['routine_step', 'habit', 'task'].includes(c.kind)) return undefined;
  const s = structuredClone(state), iso = new Date(now).toISOString();
  const date = c.date || localParts(now, s.settings.tz).date;
  if (c.kind === 'routine_step') {
    const r = s.routines.find(x => x.id === c.id);
    if (!r) return undefined;
    const e = ((r.log ||= {})[date] ||= {});
    (e.ticks ||= {})[c.step_id] = 'done';
    (e.at ||= {})[c.step_id] = iso;
  } else if (c.kind === 'habit') {
    const h = s.habits.find(x => x.id === c.id);
    if (!h) return undefined;
    (h.log ||= {})[date] = { done: true, at: iso };
  } else {
    const t = s.tasks.find(x => x.id === c.id);
    if (!t) return undefined;
    t.status = 'done';
    t.history = (t.history || []).concat({ done: iso });
  }
  return nowContent(s, now, { loud: false }) || null;
}

// Now after Not now on `current` (hidden for the rest of the day), so Home moves on at once too.
export function afterSkip(state, current, now = Date.now()) {
  if (!current?.skip) return undefined;
  const s = structuredClone(state), today = localParts(now, s.settings.tz).date;
  s.push ||= { subs: [], sent: {} };
  if (s.push.now_skip?.date !== today) s.push.now_skip = { date: today, keys: [] };
  s.push.now_skip.keys.push(current.skip);
  return nowContent(s, now, { loud: false }) || null;
}

function cookieKey(req) {
  const m = (req.headers?.cookie || '').match(/(?:^|;\s*)nt_key=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});

export default async function handler(req, res) {
  if (!authorized(req.query.key || cookieKey(req))) return res.status(401).json({ error: 'not signed in' });
  res.setHeader('Cache-Control', 'no-store');
  const action = req.query.action;
  if (action === 'key') return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  if (action === 'status') {
    const s = await read();
    return res.status(200).json({ ready: pushReady(), devices: (s.push?.subs || []).length + (s.push?.fcm || []).length, recent: s.push?.sent || {} });
  }
  // The native app's home-screen widget: the Now item plus today's list.
  if (action === 'widget') {
    // Cue Home says whether he's home or out; saved only when it changes (or every 30 min, to
    // stay fresh), so Now and the pushes between refreshes agree.
    const where = ['home', 'out'].includes(req.query.where) ? req.query.where : null;
    let state = await read();
    const w = state.push?.where;
    if (where && (w?.place !== where || Date.now() - Date.parse(w?.at || 0) > 30 * 60000)) {
      await mutate(s => { s.push ||= { subs: [], sent: {} }; s.push.where = { place: where, at: new Date().toISOString() }; });
      state = await read();
    }
    return res.status(200).json({ ...widgetData(state), events: await upcoming(state) });
  }
  if (req.method !== 'POST') return res.status(405).end();
  // The native Android app registers its FCM token (on first launch and whenever it rotates).
  if (action === 'fcm_register') {
    const { token, device } = body(req);
    if (!/^[\w:-]{20,4096}$/.test(token || '')) return res.status(400).json({ error: 'bad token' });
    await mutate(s => {
      s.push ||= { subs: [], sent: {} };
      s.push.fcm = (s.push.fcm || []).filter(x => x.token !== token).slice(-4);
      s.push.fcm.push({ token, device: String(device || '').slice(0, 80), added: new Date().toISOString() });
    });
    return res.status(200).json({ ok: true, ready: pushReady(), next: nowContent(await read(), Date.now(), { loud: false }) });
  }
  // The phone's log of home-screen and guard events (Diag.kt), kept for reading from anywhere.
  if (action === 'diag') {
    const { events, app } = body(req);
    if (!Array.isArray(events)) return res.status(400).json({ error: 'bad diag' });
    await mutate(s => {
      s.meta.diag = [...(s.meta.diag || []), ...events.slice(-100).map(e => ({ at: new Date(Number(e.at) || Date.now()).toISOString(), e: String(e.e || '').slice(0, 200), app: String(app || '').slice(0, 20) }))].slice(-300);
    });
    return res.status(200).json({ ok: true });
  }
  // Daily screen time from the phone (Usage.kt): the last week each time, kept by date.
  if (action === 'usage') {
    const { days } = body(req);
    if (!Array.isArray(days)) return res.status(400).json({ error: 'bad usage' });
    await mutate(s => {
      s.usage ||= {};
      for (const d of days.slice(-14)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date || '')) continue;
        const apps = Object.fromEntries(Object.entries(d.apps || {}).slice(0, 8).map(([k, v]) => [String(k).slice(0, 60), Math.max(0, Math.round(+v || 0))]));
        s.usage[d.date] = { screen_min: Math.max(0, Math.round(+d.screen_min || 0)), unlocks: Math.max(0, Math.round(+d.unlocks || 0)), gated_min: Math.max(0, Math.round(+d.gated_min || 0)), apps };
      }
    });
    return res.status(200).json({ ok: true });
  }
  if (action === 'fcm_unregister') {
    const { token } = body(req);
    await mutate(s => { if (s.push?.fcm) s.push.fcm = s.push.fcm.filter(x => x.token !== token); });
    return res.status(200).json({ ok: true });
  }
  if (action === 'subscribe') {
    const sub = body(req);
    if (!/^https:\/\//.test(sub?.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: 'bad subscription' });
    await mutate(s => {
      s.push ||= { subs: [], sent: {} };
      s.push.subs = (s.push.subs || []).filter(x => x.endpoint !== sub.endpoint);
      s.push.subs.push({ endpoint: sub.endpoint, keys: sub.keys, added: new Date().toISOString(), ua: String(req.headers['user-agent'] || '').slice(0, 120) });
    });
    const state = await read();
    const r = await pushAll(state, pingContent(state, 'test'));
    return res.status(200).json({ ok: true, test_sent: r.sent });
  }
  if (action === 'unsubscribe') {
    const { endpoint } = body(req);
    await mutate(s => { if (s.push?.subs) s.push.subs = s.push.subs.filter(x => x.endpoint !== endpoint); });
    return res.status(200).json({ ok: true });
  }
  // A notification's Done button (the service worker posts the ping's check item here). From
  // the Now notification (now: true) the reply carries the next Now item to show in its place.
  if (action === 'check') {
    const { kind, id, step_id, date, now, undo, skip } = body(req);
    if (!['routine_step', 'habit', 'task', 'focus'].includes(kind) || !id) return res.status(400).json({ error: 'bad check' });
    // Done on a running focus block stops it as done, which checks the task off with real minutes.
    const out = kind === 'focus' ? await callTool('focus_stop', { session_id: id, outcome: 'done' }, { idle: !now })
      : await callTool('check_off', { items: [{ kind, id, ...(step_id ? { step_id } : {}), ...(date ? { date } : {}), ...(undo ? { undo: true } : {}), ...(skip && kind === 'routine_step' ? { skip: true } : {}), via: 'push' }] }, { idle: !now });
    return res.status(200).json(now ? { ...out, next: await nextNow({ active: true }) } : out);
  }
  // The Now notification's "Start 25 min": a focus block on that task, shown in its place.
  if (action === 'now_focus') {
    const { task_id } = body(req);
    if (!task_id) return res.status(400).json({ error: 'bad focus' });
    await callTool('focus_start', { task_id, minutes: 25 }, { idle: false });
    return res.status(200).json({ next: await nextNow({ active: true }) });
  }
  // Cue Home's worse / same / better under a check-off (the done row's mood_ask).
  if (action === 'mood') {
    const { id, change, vs_predicted } = body(req);
    if (!id || (change == null && vs_predicted == null)) return res.status(400).json({ error: 'bad mood' });
    await callTool('log_mood', { linked_id: id, ...(change != null ? { change } : {}), ...(vs_predicted != null ? { vs_predicted } : {}), via: 'push' }, { idle: false });
    return res.status(200).json({ ok: true });
  }
  // Cue Home's Stop on a focus block. Under 2 minutes in it was a mis-tap: nothing is logged.
  // Past that the time counts as progress and the task stays open.
  if (action === 'focus_end') {
    const { id } = body(req);
    const sess = (await read()).focus?.sessions?.find(x => x.id === id && !x.ended);
    if (!sess) return res.status(200).json({ next: await nextNow() });
    const worked = ((sess.paused_at ? Date.parse(sess.paused_at) : Date.now()) - Date.parse(sess.started) - (sess.paused_ms || 0)) / 60000;
    const cancelled = worked < 2;
    await callTool('focus_stop', cancelled ? { session_id: id, outcome: 'stopped', minutes: 0 } : { session_id: id, outcome: 'progress' }, { idle: false });
    return res.status(200).json({ cancelled, next: await nextNow({ active: true }) });
  }
  // The Now notification's "Not now": hide that item from it for the rest of the day.
  if (action === 'now_skip') {
    const { key } = body(req);
    if (!key) return res.status(400).json({ error: 'bad skip' });
    await mutate(s => {
      const today = localParts(Date.now(), s.settings.tz).date;
      s.push ||= { subs: [], sent: {} };
      if (s.push.now_skip?.date !== today) s.push.now_skip = { date: today, keys: [] };
      if (!s.push.now_skip.keys.includes(key)) s.push.now_skip.keys.push(key);
      if (key.startsWith('task:')) s.push.stuck = { id: key.slice(5), at: new Date().toISOString() }; // asked about in the app later
      s.meta.push_actions = [...(s.meta.push_actions || []), { at: new Date().toISOString(), a: 'skip' }].slice(-500);
    });
    return res.status(200).json({ next: await nextNow() });
  }
  // Cue Home's "resume" on a routine put off with Later: it comes back to Now.
  if (action === 'now_unskip') {
    const { routine_id } = body(req);
    if (!routine_id) return res.status(400).json({ error: 'bad resume' });
    await mutate(s => {
      if (s.push?.now_skip) s.push.now_skip.keys = s.push.now_skip.keys.filter(k => !k.startsWith(`step:${routine_id}:`));
    });
    // The whole widget payload comes back too, so Home redraws without a second fetch.
    const next = await nextNow({ active: true });
    const state = await read();
    return res.status(200).json({ next, widget: { ...widgetData(state), events: await upcoming(state) } });
  }
  // Cue Home's pick sheet: every open task in rank order, to search and pin one.
  if (action === 'queue') {
    const state = await read();
    const ids = new Set(state.tasks.map(t => t.id));
    const tasks = rankTasks(state).scored.filter(x => ids.has(x.t.id)).map(x => ({ id: x.t.id, title: x.t.title,
      est_min: x.t.est_min || state.settings.default_est_min || 15, project: x.t.project || null, pinned: x.pinned }));
    return res.status(200).json({ tasks });
  }
  // Picking a task there makes it the one up next: it's pinned for today (any earlier pick
  // steps aside) and comes back if he'd put it off with Not now.
  if (action === 'pin') {
    const { id } = body(req);
    if (!id) return res.status(400).json({ error: 'bad pin' });
    await mutate(s => {
      const today = localParts(Date.now(), s.settings.tz).date;
      for (const t of s.tasks) if (t.pin === today && t.id !== id) delete t.pin;
      if (s.push?.now_skip) s.push.now_skip.keys = s.push.now_skip.keys.filter(k => k !== `task:${id}`);
    });
    await callTool('reorder', { id, direction: 'top', via: 'push' }, { idle: false });
    const next = await nextNow({ active: true });
    const state = await read();
    return res.status(200).json({ next, widget: { ...widgetData(state), events: await upcoming(state) } });
  }
  // What the Now notification should show right now (the app's "show it" button).
  if (action === 'now') {
    const state = await read();
    const c = nowContent(state, Date.now(), { loud: false });
    if (c && req.query.send) await pushAll(state, c);
    return res.status(200).json({ next: c });
  }
  if (action === 'test') {
    const state = await read();
    return res.status(200).json(await pushAll(state, pingContent(state, 'test')));
  }
  // Round trip through the queue: a test ping delivered after `seconds` (default 60).
  if (action === 'probe') {
    const key = `test:${Date.now()}`;
    const ok = await schedulePing(key, Date.now() + 1000 * Number(req.query.seconds || 60));
    return res.status(200).json({ scheduled: ok, key });
  }
  // Queue today's pings now (normally the daily sweep does this), e.g. after turning push on.
  if (action === 'plan') {
    const plan = dayPlan(await read());
    for (const p of plan) await schedulePing(p.key, p.at);
    return res.status(200).json({ scheduled: plan.map(p => ({ key: p.key, at: new Date(p.at).toISOString() })) });
  }
  return res.status(400).json({ error: 'unknown action' });
}
