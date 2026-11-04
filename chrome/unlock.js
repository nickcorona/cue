// Unlock: what the gate sends a listed site to, and the toolbar popup (the list of gated
// sites, time left on open ones, and today's reasons read back).
import { WAIT_S, MINUTES, gatedSite, unlockedUntil, unlock, words, todaysLog } from './rules.js';
import { getState, change } from './store.js';

const m = document.getElementById('m');
const q = new URLSearchParams(location.search);
const target = q.get('u');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clock = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const left = until => `${Math.ceil((until - Date.now()) / 60000)}m left`;

function readBack(s) {
  const today = todaysLog(s);
  if (!today.length) return '';
  return `<h2>Today</h2>` + today.slice().reverse().map(e =>
    `<div class="line"><div><div>${esc(e.site)} · ${e.minutes}m</div><div class="dim">${esc(e.reason)}</div></div><div class="dim">${clock(e.at)}</div></div>`).join('');
}

async function pick() {
  document.body.classList.add('pop');
  const s = await getState();
  const n = todaysLog(s).length, now = Date.now();
  const open = s.sites.filter(x => unlockedUntil(s, x) > now);
  m.innerHTML = `<div class="kicker">${n ? `${n} today` : 'None today'}</div><h1>Unlock</h1>
    <div class="dim">${s.on ? `A reason, a ${WAIT_S}s wait, then 5 or 15 minutes. Gated sites send you here.` : 'The gate is off.'}</div>
    ${open.length ? '<h2>Open now</h2>' + open.map(x => `<div class="line"><div>${esc(x)}</div><div class="dim">${left(unlockedUntil(s, x))}</div></div>`).join('') : ''}
    ${readBack(s)}
    <div class="row" style="margin-top:14px"><button class="link" id="opt">Gated sites</button><button class="link" id="rl" title="Picks up a new version unzipped over this folder">Reload · v${chrome.runtime.getManifest().version}</button></div>`;
  document.getElementById('opt').onclick = () => chrome.runtime.openOptionsPage();
  // The extensions page is closed while locked, so updates are picked up from here instead.
  document.getElementById('rl').onclick = () => chrome.runtime.reload();
}

async function ask() {
  const s = await getState();
  const site = gatedSite(target, s);
  if (!site || unlockedUntil(s, site) > Date.now()) return location.replace(target);
  const timesUp = q.get('up') === '1';
  let wait = WAIT_S;
  m.innerHTML = `<div class="kicker">${timesUp ? "Time's up" : 'Gated · unlock to open'}</div><h1>${esc(site)}</h1>
    <div class="dim" style="margin-bottom:14px">${todaysLog(s).filter(e => e.site === site).length || 'No'} unlocks of it today.</div>
    <input type="text" id="why" placeholder="What are you opening it for?" autocomplete="off">
    <div id="st" class="dim" style="min-height:22px;margin-top:6px"></div>
    ${MINUTES.map(n => `<button class="big alt" data-m="${n}"></button>`).join('')}
    <div class="row" style="margin-top:12px"><button class="link" id="no">never mind</button></div>`;
  const why = document.getElementById('why'), st = document.getElementById('st');
  const blocker = () => words(why.value) < 3 ? "Say what it's for, in 3 words or more" : wait > 0 ? `Wait ${wait}s` : null;
  const btns = [...m.querySelectorAll('[data-m]')];
  const refresh = () => {
    const ok = !blocker();
    for (const b of btns) {
      b.textContent = `open for ${b.dataset.m} min` + (wait > 0 ? ` · ${wait}s` : '');
      b.className = ok ? 'big' : 'big alt';
      b.setAttribute('aria-disabled', String(!ok));
    }
  };
  // Taps always answer: early ones say what's still missing.
  for (const b of btns) b.onclick = async () => {
    const no = blocker();
    if (no) { st.textContent = no; st.className = ''; return; }
    const minutes = +b.dataset.m;
    const until = await change(x => unlock(x, site, minutes, why.value));
    chrome.runtime.sendMessage({ type: 'unlocked', site, until });
    location.replace(target);
  };
  document.getElementById('no').onclick = () => location.replace(chrome.runtime.getURL('newtab.html'));
  why.oninput = () => { st.textContent = ''; st.className = 'dim'; refresh(); };
  why.focus();
  refresh();
  // The wait only runs while this tab is in front: switching away to do something else
  // doesn't count as waiting.
  const t = setInterval(() => { if (document.visibilityState !== 'visible') return; wait--; refresh(); if (wait <= 0) clearInterval(t); }, 1000);
}

target ? ask() : pick();
