// Queue consumer for scheduled pings (see lib/push.js). Not public: Vercel invokes it when a
// delayed message on the cue-push topic comes due.
import { handleCallback } from '@vercel/queue';
import { read, mutate } from '../lib/store.js';
import { pingContent, pushAll, schedulePing } from '../lib/push.js';
import { busyUntil } from '../lib/calendar.js';
import { localParts } from '../lib/logic.js';
import { dailyRefresh } from '../lib/tools.js';

export const POST = handleCallback(async msg => {
  if (!msg?.key) return;
  // 6am wake-up: run the day's sweep, which schedules today's pings and tomorrow's wake-up.
  if (msg.key.startsWith('day:')) { await dailyRefresh(); return; }
  const state = await read();
  if (state.push?.sent?.[msg.key]) return;
  let content = pingContent(state, msg.key, Date.now(), msg);
  // A buzzing Now ping or idle nudge during a calendar event waits until a minute after it
  // ends (timers he started, like focus, cooking and wait gates, still go off on time).
  const [kind, , , n] = msg.key.split(':');
  if (content && content.renotify && (kind === 'now' || kind === 'idle')) {
    const end = await busyUntil(state);
    if (end) {
      const at = end + 60000, date = localParts(at, state.settings.tz).date;
      const key = kind === 'now' ? `now:${date}:${localParts(at, state.settings.tz).time.replace(':', '')}` : `idle:${date}:${at}:${n || 1}`;
      if (key !== msg.key) await schedulePing(key, at);
      content = null;
    }
  }
  const { followup, ...push } = content || {};
  const result = content ? await pushAll(state, push) : { sent: 0, gone: [] };
  if (followup && result.sent) await schedulePing(followup.key, followup.at);
  await mutate(s => {
    s.push ||= { subs: [], sent: {} };
    s.push.sent ||= {};
    if (content?.now_key && result.sent) s.push.now_last = content.now_key;
    s.push.sent[msg.key] = new Date().toISOString() + (content ? ` sent:${result.sent}` : ' skipped') + (result.errors?.length ? ` err:${result.errors[0]}` : '');
    const cutoff = Date.now() - 3 * 864e5;
    for (const [k, v] of Object.entries(s.push.sent)) if (Date.parse(v.slice(0, 24)) < cutoff) delete s.push.sent[k];
    if (result.gone.length) s.push.subs = (s.push.subs || []).filter(x => !result.gone.includes(x.endpoint));
  });
});
