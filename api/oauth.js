// OAuth endpoints for /mcp: discovery metadata, dynamic client registration, a consent page
// that asks for the app key (or uses the signed-in device cookie), and the token endpoint.
import { authorized } from './mcp.js';
import { sign, verify, origin, pkceOk } from '../lib/oauth.js';

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function cookieKey(req) {
  const m = (req.headers?.cookie || '').match(/(?:^|;\s*)nt_key=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function body(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return Object.fromEntries(new URLSearchParams(b)); }
  }
  return {};
}

const okRedirect = uri => {
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname));
  } catch { return false; }
};

// A client_id we issued lists its redirect URIs; anything else falls back to the consent page.
function clientAllows(clientId, redirectUri) {
  const c = verify(clientId, 'client');
  return c ? c.redirect_uris.includes(redirectUri) : true;
}

function consentPage(p, { signedIn, error }) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'resource', 'scope']
    .map(k => (p[k] ? `<input type="hidden" name="${k}" value="${esc(p[k])}">` : '')).join('');
  const host = new URL(p.redirect_uri).host;
  const name = verify(p.client_id, 'client')?.name || 'An app';
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Cue</title>
<body style="font:15px system-ui;max-width:420px;margin:40px auto;padding:0 16px;color:#222">
<h2 style="font-weight:600">Connect to Cue</h2>
<p><b>${esc(name)}</b> wants full access to your tasks, habits and routines. It will send you back to <b>${esc(host)}</b>.</p>
${error ? `<p style="color:#b00">${esc(error)}</p>` : ''}
<form method="post">${hidden}
${signedIn ? '' : '<label>App key<br><input name="key" type="password" autocomplete="current-password" style="width:100%;padding:8px;font:inherit;margin:4px 0 12px"></label>'}
<button style="padding:10px 18px;font:inherit;background:#2f6f5e;color:#fff;border:0;border-radius:6px">Allow</button>
</form></body>`;
}

export default async function handler(req, res) {
  const base = origin(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();

  switch (req.query.route) {
    case 'resource':
      return res.status(200).json({ resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ['header'] });

    case 'server':
      return res.status(200).json({
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/oauth/token`,
        registration_endpoint: `${base}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        scopes_supported: ['tasks'],
      });

    case 'register': {
      if (req.method !== 'POST') return res.status(405).end();
      const b = body(req);
      const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
      if (!uris.length || !uris.every(okRedirect)) return res.status(400).json({ error: 'invalid_redirect_uri' });
      const name = String(b.client_name || '').slice(0, 80);
      return res.status(201).json({
        client_id: sign({ typ: 'client', redirect_uris: uris, name, exp: now() + 100 * 365 * DAY }),
        client_id_issued_at: now(),
        client_name: name,
        redirect_uris: uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      });
    }

    case 'authorize': {
      const p = { ...req.query, ...(req.method === 'POST' ? body(req) : {}) };
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      if (!okRedirect(p.redirect_uri) || !p.client_id || !clientAllows(p.client_id, p.redirect_uri)) {
        return res.status(400).send('Invalid client or redirect_uri');
      }
      if (!p.code_challenge || (p.code_challenge_method && p.code_challenge_method !== 'S256')) {
        return res.status(400).send('PKCE with S256 is required');
      }
      const signedIn = authorized(cookieKey(req));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.method !== 'POST') return res.status(200).send(consentPage(p, { signedIn }));
      if (!signedIn && !authorized(p.key)) return res.status(401).send(consentPage(p, { signedIn, error: 'Wrong key.' }));
      const code = sign({ typ: 'code', client_id: p.client_id, redirect_uri: p.redirect_uri, cc: p.code_challenge, exp: now() + 300 });
      const to = new URL(p.redirect_uri);
      to.searchParams.set('code', code);
      if (p.state) to.searchParams.set('state', p.state);
      res.setHeader('Location', to.toString());
      return res.status(302).end();
    }

    case 'token': {
      if (req.method !== 'POST') return res.status(405).end();
      res.setHeader('Cache-Control', 'no-store');
      const b = body(req);
      const issue = () => res.status(200).json({
        access_token: sign({ typ: 'access', exp: now() + 30 * DAY }),
        token_type: 'Bearer',
        expires_in: 30 * DAY,
        refresh_token: sign({ typ: 'refresh', exp: now() + 365 * DAY }),
        scope: 'tasks',
      });
      if (b.grant_type === 'authorization_code') {
        const c = verify(b.code, 'code');
        if (!c || c.redirect_uri !== b.redirect_uri || (b.client_id && b.client_id !== c.client_id) || !pkceOk(b.code_verifier, c.cc)) {
          return res.status(400).json({ error: 'invalid_grant' });
        }
        return issue();
      }
      if (b.grant_type === 'refresh_token') {
        if (!verify(b.refresh_token, 'refresh')) return res.status(400).json({ error: 'invalid_grant' });
        return issue();
      }
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    default:
      return res.status(404).send('Not found');
  }
}
