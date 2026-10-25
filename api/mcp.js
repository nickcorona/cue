// MCP over Streamable HTTP, stateless JSON responses. Auth is either a secret in the URL path
// (/mcp/<key>), which claude.ai custom connectors support without OAuth, or a bearer token on
// /mcp: the app key itself, or an OAuth access token (Meta Muse and other OAuth-only clients).
import crypto from 'node:crypto';
import { verify, origin } from '../lib/oauth.js';
import { TOOLS, INSTRUCTIONS, callTool } from '../lib/tools.js';
import { UI_URI, renderPage } from '../lib/ui.js';
import { PLAN_URI, REVIEW_URI, renderPlan, renderReview } from '../lib/views.js';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const UI_MIME = 'text/html;profile=mcp-app';
// Card tools and the MCP App each renders.
const VIEWS = {
  show_queue: { uri: UI_URI, name: 'queue', description: 'Interactive queue: routines, habits and ranked tasks with check-off', render: () => renderPage() },
  show_plan: { uri: PLAN_URI, name: 'plan', description: 'Day plan: shift, remove and approve time blocks', render: renderPlan },
  show_review: { uri: REVIEW_URI, name: 'review', description: 'Weekly review triage for overdue and stale tasks', render: renderReview },
};

export function authorized(key) {
  const want = process.env.APP_KEY || '';
  if (!want || typeof key !== 'string' || key.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

async function handle(msg) {
  const { id, method, params } = msg;
  const ok = result => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined) return null; // notification
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'cue', title: 'Cue', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      // show_* tools render as cards inside Claude (MCP Apps). get_queue and review stay
      // data-only so reading them for planning doesn't drop a card into the chat.
      return ok({ tools: TOOLS.map(t => (VIEWS[t.name] ? { ...t, _meta: { ui: { resourceUri: VIEWS[t.name].uri } } } : t)) });
    case 'resources/list':
      return ok({ resources: Object.values(VIEWS).map(v => ({ uri: v.uri, name: v.name, description: v.description, mimeType: UI_MIME })) });
    case 'resources/read': {
      const v = Object.values(VIEWS).find(x => x.uri === params?.uri);
      if (!v) return fail(-32002, `Resource not found: ${params?.uri}`);
      return ok({ contents: [{ uri: v.uri, mimeType: UI_MIME, text: v.render(), _meta: { ui: { prefersBorder: false } } }] });
    }
    case 'tools/call':
      try {
        const out = await callTool(params?.name, params?.arguments || {});
        // The queue view reads structuredContent (the app refreshes via get_queue); other tools only need text.
        return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], ...(params?.name === 'get_queue' || VIEWS[params?.name] ? { structuredContent: out } : {}) });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

function bearerOk(req) {
  const m = (req.headers?.authorization || '').match(/^Bearer\s+(\S+)$/i);
  return !!m && (authorized(m[1]) || !!verify(m[1], 'access'));
}

export default async function handler(req, res) {
  if (req.query.key !== undefined) {
    if (!authorized(req.query.key)) return res.status(404).send('Not found');
  } else if (!bearerOk(req)) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${origin(req)}/.well-known/oauth-protected-resource/mcp"`);
    return res.status(401).json({ error: 'invalid_token' });
  }
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').send('Method not allowed');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); } }
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map(handle))).filter(Boolean);
  if (!replies.length) return res.status(202).end();
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify(batch ? replies : replies[0]));
}
