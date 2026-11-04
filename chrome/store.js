// Reads and writes the one gate state in chrome.storage.local, plus the Cue key.
import { load, SERVER } from './rules.js';

export async function getState() { return load((await chrome.storage.local.get('gate')).gate); }
export async function setState(s) { await chrome.storage.local.set({ gate: s }); }
// Read, change, save: the change function edits the state in place and may return a value.
export async function change(fn) {
  const s = await getState();
  const out = await fn(s);
  await setState(s);
  return out;
}
export async function getKey() { return (await chrome.storage.local.get('key')).key || ''; }

// A call to the Cue server, signed with the key. Throws on no key or a failed request.
export async function cue(path, body) {
  const key = await getKey();
  if (!key) throw new Error('no key');
  const url = `${SERVER}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
  const r = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(r.status === 401 ? 'key rejected' : `Cue ${r.status}`);
  return r.json();
}
