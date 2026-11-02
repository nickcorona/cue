// The week card's "what got done", as a few readable lines grouped by area, instead of a
// list of task titles: the titles are written as instructions ("Tenant insurance: buy for
// SVNTY, email policy"), which read badly as a record. Haiku writes it once per week and it's
// kept in state.meta.week_summary; without an API key the card groups titles by area instead.
// Plain outcomes only, no praise or grading (see weekCard).
import Anthropic from '@anthropic-ai/sdk';
import { mutate } from './store.js';
import { weekCard, weekDone } from './metrics.js';

const MODEL = 'claude-haiku-5-5';

const SYSTEM = `You summarize what Nick got done this week, for a card he reads on Sunday to remember it.

Write 3 to 6 short lines, one per area that had something done, most important area first. Each line starts with the area and a colon, then what changed in the world as a result, in past tense and plain words, merging related tasks ("Move: sorted the final inspection timing with the landlord and bought tenant insurance for the new place."). Skip trivial chores unless that's all there was. No praise, no judgment, no counts, no advice, no intro or closing line. Output only the lines.`;

export async function weekSummary(card, done, { client } = {}) {
  client ||= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const list = done.map(t => `- [${t.project || 'Other'}] ${t.title}${t.notes ? ` (notes: ${t.notes.replace(/\s+/g, ' ').slice(0, 160)})` : ''}`).join('\n');
  const res = await client.messages.create({
    model: MODEL, max_tokens: 600, output_config: { effort: 'low' }, system: SYSTEM,
    messages: [{ role: 'user', content: `Week ${card.week}. Done:\n${list}` }],
  });
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    .split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 6);
}

// Writes the summary for the current week card if it's missing. Never throws: the card falls
// back to grouped titles.
export async function ensureWeekSummary(state, now = Date.now(), { client } = {}) {
  const card = weekCard(state, now);
  if (!card || !card.done_count || state.meta.week_summary?.week === card.week) return;
  if (!client && !process.env.ANTHROPIC_API_KEY) return;
  try {
    const lines = await weekSummary(card, weekDone(state, now), { client });
    if (!lines.length) return;
    await mutate(s => { s.meta.week_summary = { week: card.week, lines }; });
    state.meta.week_summary = { week: card.week, lines };
  } catch (e) {
    console.error('week summary failed', e.message);
    await mutate(s => { s.meta.week_summary_error = { at: new Date(now).toISOString(), message: String(e.message).slice(0, 300) }; });
  }
}
