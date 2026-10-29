// What routine steps are made of, beyond a title: the product a step uses, whether a step
// is in effect on a day, temporary notes that lapse on their own, and a scored outcome that
// turns a step into an on/off trial ("does the caffeine cream do anything?").
import { addDays, activeOn } from './logic.js';
export { activeOn };

const dayNum = d => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5);

// ---------- dates ----------
// A step (or a temp note) can have from/until dates, or last until a linked task is done.
// until_task is turned into an until date when that task closes (resolveExpiry), so the
// day-to-day checks only ever compare dates (activeOn, in logic.js).

export function resolveExpiry(state, today) {
  const closed = id => {
    const t = state.tasks.find(x => x.id === id);
    if (!t || !['done', 'dropped'].includes(t.status)) return null;
    return (t.completed || t.dropped_at || today).slice(0, 10);
  };
  for (const r of state.routines) {
    for (const st of r.steps) {
      for (const x of [st, ...(st.temp_notes || [])]) {
        const d = x.until_task && closed(x.until_task);
        if (d) { x.until = d; delete x.until_task; }
      }
      if (st.temp_notes) st.temp_notes = st.temp_notes.filter(n => !(n.until && n.until < addDays(today, -30))); // tidy lapsed ones after a month
    }
  }
}

// The step's notes for a day: its own plus any temp notes in effect.
export function notesOn(st, day) {
  const temp = (st.temp_notes || []).filter(n => !n.until_task ? activeOn(n, day) : !(n.from && day < n.from)).map(n => n.text);
  return [...temp, st.notes].filter(Boolean).join('\n\n') || undefined;
}

// ---------- trials ----------
// A step with a metric gets a 0-10 score when it's ticked (or, on an off day, instead of
// doing it). With metric.trial {start, block_days}, days alternate in blocks: on (do the
// step), off (skip it, still score). The first washout_days of each block are left out of
// the comparison, since a cream's effect doesn't switch on or off overnight.
export function trialDay(metric, day) {
  const t = metric?.trial;
  if (!t?.start || day < t.start) return null;
  const k = dayNum(day) - dayNum(t.start), b = t.block_days || 14;
  if (t.end && day > t.end) return null;
  const block = Math.floor(k / b);
  return { on: block % 2 === 0, block, day_in_block: k % b, washout: k % b < (t.washout_days ?? 2) };
}

// On/off comparison for a step's metric. Without a trial schedule, days it was done count as
// on and days it was skipped as off. Lower-is-better metrics (puffiness) say so in the verdict.
export function trialResult(r, st) {
  const m = st.metric;
  if (!m) throw new Error(`"${st.title}" has no metric`);
  const on = [], off = [];
  for (const [day, e] of Object.entries(r.log || {})) {
    const v = e?.values?.[st.id];
    if (v == null) continue;
    const td = trialDay(m, day);
    if (td) { if (!td.washout) (td.on ? on : off).push(v); }
    else if (!m.trial) { if (e.ticks?.[st.id] === 'done') on.push(v); else if (e.ticks?.[st.id] === 'skip') off.push(v); }
  }
  const stats = xs => {
    if (!xs.length) return { n: 0 };
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) : null;
    return { n: xs.length, mean: +mean.toFixed(2), ...(sd != null ? { sd: +sd.toFixed(2) } : {}) };
  };
  const a = stats(on), b = stats(off);
  const out = { step: st.title, metric: m.name, lower_is_better: !!m.lower_better, on: a, off: b };
  if (a.n >= 2 && b.n >= 2) {
    const diff = a.mean - b.mean, se = Math.sqrt(a.sd ** 2 / a.n + b.sd ** 2 / b.n);
    const good = m.lower_better ? diff < 0 : diff > 0;
    out.difference = +diff.toFixed(2);
    out.se = +se.toFixed(2);
    // A rough two-sided read: the difference in standard errors (Welch). Days aren't
    // independent, so treat this as a screen, not a verdict.
    out.z = se > 0 ? +(diff / se).toFixed(2) : null;
    out.read = !se ? 'no spread yet' : Math.abs(diff / se) < 1 ? 'no clear difference yet'
      : Math.abs(diff / se) < 2 ? `leaning ${good ? 'helps' : 'hurts'}` : `${good ? 'helps' : 'hurts'} (about ${Math.abs(diff).toFixed(1)} points)`;
  } else out.read = `need at least 2 scored days in each arm (on ${a.n}, off ${b.n})`;
  if (m.trial) out.trial = { ...m.trial, block_days: m.trial.block_days || 14, washout_days: m.trial.washout_days ?? 2 };
  return out;
}

