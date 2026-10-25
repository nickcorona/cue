// Queue consumer for scheduled pings (see lib/push.js). Not public: Vercel invokes it when a
// delayed message on the cue-push topic comes due.
import { handleCallback } from '@vercel/queue';
import { read, mutate } from '../lib/store.js';
import { pingContent, pushAll } from '../lib/push.js';
import { dailyRefresh } from '../lib/tools.js';

export const POST = handleCallback(async msg => {
  if (!msg?.key) return;
  // 6am wake-up: run the day's sweep, which schedules today's pings and tomorrow's wake-up.
  if (msg.key.startsWith('day:')) { await dailyRefresh(); return; }
  const state = await read();
  if (state.push?.sent?.[msg.key]) return;
  const content = pingContent(state, msg.key, Date.now(), msg);
  const result = content ? await pushAll(state, content) : { sent: 0, gone: [] };
  await mutate(s => {
    s.push ||= { subs: [], sent: {} };
    s.push.sent ||= {};
    s.push.sent[msg.key] = new Date().toISOString() + (content ? ` sent:${result.sent}` : ' skipped') + (result.errors?.length ? ` err:${result.errors[0]}` : '');
    const cutoff = Date.now() - 3 * 864e5;
    for (const [k, v] of Object.entries(s.push.sent)) if (Date.parse(v.slice(0, 24)) < cutoff) delete s.push.sent[k];
    if (result.gone.length) s.push.subs = (s.push.subs || []).filter(x => !result.gone.includes(x.endpoint));
  });
});
