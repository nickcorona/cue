// MCP over Streamable HTTP, stateless JSON responses. Auth is a secret in the URL path
// (/mcp/<key>), which claude.ai custom connectors support without OAuth.
import crypto from 'node:crypto';
import { TOOLS, INSTRUCTIONS, callTool } from '../lib/tools.js';
import { UI_URI, renderPage } from '../lib/ui.js';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const UI_MIME = 'text/html;profile=mcp-app';

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
        serverInfo: { name: 'nick-tasks', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      // get_queue renders as the interactive queue inside Claude (MCP Apps).
      return ok({ tools: TOOLS.map(t => (t.name === 'get_queue' ? { ...t, _meta: { ui: { resourceUri: UI_URI } } } : t)) });
    case 'resources/list':
      return ok({ resources: [{ uri: UI_URI, name: 'queue', description: 'Interactive queue: routines, habits and ranked tasks with check-off', mimeType: UI_MIME }] });
    case 'resources/read':
      if (params?.uri !== UI_URI) return fail(-32002, `Resource not found: ${params?.uri}`);
      return ok({ contents: [{ uri: UI_URI, mimeType: UI_MIME, text: renderPage(), _meta: { ui: { prefersBorder: false } } }] });
    case 'tools/call':
      try {
        const out = await callTool(params?.name, params?.arguments || {});
        // The queue view reads structuredContent; other tools only need text.
        return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], ...(params?.name === 'get_queue' ? { structuredContent: out } : {}) });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

export default async function handler(req, res) {
  if (!authorized(req.query.key)) return res.status(404).send('Not found');
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').send('Method not allowed');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); } }
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map(handle))).filter(Boolean);
  if (!replies.length) return res.status(202).end();
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify(batch ? replies : replies[0]));
}