// ---------- products ----------
// Actives that shouldn't share a routine (same session on the skin): irritation or one
// deactivating the other. Matching is by substring on the lower-cased active name.
const CLASS = {
  retinoid: ['tretinoin', 'retinol', 'retinal', 'adapalene', 'tazarotene', 'retinoid'],
  aha: ['glycolic', 'lactic acid', 'mandelic', 'aha'],
  bha: ['salicylic', 'bha'],
  bpo: ['benzoyl peroxide'],
  vitc: ['ascorbic', 'vitamin c'],
};
const CLASHES = [
  ['retinoid', 'aha', 'retinoid plus an AHA in one session: irritation and barrier damage'],
  ['retinoid', 'bha', 'retinoid plus a BHA in one session: irritation'],
  ['retinoid', 'bpo', 'benzoyl peroxide can break down tretinoin and adds irritation'],
  ['vitc', 'bpo', 'benzoyl peroxide oxidizes vitamin C'],
  ['retinoid', 'vitc', 'vitamin C and a retinoid in one session: irritation (split them AM/PM)'],
  ['aha', 'bha', 'two exfoliating acids in one session: irritation'],
];
const classesOf = actives => new Set(Object.entries(CLASS).filter(([, keys]) => (actives || []).some(a => keys.some(k => String(a).toLowerCase().includes(k)))).map(([c]) => c));

export function clashes(state, today) {
  const out = [];
  const prods = new Map((state.products || []).filter(p => !p.archived).map(p => [p.id, p]));
  for (const r of state.routines.filter(x => !x.archived)) {
    const used = r.steps.filter(st => st.product_id && prods.has(st.product_id) && activeOn(st, today)).map(st => prods.get(st.product_id));
    for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {
      const a = classesOf(used[i].actives), b = classesOf(used[j].actives);
      for (const [x, y, why] of CLASHES) {
        if ((a.has(x) && b.has(y)) || (a.has(y) && b.has(x))) out.push({ routine: r.name, products: [used[i].name, used[j].name], why });
      }
    }
  }
  return out;
}

// Use-by (opened + period after opening, or a printed expiry, whichever is first) and how
// many uses are left, counted from ticks of the steps that use it since it was opened.
export function productStatus(state, p, today) {
  const ends = [p.expires, p.opened && p.pao_months ? addMonths(p.opened, p.pao_months) : null].filter(Boolean).sort();
  const use_by = ends[0] || null;
  let used = 0;
  if (p.opened) {
    for (const r of state.routines) for (const st of r.steps) {
      if (st.product_id !== p.id) continue;
      for (const [day, e] of Object.entries(r.log || {})) if (day >= p.opened && e?.ticks?.[st.id] === 'done') used++;
    }
  }
  const left = p.uses ? Math.max(0, p.uses - used) : null;
  const days = use_by ? dayNum(use_by) - dayNum(today) : null;
  const flags = [];
  if (days != null && days < 0) flags.push(`past its use-by (${use_by})`);
  else if (days != null && days <= 14) flags.push(`use-by in ${days} day${days === 1 ? '' : 's'} (${use_by})`);
  if (left != null && left <= Math.max(3, Math.round(p.uses * 0.15))) flags.push(left ? `about ${left} uses left` : 'should be empty by now');
  const steps = state.routines.flatMap(r => r.steps.filter(st => st.product_id === p.id).map(st => `${r.name}: ${st.title}`));
  return { id: p.id, name: p.name, ...(p.actives?.length ? { actives: p.actives } : {}), ...(p.storage ? { storage: p.storage } : {}),
    ...(p.opened ? { opened: p.opened } : {}), ...(use_by ? { use_by } : {}), ...(p.uses ? { uses: p.uses, used, left } : {}),
    steps, ...(flags.length ? { flags } : {}), ...(p.notes ? { notes: p.notes } : {}), ...(p.archived ? { archived: true } : {}) };
}

function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, d));
  return t.toISOString().slice(0, 10);
}

// Hints for the queue: products that are past or near their use-by or running out, and clashes.
export function productHints(state, today) {
  const hints = [];
  for (const p of (state.products || []).filter(x => !x.archived)) {
    const s = productStatus(state, p, today);
    if (s.flags) hints.push(`${p.name}: ${s.flags.join(', ')}. Tell Nick; offer to add it to a shopping list.`);
  }
  for (const c of clashes(state, today)) hints.push(`Clash in ${c.routine}: ${c.products.join(' + ')} (${c.why}). Tell Nick once.`);
  return hints;
}
