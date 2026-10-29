// Quick capture from the app: a line of raw text becomes a fully tagged task (or shopping list
// items) without opening a chat. Haiku fills in what Claude would at capture (title, impact,
// est_min, area, family, place) through the same add_tasks / add_to_list tools, so ranking
// gets the same inputs either way. With no API key, or if the call fails, the text is saved as
// an inbox task: kept out of the ranking until Claude files it in the next chat.
import Anthropic from '@anthropic-ai/sdk';
import { read } from './store.js';
import { TOOLS, callTool } from './tools.js';
import { localParts } from './logic.js';

const MODEL = 'claude-haiku-5-5';
const USE = ['add_tasks', 'add_to_list'];

const SYSTEM = `You file quick captures into Cue, Nick's task app. He typed one line on his phone; turn it into tool calls and nothing else (no text reply).

Plain purchases ("eggs", "need omega 3s") go on a store's list with add_to_list. Everything else is add_tasks; one line can hold several tasks.

For each task:
- title: a concrete next action starting with a verb, about 24 characters, detail after a colon or in notes. Keep his meaning; don't invent specifics.
- impact: consequence (what happens if it's late or never done) and magnitude (1 small, 2 medium, 3 large); reversible=false only if the damage can't be undone. Judge from what the task means, factually, so the same task always gets the same tags.
- est_min (your best guess), project (one of the areas below), family (reuse an existing one when it fits), context (where he'd do it) and focus.
- due only for a real date he gave; hard=true only for a real external deadline; expires when the task names a point after which it stops mattering.
- who="claude" when Claude could do the bulk of it (drafting an email or message, research, a lookup) and Nick only reviews or sends. Contacting a person or business defaults to an email draft, never a call.
- priority_override only if he explicitly says how important it is. Never set predicted_mood.`;

function context(state, now = Date.now()) {
  const s = state.settings, lp = localParts(now, s.tz);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][lp.dow];
  const families = [...new Set(state.tasks.filter(t => t.status !== 'dropped').map(t => t.family).filter(Boolean))].sort();
  const lists = (state.lists || []).filter(l => !l.archived).map(l => l.name);
  return `Now: ${lp.date} ${lp.time} (${dow}), ${s.tz}. Dates are local: YYYY-MM-DD or YYYY-MM-DDTHH:MM.
Areas (project) with how much each matters, 1-5: ${Object.entries(s.areas || {}).map(([a, w]) => `${a} (${w})`).join(', ')}.
Existing families: ${families.join(', ') || 'none yet'}.
Shopping lists: ${lists.join(', ') || 'none yet'}.`;
}

// The model's tool calls for one capture: [{ name, input }]. Empty when it made none.
export async function enrich(text, state, { client } = {}) {
  client ||= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: SYSTEM,
    tools: TOOLS.filter(t => USE.includes(t.name)).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: `${context(state)}\n\nCapture: ${text}` }],
  });
  return res.content.filter(b => b.type === 'tool_use' && USE.includes(b.name)).map(b => ({ name: b.name, input: b.input }));
}

const valid = ({ name, input }) => name === 'add_tasks'
  ? Array.isArray(input?.tasks) && input.tasks.length && input.tasks.every(t => typeof t?.title === 'string' && t.title.trim())
  : typeof input?.list === 'string' && Array.isArray(input?.items) && input.items.length;

// Inbox fallback: the raw text as a task, its full text in notes when the title is cut.
function rawTask(text) {
  const title = text.length > 80 ? text.slice(0, 77).trimEnd() + '…' : text;
  return { title, ...(title !== text ? { notes: text } : {}) };
}

export async function capture(text, { client } = {}) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!text) throw new Error('Nothing to capture');
  let calls = [];
  if (client || process.env.ANTHROPIC_API_KEY) {
    try { calls = (await enrich(text, await read(), { client })).filter(valid); } catch (e) { console.error('capture enrich failed', e.message); }
  }
  if (!calls.length) {
    const r = await callTool('add_tasks', { tasks: [rawTask(text)], inbox: true });
    return { inbox: true, added: r.added };
  }
  const added = [], listed = [];
  for (const { name, input } of calls) {
    if (name === 'add_tasks') {
      const r = await callTool('add_tasks', { tasks: input.tasks });
      // Echo what was filled in, so the app can show it and he can catch a bad guess.
      r.added.forEach((a, i) => { const t = input.tasks[i]; added.push({ ...a, ...pick(t, ['est_min', 'project', 'due', 'who']) }); });
    } else {
      const r = await callTool('add_to_list', input);
      listed.push({ list: r.list.name, items: [...r.added, ...(r.already_on_list || [])] });
    }
  }
  return { added, ...(listed.length ? { listed } : {}) };
}

const pick = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] != null).map(k => [k, o[k]]));
