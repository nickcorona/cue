// Build: project backlogs for things Nick is making. Items move inbox → ready (has "done
// when" checks) → building → shipped. Running into the same friction again adds a hit, so
// repeated problems rise and one-offs stay parked. Pure helpers; tools.js wraps them and
// lib/buildui.js is the screen.
//
// state.build = {
//   projects: [{ id, name, area?, repo?, notes?, archived? }],
//   items: [{ id, project_id, title, problem?, why?, done_when: [..], size: 'S'|'M'|'L', stage,
//             hits: [iso], not_before?, commits: [{ sha, url?, msg? }], notes?, created, updated, shipped_at? }],
// }
export const STAGES = ['inbox', 'ready', 'building', 'shipped', 'dropped'];
export const SIZE_MIN = { S: 30, M: 90, L: 180 };
const SIZE_ORDER = { S: 0, M: 1, L: 2 };

export function buildState(state) {
  state.build ||= { projects: [], items: [] };
  state.build.projects ||= [];
  state.build.items ||= [];
  return state.build;
}

// Hits in the last 60 days: old friction fades instead of ranking forever.
export const recentHits = (it, now = Date.now()) => (it.hits || []).filter(h => now - Date.parse(h) < 60 * 864e5).length;

// Order within a stage: most-hit first, then smaller, then older.
export function rankItems(items, now = Date.now(), today = null) {
  return [...items].sort((a, b) =>
    (b.stage === 'building') - (a.stage === 'building') ||
    ((today && a.not_before > today) - (today && b.not_before > today)) ||
    recentHits(b, now) - recentHits(a, now) ||
    (SIZE_ORDER[a.size] ?? 1) - (SIZE_ORDER[b.size] ?? 1) ||
    Date.parse(a.created) - Date.parse(b.created));
}

export function itemOut(it, now = Date.now()) {
  return {
    id: it.id, project_id: it.project_id, title: it.title, stage: it.stage, size: it.size || 'M',
    hits: recentHits(it, now), ...(it.problem ? { problem: it.problem } : {}), ...(it.why ? { why: it.why } : {}),
    done_when: it.done_when || [], commits: it.commits || [], ...(it.notes ? { notes: it.notes } : {}),
    ...(it.not_before ? { not_before: it.not_before } : {}), created: it.created, ...(it.shipped_at ? { shipped_at: it.shipped_at } : {}),
  };
}

// A paste-ready brief for a Claude Code session.
export function brief(project, it) {
  const lines = [`# ${it.title}`, '', `Project: ${project.name}${project.repo ? ` (${project.repo})` : ''}`];
  if (it.problem) lines.push('', '## Problem', it.problem);
  if (it.why) lines.push('', '## Why it matters', it.why);
  if (recentHits(it) > 1) lines.push('', `Hit ${recentHits(it)} times in the last 60 days.`);
  if (it.done_when?.length) lines.push('', '## Done when', ...it.done_when.map(d => `- ${d}`));
  if (it.notes) lines.push('', '## Notes', it.notes);
  lines.push('', '## How to work', 'Test against each "done when" before shipping. When it is done, record the commit on this Cue build item (build_update with add_commit) and set stage shipped.', `Cue build item: ${it.id}`);
  return lines.join('\n');
}
