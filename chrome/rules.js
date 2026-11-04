// The gate's rules, as plain functions over one state object so the service worker, the pages
// and the tests share them. Same deal as the phone's Rules.kt: adding a site is instant; once
// locked, removing one or turning the gate off waits 24h and can be cancelled. Anything gated
// opens through Unlock: a reason of 3+ words, a 20 s wait, then 5 or 15 minutes, logged.
export const WAIT_S = 20;
export const DELAY_MS = 24 * 60 * 60 * 1000;
export const MINUTES = [5, 15];
export const SERVER = 'https://nick-cue.vercel.app';

export const DEFAULT_SITES = ['youtube.com', 'reddit.com', 'x.com', 'twitter.com', 'instagram.com', 'facebook.com',
  'tiktok.com', 'twitch.tv', 'netflix.com', 'primevideo.com', 'disneyplus.com', 'crave.ca', 'news.ycombinator.com', 'bet365.com'];

// Two-label suffixes where the site is the last three labels (bbc.co.uk, not co.uk).
const SUFFIX2 = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in']);

export function fresh() {
  return { on: true, locked: false, sites: [...DEFAULT_SITES], unlocks: {}, log: [], pending: [], outbox: [] };
}

// Fills in anything missing from an older or empty stored state.
export function load(raw) {
  const s = { ...fresh(), ...(raw || {}) };
  if (!Array.isArray(s.sites)) s.sites = [...DEFAULT_SITES];
  for (const k of ['log', 'pending', 'outbox']) if (!Array.isArray(s[k])) s[k] = [];
  if (!s.unlocks || typeof s.unlocks !== 'object') s.unlocks = {};
  return s;
}

// What a typed entry or a URL's host means as a site: lowercased, no scheme, path or www.
// A listed subdomain (news.ycombinator.com) stays as typed.
export function cleanSite(input) {
  let h = String(input || '').trim().toLowerCase();
  if (!h) return null;
  try { if (/^[a-z]+:\/\//.test(h)) h = new URL(h).hostname; } catch { return null; }
  h = h.split(/[/?#:]/)[0].replace(/^www\./, '').replace(/\.$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : null;
}

export function baseSite(host) {
  const parts = String(host || '').toLowerCase().replace(/\.$/, '').split('.');
  const n = SUFFIX2.has(parts.slice(-2).join('.')) ? 3 : 2;
  return parts.slice(-n).join('.');
}

// The listed site a URL falls under (the longest match), or null if it's free to open.
export function gatedSite(url, s) {
  if (!s.on) return null;
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    host = u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
  let best = null;
  for (const site of s.sites) if ((host === site || host.endsWith('.' + site)) && (!best || site.length > best.length)) best = site;
  return best;
}

export function unlockedUntil(s, site) { return +s.unlocks[site] || 0; }
export function isOpen(s, url, now = Date.now()) {
  const site = gatedSite(url, s);
  return !site || unlockedUntil(s, site) > now;
}

export const words = reason => String(reason || '').trim().split(/\s+/).filter(Boolean).length;

// Each site keeps its own time box: unlocking one never ends another's.
export function unlock(s, site, minutes, reason, now = Date.now()) {
  if (!MINUTES.includes(minutes)) throw new Error('5 or 15 minutes');
  if (words(reason) < 3) throw new Error("Say what it's for, in 3 words or more");
  const until = now + minutes * 60000;
  for (const [k, u] of Object.entries(s.unlocks)) if (u < now - DELAY_MS) delete s.unlocks[k];
  s.unlocks[site] = until;
  const entry = { at: new Date(now).toISOString(), site, minutes, reason: String(reason).trim().slice(0, 200) };
  s.log = [...s.log, entry].slice(-300);
  s.outbox = [...s.outbox, entry].slice(-100);
  return until;
}

export function todaysLog(s, now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  return s.log.filter(e => Date.parse(e.at) >= d.getTime());
}

// Tightening is always instant.
export function addSite(s, input) {
  const site = cleanSite(input);
  if (!site) return null;
  if (!s.sites.includes(site)) s.sites = [...s.sites, site].sort();
  s.pending = s.pending.filter(p => !(p.op === 'remove' && p.arg === site));
  return site;
}
export function lock(s) { s.locked = true; s.on = true; s.pending = s.pending.filter(p => p.op !== 'off'); }
export function turnOn(s) { s.on = true; s.pending = s.pending.filter(p => p.op !== 'off'); }

// Loosening: instant until locked, then a day's wait that can be cancelled.
function loosen(s, op, arg, now, apply) {
  if (!s.locked) { apply(); return { done: true }; }
  if (!s.pending.some(p => p.op === op && p.arg === arg)) s.pending = [...s.pending, { at: now + DELAY_MS, op, arg }];
  return { done: false, at: s.pending.find(p => p.op === op && p.arg === arg).at };
}
export function removeSite(s, site, now = Date.now()) {
  return loosen(s, 'remove', site, now, () => { s.sites = s.sites.filter(x => x !== site); });
}
export function turnOff(s, now = Date.now()) {
  return loosen(s, 'off', '', now, () => { s.on = false; s.locked = false; });
}
export function cancel(s, op, arg = '') { s.pending = s.pending.filter(p => !(p.op === op && p.arg === arg)); }

// Applies loosenings whose day is up. True if anything changed.
export function settle(s, now = Date.now()) {
  const due = s.pending.filter(p => p.at <= now);
  if (!due.length) return false;
  s.pending = s.pending.filter(p => p.at > now);
  for (const p of due) {
    if (p.op === 'remove') s.sites = s.sites.filter(x => x !== p.arg);
    if (p.op === 'off') { s.on = false; s.locked = false; }
  }
  return true;
}

// While locked, the extensions page (where the gate is switched off or removed) is off limits.
export function guardsSelf(s, url) {
  return s.locked && s.on && /^(chrome|edge|brave):\/\/(extensions|settings\/(extensions|clearBrowserData))/i.test(String(url || ''));
}
