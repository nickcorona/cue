// Push subscription management for the installed app (signed-in cookie or /push?key=).
import { authorized } from './mcp.js';
import { read, mutate } from '../lib/store.js';
import { pushAll, pingContent, schedulePing, pushReady, dayPlan, nowContent, idlePing } from '../lib/push.js';
import { localParts } from '../lib/logic.js';
import { callTool } from '../lib/tools.js';

// The next Now item after a Done, Start or Not now: one read, and the idle check re-armed in
// parallel. This is the slow part of a button tap, so it skips recording now_last (a stale
// value only costs a duplicate quiet refresh later).
async function nextNow({ active = false } = {}) {
  const state = await read();
  const ping = active && idlePing(state);
  if (ping) await schedulePing(ping.key, ping.at).catch(e => console.error('idle ping failed', e.message));
  return nowContent(state, Date.now(), { loud: false });
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
    return res.status(200).json({ ready: pushReady(), devices: (s.push?.subs || []).length, recent: s.push?.sent || {} });
  }
  if (req.method !== 'POST') return res.status(405).end();
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
    const { kind, id, step_id, date, now } = body(req);
    if (!['routine_step', 'habit', 'task', 'focus'].includes(kind) || !id) return res.status(400).json({ error: 'bad check' });
    // Done on a running focus block stops it as done, which checks the task off with real minutes.
    const out = kind === 'focus' ? await callTool('focus_stop', { session_id: id, outcome: 'done' }, { idle: !now })
      : await callTool('check_off', { items: [{ kind, id, ...(step_id ? { step_id } : {}), ...(date ? { date } : {}), via: 'push' }] }, { idle: !now });
    return res.status(200).json(now ? { ...out, next: await nextNow({ active: true }) } : out);
  }
  // The Now notification's "Start 25 min": a focus block on that task, shown in its place.
  if (action === 'now_focus') {
    const { task_id } = body(req);
    if (!task_id) return res.status(400).json({ error: 'bad focus' });
    await callTool('focus_start', { task_id, minutes: 25 }, { idle: false });
    return res.status(200).json({ next: await nextNow({ active: true }) });
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
      s.meta.push_actions = [...(s.meta.push_actions || []), { at: new Date().toISOString(), a: 'skip' }].slice(-500);
    });
    return res.status(200).json({ next: await nextNow() });
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
