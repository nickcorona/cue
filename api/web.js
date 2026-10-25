// Web view. The long /app/<key> link signs a device in once (cookie), after which the
// short URLs work: / for the full queue, /w for the compact home-screen widget view.
import { authorized } from './mcp.js';
import { renderPage } from '../lib/ui.js';

const COOKIE = 'nt_key';
const YEAR = 60 * 60 * 24 * 365;

const MANIFEST = JSON.stringify({
  name: 'Cue',
  short_name: 'Cue',
  description: 'Routines, habits and ranked tasks',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f7f6f3',
  theme_color: '#2f6f5e',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
});

// Network-only: the queue must always be live, the worker just makes the app installable.
const SW = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});`;

function cookieKey(req) {
  const m = (req.headers?.cookie || '').match(/(?:^|;\s*)nt_key=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function handler(req, res) {
  const { asset, view } = req.query;
  if (asset === 'manifest') {
    res.setHeader('Content-Type', 'application/manifest+json');
    return res.status(200).send(MANIFEST);
  }
  if (asset === 'sw') {
    res.setHeader('Content-Type', 'text/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(SW);
  }

  if (req.query.key) {
    if (!authorized(req.query.key)) return res.status(404).send('Not found');
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(req.query.key)}; Max-Age=${YEAR}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    res.setHeader('Location', view === 'widget' ? '/w' : '/');
    return res.status(302).end();
  }

  const key = cookieKey(req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!authorized(key)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cue</title><body style="font:15px system-ui;padding:24px">Not signed in on this device. Open your full link once, then this short address works.</body>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(renderPage({ key, view }));
}
