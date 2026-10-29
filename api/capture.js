// Quick capture from the installed app (signed-in cookie or /capture?key=): POST {text}.
import { authorized } from './mcp.js';
import { capture } from '../lib/capture.js';

function cookieKey(req) {
  const m = (req.headers?.cookie || '').match(/(?:^|;\s*)nt_key=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function handler(req, res) {
  if (!authorized(req.query.key || cookieKey(req))) return res.status(401).json({ error: 'not signed in' });
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').end();
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ error: 'bad json' }); } }
  if (!String(body?.text || '').trim()) return res.status(400).json({ error: 'nothing to capture' });
  try {
    return res.status(200).json(await capture(body.text));
  } catch (e) {
    console.error('capture failed', e.message);
    return res.status(500).json({ error: e.message });
  }
}
