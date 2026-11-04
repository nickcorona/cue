// New tab: Cue's Now with Done and Not now, quick capture, and what's left today, so every
// tab opened starts from the next action instead of a feed.
import { SERVER, todaysLog } from './rules.js';
import { getState, getKey, cue } from './store.js';

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
$('date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
$('opt').onclick = () => chrome.runtime.openOptionsPage();
$('queue').href = SERVER + '/';

let now = null;
function drawNow(err) {
  const el = $('now');
  if (err) { el.innerHTML = `<div class="err">${esc(err)}</div>`; return; }
  if (!now) { el.innerHTML = `<div class="kicker">Now</div><h1>Nothing up</h1><div class="dim">Capture something, or open the queue.</div>`; return; }
  const title = now.url ? `<a href="${esc(new URL(now.url, SERVER).href)}" style="color:inherit">${esc(now.title)}</a>` : esc(now.title);
  el.innerHTML = `<div class="kicker">Now</div><h1>${title}</h1>${now.body ? `<div class="soft" style="white-space:pre-line">${esc(now.body)}</div>` : ''}
    <div class="row">${now.check ? '<button class="big" id="done">Done</button>' : ''}${now.skip ? '<button class="big alt" id="skip">Not now</button>' : ''}</div>`;
  if (now.check) $('done').onclick = () => act('/push?action=check', { ...now.check, now: true });
  if (now.skip) $('skip').onclick = () => act('/push?action=now_skip', { key: now.skip });
}
async function act(path, body) {
  for (const b of document.querySelectorAll('#now button')) b.disabled = true;
  try { now = (await cue(path, body)).next || null; drawNow(); loadToday(); }
  catch (e) { drawNow(e.message); }
}

async function loadToday() {
  try {
    const w = await cue('/push?action=widget');
    now = w.now || null;
    drawNow();
    $('today').innerHTML = w.today?.length ? `<h2>Today · ${w.done}/${w.total} done</h2><div class="card">` +
      w.today.map(t => `<div class="line"><div>${esc(t.title)}</div><div class="dim">${t.est_min}m</div></div>`).join('') + '</div>' : '';
  } catch (e) {
    drawNow(e.message === 'no key' ? 'Add your Cue key in settings to see Now here.' : `Couldn't reach Cue: ${e.message}`);
  }
}

$('capf').onsubmit = async ev => {
  ev.preventDefault();
  const text = $('cap').value.trim();
  if (!text) return;
  $('capst').textContent = 'Adding…';
  try {
    const r = await cue('/capture', { text });
    const got = [...(r.added || []).map(t => t.title), ...(r.listed || []).flatMap(l => l.items.map(i => `${i} → ${l.list}`))];
    $('capst').textContent = got.length ? `Added: ${got.join(', ')}` : r.inbox ? 'In the inbox' : 'Added';
    $('cap').value = '';
    loadToday();
  } catch (e) { $('capst').textContent = `Didn't save: ${e.message}`; }
};

getState().then(s => { const n = todaysLog(s).length; $('unl').textContent = n ? `${n} unlock${n > 1 ? 's' : ''} today` : 'No unlocks today'; });
getKey().then(k => { if (k) $('queue').href = `${SERVER}/app/${encodeURIComponent(k)}`; });
loadToday();
