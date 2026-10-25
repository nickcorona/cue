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
  background_color: '#111214',
  theme_color: '#111214',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
});

// Network-only: the queue must always be live, the worker just makes the app installable.
const SW = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{d={title:'Cue',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'Cue',{body:d.body||'',tag:d.tag,icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',data:{url:d.url||'/'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus' in w){w.navigate(url);return w.focus()}}return clients.openWindow(url)}))});`;

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
