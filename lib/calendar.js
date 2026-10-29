// Busy time from Nick's calendar, read from Google Calendar's secret iCal address(es) in
// CALENDAR_ICS_URL (comma-separated for several calendars). Only events inside his personal
// hours count (evenings on weekdays, the day on weekends), so work meetings during the day
// don't eat into task capacity. Events Cue itself put on the calendar (plan blocks, routine
// and habit pings) and free or all-day events are ignored so nothing is counted twice.
import ical from 'node-ical';
import { localParts, localToEpoch, addDays, dowOf } from './logic.js';

const TTL = 10 * 60 * 1000;
const DAYS_AHEAD = 45;
let cache = null; // { at, text }

async function fetchFeeds(urls) {
  if (cache && Date.now() - cache.at < TTL) return cache.text;
  const texts = await Promise.all(urls.map(async u => {
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`calendar feed ${r.status}`);
    return r.text();
  }));
  cache = { at: Date.now(), text: texts };
  return texts;
}

function windowFor(date, s) {
  const dow = dowOf(date);
  const w = (dow === 0 || dow === 6 ? s.personal_hours?.weekend : s.personal_hours?.weekday) || { start: '00:00', end: '23:59' };
  return [localToEpoch(`${date}T${w.start}`, s.tz), localToEpoch(`${date}T${w.end}`, s.tz)];
}

// Concrete [start, end) intervals for every event occurrence in the range.
function occurrences(ev, from, to) {
  const len = ev.end ? ev.end - ev.start : 0;
  if (!ev.rrule) return ev.start >= from - len && ev.start < to ? [[+ev.start, +ev.start + len]] : [];
  const out = [];
  for (const d of ev.rrule.between(new Date(from - len), new Date(to), true)) {
    const key = d.toISOString().slice(0, 10);
    if (ev.exdate && Object.keys(ev.exdate).some(k => k.startsWith(key))) continue;
    const o = ev.recurrences?.[key];
    if (o) { if (o.status !== 'CANCELLED' && o.transparency !== 'TRANSPARENT') out.push([+o.start, +(o.end || o.start)]); continue; }
    out.push([+d, +d + len]);
  }
  return out;
}

// Every busy [start, end) from yesterday to DAYS_AHEAD out: real events only (not all-day,
// free, cancelled, or the plan/routine/habit events Cue itself put there).
async function busyIntervals(state, now) {
  const urls = (process.env.CALENDAR_ICS_URL || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!urls.length) return { status: 'not connected', intervals: [] };
  const s = state.settings;
  const own = new Set([...state.routines, ...state.habits].map(x => (x.name || '').trim().toLowerCase()).filter(Boolean));
  const today = localParts(now, s.tz).date;
  const from = localToEpoch(`${addDays(today, -1)}T00:00`, s.tz), to = localToEpoch(`${addDays(today, DAYS_AHEAD)}T00:00`, s.tz);
  let texts;
  try { texts = await fetchFeeds(urls); } catch (e) { return { status: `error: ${e.message}`, intervals: [] }; }
  const intervals = [];
  for (const text of texts) {
    for (const ev of Object.values(ical.sync.parseICS(text))) {
      if (ev.type !== 'VEVENT' || ev.datetype === 'date' || ev.status === 'CANCELLED' || ev.transparency === 'TRANSPARENT') continue;
      const title = String(ev.summary?.val ?? ev.summary ?? '').trim().toLowerCase();
      const desc = String(ev.description?.val ?? ev.description ?? '');
      if (own.has(title) || /nick-(tasks|cue)\.vercel\.app/.test(desc)) continue;
      intervals.push(...occurrences(ev, from, to));
    }
  }
  return { status: 'connected', intervals };
}

// When the event(s) covering `now` end (chained back-to-back events count as one), or null.
export function busyEnd(intervals, now) {
  let end = null;
  for (let grew = true; grew;) {
    grew = false;
    for (const [a, b] of intervals) if (a <= (end ?? now) && b > (end ?? now)) { end = b; grew = true; }
  }
  return end;
}

// Is he in an event right now? Returns its end (epoch ms) or null; never throws.
export async function busyUntil(state, now = Date.now()) {
  try { return busyEnd((await busyIntervals(state, now)).intervals, now); } catch { return null; }
}

export async function busyByDate(state, now = Date.now()) {
  const s = state.settings, today = localParts(now, s.tz).date;
  const { status, intervals } = await busyIntervals(state, now);
  if (status !== 'connected') return { status, busy: {} };
  // Busy minutes per day inside personal hours, with overlapping events merged.
  const busy = {};
  for (let d = addDays(today, -1); d < addDays(today, DAYS_AHEAD); d = addDays(d, 1)) {
    const [ws, we] = windowFor(d, s);
    const clipped = intervals.map(([a, b]) => [Math.max(a, ws), Math.min(b, we)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    let total = 0, curA = null, curB = null;
    for (const [a, b] of clipped) {
      if (curB == null || a > curB) { if (curB != null) total += curB - curA; curA = a; curB = b; } else curB = Math.max(curB, b);
    }
    if (curB != null) total += curB - curA;
    if (total) busy[d] = Math.round(total / 60000);
  }
  return { status: 'connected', busy };
}

// Attach busy minutes to the settings for this request only: non-enumerable, so a later
// save never writes them to the store.
export async function withCalendar(state) {
  const { status, busy } = await busyByDate(state);
  Object.defineProperty(state.settings, 'busy', { value: busy, enumerable: false, configurable: true });
  Object.defineProperty(state.settings, 'calendar', { value: status, enumerable: false, configurable: true });
  return state;
}
