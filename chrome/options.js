// Settings: the Cue key, the gated sites, and the lock. Adding a site is instant; once locked,
// removing one or turning the gate off waits 24h, and can be cancelled while it waits.
import { addSite, removeSite, turnOff, turnOn, lock, cancel, settle, DELAY_MS } from './rules.js';
import { getState, setState, change, getKey, cue } from './store.js';

const m = document.getElementById('m');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const when = at => new Date(at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const blocked = new URLSearchParams(location.search).get('blocked') === '1';
let keyMsg = '';

async function draw() {
  const s = await getState();
  if (settle(s)) await setState(s);
  const key = await getKey();
  const pend = (op, arg = '') => s.pending.find(p => p.op === op && p.arg === arg);
  const off = pend('off');
  m.innerHTML = `<div class="kicker">Cue for Chrome</div><h1>Settings</h1>
    ${blocked ? `<div class="err">The extensions page is closed while the gate is locked. Turning it off below takes ${DELAY_MS / 3600000}h.</div>` : ''}
    <h2>Cue key</h2><div class="card">
      <form id="kf"><input type="password" id="key" placeholder="APP_KEY" value="${esc(key)}" autocomplete="off"></form>
      <div class="dim" style="margin-top:8px">${keyMsg || (key ? 'Saved. Now and capture on the new tab use it.' : 'The same key as the phone app. Stored only in this browser.')}</div>
    </div>
    <h2>Gate</h2><div class="card">
      <div class="line"><div>${s.on ? 'On' : 'Off'}${s.locked ? ' · locked' : ''}</div>
        <div>${!s.on ? '<button class="x" id="on">turn on</button>' : off ? `<span class="dim">off ${when(off.at)}</span> <button class="x" data-cancel="off">cancel</button>` : '<button class="x" id="offb">turn off</button>'}</div></div>
      ${s.on && !s.locked ? `<div class="line"><div class="dim">Unlocked: removing sites and turning off are instant. Lock once the list is right.</div><div><button class="x" id="lock">lock</button></div></div>` : ''}
      <div class="dim" style="margin-top:8px">Before locking, turn on private windows too: chrome://extensions → Cue → Details → Allow in Incognito (that page is closed once locked). Other browsers aren't covered, so keep feed logins out of them.</div>
    </div>
    <h2>Gated sites</h2><div class="card">
      <form id="af"><input type="text" id="add" placeholder="+ add a site (instant)" autocomplete="off"></form>
      ${s.sites.map(x => { const p = pend('remove', x); return `<div class="line"><div>${esc(x)}</div><div>${p ? `<span class="dim">leaves ${when(p.at)}</span> <button class="x" data-cancel="remove" data-arg="${esc(x)}">cancel</button>` : `<button class="x" data-rm="${esc(x)}">remove</button>`}</div></div>`; }).join('')}
    </div>`;
  document.getElementById('kf').onsubmit = async e => {
    e.preventDefault();
    const v = document.getElementById('key').value.trim();
    await chrome.storage.local.set({ key: v });
    try { await cue('/push?action=status'); keyMsg = 'Saved and checked with Cue.'; chrome.runtime.sendMessage({ type: 'sweep' }); }
    catch (err) { keyMsg = `Saved, but Cue said: ${err.message}`; }
    draw();
  };
  document.getElementById('af').onsubmit = async e => {
    e.preventDefault();
    await change(x => addSite(x, document.getElementById('add').value));
    chrome.runtime.sendMessage({ type: 'sweep' });
    draw();
  };
  const on = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = async () => { await change(fn); chrome.runtime.sendMessage({ type: 'sweep' }); draw(); }; };
  on('#on', turnOn);
  on('#offb', x => turnOff(x));
  on('#lock', lock);
  for (const b of m.querySelectorAll('[data-rm]')) b.onclick = async () => { await change(x => removeSite(x, b.dataset.rm)); draw(); };
  for (const b of m.querySelectorAll('[data-cancel]')) b.onclick = async () => { await change(x => cancel(x, b.dataset.cancel, b.dataset.arg || '')); draw(); };
}
draw();
