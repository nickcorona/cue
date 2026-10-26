// Push subscription management for the installed app (signed-in cookie or /push?key=).
import { authorized } from './mcp.js';
import { read, mutate } from '../lib/store.js';
import { pushAll, pingContent, schedulePing, pushReady, dayPlan } from '../lib/push.js';
import { callTool } from '../lib/tools.js';

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
  // A notification's Done button (the service worker posts the ping's check item here).
  if (action === 'check') {
    const { kind, id, step_id, date } = body(req);
    if (!['routine_step', 'habit'].includes(kind) || !id) return res.status(400).json({ error: 'bad check' });
    const out = await callTool('check_off', { items: [{ kind, id, ...(step_id ? { step_id } : {}), ...(date ? { date } : {}), via: 'push' }] });
    return res.status(200).json(out);
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
