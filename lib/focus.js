// Cue Focus: timed work blocks on a task. Each block records the minutes actually worked,
// which feed the estimate correction (on completion) and goal minutes (as they happen).
//
// state.focus = {
//   sessions: [{ id, task_id?, title, project?, planned_min, started, paused_at?, paused_ms,
//                ended?, minutes?, outcome?: 'done'|'progress'|'stopped' }],
//   brk?: { until, after }   // a break in progress (epoch ms), after = session id
// }
export const DEFAULT_BLOCKS = [25, 50];

export function focusState(state) {
  state.focus ||= { sessions: [] };
  state.focus.sessions ||= [];
  return state.focus;
}

// Milliseconds worked so far (pauses excluded).
export function workedMs(s, now = Date.now()) {
  const end = s.ended ? Date.parse(s.ended) : s.paused_at ? Date.parse(s.paused_at) : now;
  return Math.max(0, end - Date.parse(s.started) - (s.paused_ms || 0));
}

// When the block runs out, if it keeps running (null while paused or ended).
export function endsAt(s) {
  if (s.ended || s.paused_at) return null;
  return Date.parse(s.started) + (s.paused_ms || 0) + s.planned_min * 60000;
}

export function sessionOut(s, now = Date.now()) {
  return {
    id: s.id, task_id: s.task_id || null, title: s.title, project: s.project || null,
    planned_min: s.planned_min, started: s.started, paused: !!s.paused_at,
    worked_s: Math.round(workedMs(s, now) / 1000),
    ends_at: endsAt(s) ? new Date(endsAt(s)).toISOString() : null,
    ...(s.ended ? { ended: s.ended, minutes: s.minutes, outcome: s.outcome } : {}),
  };
}

// Focused minutes per project over sessions ending (or running) since `since` (epoch ms).
export function minutesByProject(focus, since, now = Date.now()) {
  const out = {};
  for (const s of focus.sessions) {
    const t = s.ended ? Date.parse(s.ended) : now;
    if (t < since || !s.project) continue;
    out[s.project] = (out[s.project] || 0) + (s.ended ? s.minutes || 0 : workedMs(s, now) / 60000);
  }
  return out;
}
