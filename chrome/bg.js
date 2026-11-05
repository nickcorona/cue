// The gate. Any top-level navigation to a listed site that isn't inside its time box goes to
// Unlock instead; when a box runs out, tabs still on that site go back to Unlock too.
import { gatedSite, isOpen, unlockedUntil, settle, guardsSelf } from './rules.js';
import { getState, change, cue } from './store.js';

const unlockUrl = (url, up) => chrome.runtime.getURL(`unlock.html?u=${encodeURIComponent(url)}${up ? '&up=1' : ''}`);
const blockedUrl = () => chrome.runtime.getURL('options.html?blocked=1');

async function check(tabId, url) {
  if (!url) return;
  const s = await getState();
  if (guardsSelf(s, url)) return chrome.tabs.update(tabId, { url: blockedUrl() }).catch(() => {});
  if (!isOpen(s, url)) chrome.tabs.update(tabId, { url: unlockUrl(url) }).catch(() => {});
}

chrome.webNavigation.onBeforeNavigate.addListener(d => { if (d.frameId === 0) check(d.tabId, d.url); });
// Backup for anything the navigation events miss (prerendered pages, restored tabs).
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.url) check(tabId, info.url); });

// Every open tab against the rules: on a box running out, at startup, and once a minute.
async function sweep() {
  // Settled inside change() so an unlock saved meanwhile isn't written over with an older copy.
  await change(x => settle(x)); // writes only when a day-long change came due
  const s = await getState();
  const now = Date.now();
  for (const t of await chrome.tabs.query({})) {
    if (!t.url) continue;
    if (guardsSelf(s, t.url)) { chrome.tabs.update(t.id, { url: blockedUrl() }).catch(() => {}); continue; }
    const site = gatedSite(t.url, s);
    if (site && unlockedUntil(s, site) <= now) chrome.tabs.update(t.id, { url: unlockUrl(t.url, unlockedUntil(s, site) > 0) }).catch(() => {});
  }
  flush();
}

// Unlocks go to Cue so the reasons sit next to the phone's; ones that fail wait for next time.
async function flush() {
  const s = await getState();
  if (!s.outbox.length) return;
  const batch = s.outbox.slice();
  try {
    await cue('/push?action=web_unlock', { unlocks: batch, device: 'chrome' });
    await change(x => { x.outbox = x.outbox.filter(e => !batch.some(b => b.at === e.at && b.site === e.site)); });
  } catch { /* offline or no key: kept for the next sweep */ }
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick' || a.name.startsWith('exp:')) sweep(); });
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m?.type === 'unlocked') {
    chrome.alarms.create(`exp:${m.site}`, { when: m.until + 500 });
    flush();
  }
  if (m?.type === 'sweep') sweep();
  reply?.({ ok: true });
});
function start() { chrome.alarms.create('tick', { periodInMinutes: 1 }); sweep(); }
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onInstalled.addListener(d => {
  start();
  if (d.reason === 'install') chrome.runtime.openOptionsPage();
});
