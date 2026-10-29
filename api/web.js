// Web view. The long /app/<key> link signs a device in once (cookie), after which the
// short URLs work: / for the full queue, /w for the compact home-screen widget view.
import { authorized } from './mcp.js';
import { renderPage } from '../lib/ui.js';
import { renderLift } from '../lib/liftui.js';
import { renderFocus } from '../lib/focusui.js';
import { renderCook } from '../lib/cookui.js';
import { renderBuild } from '../lib/buildui.js';
import { renderMood } from '../lib/moodui.js';
import { ringPng } from '../lib/ring.js';

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

// The app's pages open from a device cache and refresh it in the background (data always comes
// live from the server; only the page shell is cached), so launching doesn't wait on the network.
const SW = `const SHELL='cue-shell-1',PAGES=['/','/w','/focus','/lift','/cook','/build','/mood'];
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
  if(r.mode!=='navigate'||r.method!=='GET'||u.origin!==location.origin||!PAGES.includes(u.pathname))return;
  e.respondWith(caches.open(SHELL).then(async c=>{const key=u.origin+u.pathname,hit=await c.match(key);
    const net=fetch(r).then(res=>{if(res.status===200&&!res.redirected)c.put(key,res.clone());return res});
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}return net}))});
// The Now notification (tag cue-now) has Done and Not now buttons; the server answers either
// with the next item, which replaces it quietly, so the shade walks him through the day.
const SW_ICONS={icon:'/icons/icon-192.png',badge:'/icons/badge-96.png'};
// The Now notification brings its own large icon: a progress ring for routine steps.
function show(d){const now=d.tag==='cue-now';
  return self.registration.showNotification(d.title||'Cue',{body:d.body||'',tag:d.tag,...SW_ICONS,...(d.icon?{icon:d.icon}:{}),renotify:!!(d.tag&&d.renotify),silent:!!d.silent,
    data:{url:d.url||'/',check:d.check||null,skip:now?d.skip:null,start:now?d.start||null:null,now},
    actions:[...(d.check?[{action:'done',title:'Done'}]:[]),...(now&&d.start?[{action:'start',title:'Start 25 min'}]:[]),...(now&&d.skip?[{action:'skip',title:'Not now'}]:[])]})}
async function post(action,body){const r=await fetch('/api/push?action='+action,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw 0;return r.json()}
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{d={title:'Cue',body:e.data&&e.data.text()}}e.waitUntil(show(d))});
// The Now notification is never closed on a tap: it's replaced in place. A button shows its
// result at once ("✓ Done"), then the next item arrives as a heads-up (renotify, not silent),
// since Android collapses the shade on a web notification's button and it would go unseen.
self.addEventListener('notificationclick',e=>{const data=e.notification.data||{},url=data.url||'/';
  if(!data.now)e.notification.close();
  const fail=()=>self.registration.showNotification("Couldn't do that",{body:'Open Cue to tick it.',tag:'cue-check-err',...SW_ICONS});
  const ack=(title,body)=>show({title,body,tag:'cue-now',silent:true});
  const next=p=>p.then(r=>r.next?show({...r.next,renotify:true,silent:false}):self.registration.getNotifications({tag:'cue-now'}).then(ns=>ns.forEach(n=>n.close()))).catch(fail);
  if(e.action==='done'&&data.check)return e.waitUntil(Promise.all([ack('✓ Done','Next one coming…'),next(post('check',{...data.check,now:!!data.now}))]));
  if(e.action==='start'&&data.start)return e.waitUntil(Promise.all([ack('Starting 25 min…',''),next(post('now_focus',data.start))]));
  // Not now on a task also opens Cue to ask what's in the way (don't know how, too big, not feeling it).
  if(e.action==='skip'&&data.skip){const t=data.skip.startsWith('task:')?data.skip.slice(5):null;
    return e.waitUntil(Promise.all([ack('Skipped for today','Next one coming…'),next(post('now_skip',{key:data.skip})),t?openUrl('/?stuck='+encodeURIComponent(t)):null]))}
  // Tapping the body opens the app; the notification stays, since only Done or Not now clears it.
  e.waitUntil(openUrl(url))});
function openUrl(url){return clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus' in w){w.navigate(url);return w.focus()}}return clients.openWindow(url)})}`;

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
  if (asset === 'ring') {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(ringPng(Math.min(99, +req.query.d || 0), Math.min(99, +req.query.n || 0)));
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
  if (view === 'lift') return res.status(200).send(renderLift({ key }));
  if (view === 'focus') return res.status(200).send(renderFocus({ key }));
  if (view === 'build') return res.status(200).send(renderBuild({ key }));
  if (view === 'mood') return res.status(200).send(renderMood({ key }));
  if (view === 'cook') return res.status(200).send(renderCook({ key }));
  return res.status(200).send(renderPage({ key, view }));
}
