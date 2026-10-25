// Stateless OAuth 2.1 for single-user connectors that can't use the secret URL (Meta Muse's
// Settings > Connectors). Codes and tokens are HMAC-signed with a key derived from APP_KEY,
// so rotating APP_KEY revokes everything and there is nothing to store.
import crypto from 'node:crypto';

const b64 = buf => Buffer.from(buf).toString('base64url');
const secret = () => crypto.createHmac('sha256', process.env.APP_KEY || '').update('nick-tasks-oauth').digest();

export function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(crypto.createHmac('sha256', secret()).update(body).digest())}`;
}

export function verify(token, typ) {
  if (!process.env.APP_KEY || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (p.typ !== typ || !(p.exp > Date.now() / 1000)) return null;
  return p;
}

export const origin = req => `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

export const pkceOk = (verifier, challenge) =>
  typeof verifier === 'string' && b64(crypto.createHash('sha256').update(verifier).digest()) === challenge;
