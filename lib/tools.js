import crypto from 'node:crypto';
import { read, mutate } from './store.js';
import {
  rankTasks, why, localParts, capacityOn, similarity, effectiveTime, goalStatus, taskWeight, weightLevel, habitStatus, routineStatus, durationModel,
  advanceDue, scheduledOn, isAvailable, addDays,
} from './logic.js';

const id = p => `${p}_${crypto.randomBytes(4).toString('hex')}`;
const nowIso = () => new Date().toISOString();

export const INSTRUCTIONS = `This is Nick's task, habit and routine system. He captures everything through Claude, so treat this as the source of truth.

CAPTURE: When Nick mentions something he needs to do, add it with add_tasks. Don't ask permission for obvious captures. Write the title as a concrete next action starting with a verb ("Email Sam the Q3 loss ratios", not "Q3 stuff"). A specific next action is what stops an open loop from nagging (Masicampo & Baumeister 2011). Always set est_min (your best guess is fine), project (the area it belongs to, from settings.areas), and impact instead of a priority: consequence = what happens if it's done late or never (none, annoyance, money, health, career, legal), magnitude = how big that is (1 small, 2 medium, 3 large), reversible = false only if the damage can't be undone. Judge these from the task's meaning and his goals, and keep them factual so the same task always gets the same tags. The server turns them into the ranking weight. Set priority_override (1-4) only when Nick explicitly says how important something is. Also set family (a short canonical label shared by every version of the same kind of task); reuse labels you've seen in get_queue or find. If add_tasks reports possible_duplicates, tell him and offer to drop the new task or merge it into the existing one. Set due only if there is a real date. Set hard=true only for real external deadlines.

TRIAGE: Before adding, ask yourself whether Claude can do the task itself (drafting, research, calculations, lookups). If Claude can do it fully right now, offer to just do it. If Claude can do the bulk but Nick has to review or send it, add it with who="claude" and offer to start. who="me" is for things only Nick can do.

WHAT NEXT: When he asks what to do, call get_queue. Present routines and habits that are due first, especially anything flagged dont_miss_twice. Then show the top tasks in the given order. Don't reorder by your own judgment. If he disagrees with the order because an input is wrong (impact, estimate, due, hard), fix the input with update_tasks and say which one. If he just wants a specific order ("do X before Y", "put this first"), use reorder: it is his call and it is logged as a preference for later calibration.

CHECKING OFF: When he says he did something, find the item (the ids are in get_queue, or use find) and call check_off. Ask how long it took only if the task was 30 minutes or more and he hasn't said. Actual times train the estimate correction.

HABITS: Define each habit as an implementation intention: cue = an existing event ("after I pour my morning coffee"), behavior = the small action. If he misses once, that's fine. Two misses in a row is the thing to prevent. When he's sick or travelling, offer to skip habits and routines for the day (check_off with skip=true): skips are excused, so they don't count as misses. When automaticity_check_due is true, ask the 4 SRBAI items (1 to 7 agreement) and save them with log_automaticity: "[Behavior] is something I do automatically", "...I do without having to consciously remember", "...I do without thinking", "...I start doing before I realize I'm doing it".

TODAY'S LOAD: get_queue returns today_load. If over_capacity is true, say so plainly and suggest which dated tasks to move (soft ones first) rather than letting the day silently overflow.

GOALS: A goal guarantees a project a weekly minimum of time (save_goal). get_queue reports each goal's last-7-day minutes and shortfall, and tasks in a behind goal get boosted. When he says something matters but keeps slipping (job search, a side project), suggest a goal for it. Only tasks with a matching project field count.

PLAN MY DAY: When he asks to plan the day (or right after the morning check-in if he wants it), read today's calendar, take today_load plus the top of get_queue, and propose time blocks in real free gaps: hard deadlines first, then the ranked order, using each task's corrected estimate plus a 10 minute buffer, never more than today's capacity, and leave existing events and routine times alone. Show the plan as a short list, and only after he says yes create the calendar events (private, popup at start). Title each with the task(s). Make the description something he can act from without opening anything else, in HTML: per task a bold title with deadline and estimate, the concrete steps from its notes, and direct links: look up the relevant email threads in Gmail and link them, link any URL already in the notes (forms, LinkedIn threads), and link the app or site the task happens in. End with a link to https://nick-tasks.vercel.app/ to check it off. If the day doesn't fit, say what moves to tomorrow.

WEEKLY REVIEW: When he does the weekly review (the Sunday routine, or he asks), call review and go through it in this order: overdue tasks (reschedule, drop or do), stale tasks in batches of about 10 (for each: keep, drop, or defer with a start date, and propose your call so he only has to confirm), waiting-on items (chase or drop), then habits (low rate or flat automaticity means shrink the behavior or change the cue). Finish by re-checking priorities on the top 10 of get_queue. Apply his decisions with update_tasks in one batch.

Dates are local time (America/Toronto by default). Use YYYY-MM-DD or YYYY-MM-DDTHH:MM. get_queue returns the current local date and time. Keep replies short.`;

const taskProps = {
  title: { type: 'string', description: 'Concrete next action, verb first' },
  notes: { type: 'string' },
  impact: {
    type: 'object', description: 'Facts the priority is computed from. Set on every task.',
    properties: {
      consequence: { type: 'string', enum: ['none', 'annoyance', 'money', 'health', 'career', 'legal'], description: 'What happens if it is late or never done' },
      magnitude: { type: 'integer', enum: [1, 2, 3], description: '1 small, 2 medium, 3 large' },
      reversible: { type: 'boolean', description: 'false only if the damage cannot be undone' },
    },
    required: ['consequence', 'magnitude'],
  },
  priority_override: { type: 'integer', enum: [1, 2, 3, 4], description: 'Only when Nick explicitly states the priority (1 highest). Overrides impact.' },
  priority: { type: 'integer', enum: [1, 2, 3, 4], description: 'Legacy manual priority, used only for tasks without impact' },
  est_min: { type: 'number', description: 'Raw estimate in minutes. The server corrects for your usual overrun.' },
  due: { type: 'string', description: 'YYYY-MM-DD or YYYY-MM-DDTHH:MM local' },
  hard: { type: 'boolean', description: 'True only for a real external deadline' },
  start: { type: 'string', description: 'Hide until this date (YYYY-MM-DD)' },
  context: { type: 'string', description: 'Where or how it gets done, e.g. work, home, errands, computer, phone. Used for batching.' },
  family: { type: 'string', description: 'Short canonical label for what kind of task this is, shared by every version of the same thing: "deposit e-transfer", "book doctor appointment", "linkedin outreach", "home cleaning". Lowercase, 2-4 words. The server snaps it to an existing family when it is close.' },
  project: { type: 'string' },
  who: { type: 'string', enum: ['me', 'claude'], description: 'claude = Claude can do or draft it, Nick reviews' },
  blocked_by: { type: 'array', items: { type: 'string' }, description: 'Task ids that must finish first' },
  repeat: {
    type: 'object', description: 'Recurring task. On completion the due date rolls forward.',
    properties: { every: { type: 'integer' }, unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] } },
    required: ['unit'],
  },
};

const scheduleProps = {
  days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: '0 = Sun .. 6 = Sat. Omit for every day.' },
  time: { type: 'string', description: 'HH:MM local, or omit for anytime' },
};

export const TOOLS = [
  {
    name: 'get_queue',
    description: 'What to do now: routines and habits due today, then tasks ranked by Apparent Tardiness Cost (priority per minute, boosted as deadline slack runs out). Also returns lists of waiting tasks, tasks Claude can do, and prompts.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', description: 'Max tasks, default 10' }, context: { type: 'string', description: 'Only tasks in this context' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_tasks',
    description: 'Capture one or more tasks.',
    inputSchema: { type: 'object', properties: { tasks: { type: 'array', items: { type: 'object', properties: taskProps, required: ['title'] } } }, required: ['tasks'] },
  },
  {
    name: 'update_tasks',
    description: 'Edit tasks. Pass only the fields you want to change. Set a field to null to clear it. status can be open, waiting (on someone else), done or dropped.',
    inputSchema: {
      type: 'object',
      properties: { updates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['open', 'waiting', 'done', 'dropped'] }, waiting_on: { type: 'string' }, ...taskProps }, required: ['id'] } } },
      required: ['updates'],
    },
  },
  {
    name: 'check_off',
    description: 'Mark things done: a task, a habit for a day, a whole routine, or one routine step. Set undo=true to reverse. For habits and routines, skip=true excuses today (sick, travelling) and snooze_until moves it later today.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['task', 'habit', 'routine', 'routine_step'] },
              id: { type: 'string' },
              step: { type: 'integer', description: 'Step index for routine_step' },
              date: { type: 'string', description: 'YYYY-MM-DD, default today (for habits/routines)' },
              actual_min: { type: 'number', description: 'How long the task actually took' },
              note: { type: 'string' },
              undo: { type: 'boolean' },
              skip: { type: 'boolean', description: 'Habit/routine only: skip it today as an excused day (not a miss)' },
              snooze_until: { type: 'string', description: 'Habit/routine only: HH:MM later today to move it to' },
              via: { type: 'string', enum: ['chat', 'panel', 'web'], description: 'Where the check-off happened; omit from chat' },
            },
            required: ['kind', 'id'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'find',
    description: 'Search or list tasks, habits and routines. Use it to resolve "the dentist thing" to an id, or to review a project or context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }, kind: { type: 'string', enum: ['task', 'habit', 'routine'] },
        status: { type: 'string', enum: ['open', 'waiting', 'done', 'dropped', 'any'], description: 'Tasks only, default open+waiting' },
        context: { type: 'string' }, project: { type: 'string' }, who: { type: 'string', enum: ['me', 'claude'] },
        limit: { type: 'integer' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'save_habit',
    description: 'Create a habit, or update one if id is given. Write it as an implementation intention: cue (an existing event) + behavior (small, specific).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, cue: { type: 'string', description: 'After I ...' }, behavior: { type: 'string', description: 'I will ...' }, ...scheduleProps, notes: { type: 'string' }, archived: { type: 'boolean' } },
    },
  },
  {
    name: 'save_routine',
    description: 'Create or update a routine: an ordered list of steps done together (e.g. morning, shutdown, weekly review). A step can link to a habit with habit_id, and checking that step also logs the habit. Passing steps replaces the whole list.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, name: { type: 'string' }, cue: { type: 'string' }, ...scheduleProps,
        steps: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, est_min: { type: 'number' }, habit_id: { type: 'string' }, notes: { type: 'string' } }, required: ['title'] } },
        notes: { type: 'string' }, archived: { type: 'boolean' },
      },
    },
  },
  {
    name: 'reorder',
    description: 'Manually move a task in the queue: one place up or down, directly above or below another task, or pin it to the top for today. The move persists as a multiplier on the task score (pins clear tomorrow) and is logged as a preference. clear=true removes any manual adjustment.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, direction: { type: 'string', enum: ['up', 'down', 'top'] },
        above: { type: 'string', description: 'Put it just above this task id' }, below: { type: 'string', description: 'Put it just below this task id' },
        clear: { type: 'boolean' }, via: { type: 'string', enum: ['chat', 'panel', 'web'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'save_goal',
    description: 'Set or change a weekly time minimum for a project, e.g. Job search at 120 minutes/week. Tasks in that project get boosted in the queue while the goal is behind. weekly_min 0 or archived=true removes it.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, weekly_min: { type: 'number' }, archived: { type: 'boolean' } }, required: ['project'] },
  },
  {
    name: 'log_automaticity',
    description: 'Save a weekly SRBAI automaticity check for a habit: four 1 to 7 ratings (does it automatically, without consciously remembering, without thinking, starts before realizing).',
    inputSchema: { type: 'object', properties: { habit_id: { type: 'string' }, scores: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, minItems: 4, maxItems: 4 } }, required: ['habit_id', 'scores'] },
  },
  {
    name: 'review',
    description: 'Weekly review data: habit stats and automaticity trends, estimate-overrun model, what got done this week, overdue tasks, stale tasks, waiting-on list.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'delete',
    description: 'Permanently delete a task, habit or routine. Prefer status=dropped or archived=true unless Nick asks for deletion.',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['task', 'habit', 'routine'] }, id: { type: 'string' } }, required: ['kind', 'id'] },
    annotations: { destructiveHint: true },
  },
  {
    name: 'settings',
    description: 'Read or change ranking settings: capacity_min_per_day (focused task minutes on a weekday), capacity_weekend_min (same for Sat/Sun), areas (importance 1-5 per project/area; pass the full map), k (how early deadlines start to bite), urgency_hard, urgency_soft, default_est_min, tz.',
    inputSchema: { type: 'object', properties: { capacity_min_per_day: { type: 'number' }, capacity_weekend_min: { type: 'number' }, areas: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 5 } }, k: { type: 'number' }, urgency_hard: { type: 'number' }, urgency_soft: { type: 'number' }, default_est_min: { type: 'number' }, tz: { type: 'string' } } },
  },
];

// ---------- helpers ----------

const TASK_FIELDS = Object.keys(taskProps).concat(['status', 'waiting_on']);

function cleanTask(t) {
  const out = {};
  for (const k of ['id', 'title', 'level', 'impact', 'priority_override', 'est_min', 'due', 'hard', 'start', 'context', 'project', 'family', 'who', 'status', 'waiting_on', 'repeat', 'blocked_by', 'notes']) {
    if (t[k] !== undefined && t[k] !== null && !(Array.isArray(t[k]) && !t[k].length) && t[k] !== false) out[k] = t[k];
  }
  return out;
}

// When and where a choice happened, so the learned model can separate preference from
// convenience (errands get done when you're out, not because you value them).
function choiceContext(state, via) {
  const lp = localParts(Date.now(), state.settings.tz);
  return { local_time: lp.time, dow: lp.dow, via: via || 'chat', last_context: state.meta.last_context || null };
}

// Reuse an existing family label when the new one is clearly the same thing.
function snapFamily(state, family) {
  const f = String(family).trim().toLowerCase();
  const known = [...new Set(state.tasks.map(t => t.family).filter(Boolean))];
  if (known.includes(f)) return f;
  let best = null, bestSim = 0;
  for (const k of known) { const sim = similarity(k, f); if (sim > bestSim) { best = k; bestSim = sim; } }
  return bestSim >= 0.6 ? best : f;
}

function mustFind(list, itemId, kind) {
  const x = list.find(y => y.id === itemId);
  if (!x) throw new Error(`No ${kind} with id ${itemId}`);
  return x;
}

function queue(state, { limit = 10, context } = {}) {
  const now = Date.now();
  const s = state.settings;
  const lp = localParts(now, s.tz);
  const today = lp.date;
  const { scored, factor } = rankTasks(state, now);

  // Today's load: corrected minutes of task work due today or overdue, against daily capacity.
  // Routines are reported separately since capacity only counts task time.
  const dueNow = scored.filter(x => x.t.due && x.t.due.slice(0, 10) <= today);
  const routineMin = state.routines.filter(r => !r.archived).map(r => routineStatus(r, today))
    .filter(st => st.scheduled && !st.done)
    .reduce((a, st) => a + st.steps.filter(x => !x.done).reduce((b, x) => b + (x.est_min || 0), 0), 0);
  const dueMin = Math.round(dueNow.reduce((a, x) => a + x.p, 0));
  const today_load = {
    due_today_tasks: dueNow.length,
    due_today_min: dueMin,
    hard_due_today: dueNow.filter(x => x.t.hard).length,
    routine_min_left: routineMin,
    capacity_min: capacityOn(today, s),
    over_capacity: dueMin > capacityOn(today, s),
  };
  const ranked = scored.filter(x => !context || x.t.context === context);

  const routines = state.routines.filter(r => !r.archived).map(r => ({ r, st: routineStatus(r, today) }))
    .filter(x => x.st.scheduled && !x.st.done && !x.st.skipped)
    .map(x => ({ ...x, time: effectiveTime(x.r, today) }))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    .map(({ r, st, time }) => ({
      id: r.id, name: r.name, time: time || 'anytime', late: !!(time && time < lp.time),
      steps_done: `${st.steps.filter(x => x.done).length}/${st.steps.length}`,
      next_step: st.next_step ? { index: st.next_step.index, title: st.next_step.title, ...(st.next_step.notes ? { notes: st.next_step.notes } : {}) } : null,
    }));

  const habits = state.habits.filter(h => !h.archived).map(h => ({ h, st: habitStatus(h, today) }))
    .filter(x => x.st.due_today)
    .map(x => ({ ...x, time: effectiveTime(x.h, today) }))
    .sort((a, b) => (b.st.dont_miss_twice - a.st.dont_miss_twice) || (a.time || '99').localeCompare(b.time || '99'))
    .map(({ h, st, time }) => ({
      id: h.id, name: h.name, intention: `After I ${h.cue || '...'}, I will ${h.behavior || h.name}`,
      time: time || 'anytime', dont_miss_twice: st.dont_miss_twice, rate_28d: st.rate_28d,
      ...(st.automaticity_check_due ? { automaticity_check_due: true } : {}),
    }));

  const open = state.tasks.filter(t => t.status === 'open');
  return {
    now: `${today} ${lp.time} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][lp.dow]})`,
    routines,
    habits,
    tasks: ranked.slice(0, limit).map((x, i) => ({ rank: i + 1, ...cleanTask(x.t), level: weightLevel(x.w), weight: +x.w.toFixed(1), score: +x.score.toFixed(2), why: why(x) })),
    more_tasks: Math.max(0, ranked.length - limit),
    claude_can_do: open.filter(t => t.who === 'claude').map(t => ({ id: t.id, title: t.title, due: t.due })),
    waiting: state.tasks.filter(t => t.status === 'waiting').map(t => ({ id: t.id, title: t.title, waiting_on: t.waiting_on })),
    hidden: {
      deferred: open.filter(t => t.start && t.start.slice(0, 10) > today).length,
      blocked: open.filter(t => t.who !== 'claude' && !isAvailable(t, state, today) && !(t.start && t.start.slice(0, 10) > today)).length,
    },
    today_load,
    goals: goalStatus(state, now),
    families: [...new Set(state.tasks.filter(t => t.status !== 'dropped').map(t => t.family).filter(Boolean))].sort(),
    estimate_multiplier: factor,
  };
}

// ---------- handlers ----------

const handlers = {
  async get_queue(args) { return queue(await read(), args); },

  async add_tasks({ tasks }) {
    return mutate(state => {
      const added = tasks.map(input => {
        const t = { id: id('t'), status: 'open', who: 'me', created: nowIso(), ...pick(input, Object.keys(taskProps)) };
        if (t.family) t.family = snapFamily(state, t.family);
        // Warn about open tasks that look like another version of this one.
        const dupes = state.tasks.filter(x => ['open', 'waiting'].includes(x.status))
          .map(x => ({ x, sim: similarity(x.title, t.title) }))
          .filter(({ x, sim }) => sim >= 0.6 || (t.family && x.family === t.family && sim >= 0.5))
          .sort((a, b) => b.sim - a.sim).slice(0, 3)
          .map(({ x, sim }) => ({ id: x.id, title: x.title, similarity: +sim.toFixed(2) }));
        state.tasks.push(t);
        return { id: t.id, title: t.title, ...(t.family ? { family: t.family } : {}), ...(dupes.length ? { possible_duplicates: dupes } : {}) };
      });
      return { added };
    });
  },

  async update_tasks({ updates }) {
    return mutate(state => {
      const updated = updates.map(u => {
        const t = mustFind(state.tasks, u.id, 'task');
        for (const k of TASK_FIELDS) if (k in u) { if (u[k] === null) delete t[k]; else t[k] = u[k]; }
        if (u.family) t.family = snapFamily(state, u.family);
        if (u.status === 'done' && !t.completed) t.completed = nowIso();
        if (u.status === 'open') delete t.completed;
        t.updated = nowIso();
        return cleanTask(t);
      });
      return { updated };
    });
  },

  async check_off({ items }) {
    return mutate(state => {
      const today = localParts(Date.now(), state.settings.tz).date;
      const results = items.map(it => {
        const date = it.date || today;
        if (it.kind === 'task') {
          const t = mustFind(state.tasks, it.id, 'task');
          if (it.undo) {
            t.status = 'open'; delete t.completed;
            return { task: t.title, status: 'reopened' };
          }
          if (it.actual_min && t.est_min) state.estimates.push({ est: t.est_min, actual: it.actual_min, at: nowIso() });
          // Snapshot the ranking at the moment of choice, for fitting a paired-comparison
          // model later: the chosen task beat everything ranked above it.
          const ranked = rankTasks(state).scored;
          const pos = ranked.findIndex(x => x.t.id === t.id);
          if (pos >= 0) {
            const feat = x => ({ id: x.t.id, family: x.t.family || null, weight: +x.w.toFixed(2), area: x.t.project || null, area_importance: state.settings.areas?.[x.t.project] ?? null, consequence: x.t.impact?.consequence || null, magnitude: x.t.impact?.magnitude || null, reversible: x.t.impact?.reversible ?? null, override: x.t.priority_override || null, priority: x.t.priority || 4, est_min: x.t.est_min || null, slack: x.slack == null ? null : Math.round(x.slack), hard: !!x.t.hard, context: x.t.context || null, project: x.t.project || null, score: +x.score.toFixed(3) });
            state.choices = (state.choices || []).concat({ at: nowIso(), ...choiceContext(state, it.via), chosen: feat(ranked[pos]), rank: pos + 1, above: ranked.slice(0, Math.min(pos, 10)).map(feat) }).slice(-2000);
          }
          if (t.context) state.meta.last_context = t.context;
          t.history = (t.history || []).concat({ done: nowIso(), ...(it.actual_min ? { actual_min: it.actual_min } : {}), ...(it.note ? { note: it.note } : {}) }).slice(-50);
          if (t.repeat && t.due) {
            t.due = advanceDue(t.due, t.repeat);
            while (t.due.slice(0, 10) < today) t.due = advanceDue(t.due, t.repeat);
            return { task: t.title, status: 'done, next due ' + t.due };
          }
          t.status = 'done'; t.completed = nowIso();
          return { task: t.title, status: 'done' };
        }
        if ((it.kind === 'habit' || it.kind === 'routine') && (it.skip || it.snooze_until)) {
          const x = mustFind(it.kind === 'habit' ? state.habits : state.routines, it.id, it.kind);
          if (it.snooze_until) { x.snooze = { date, until: it.snooze_until }; return { [it.kind]: x.name, date, moved_to: it.snooze_until }; }
          x.log ||= {};
          if (it.kind === 'habit') { if (it.undo) delete x.log[date]; else x.log[date] = { skipped: true }; }
          else { const e = (x.log[date] ||= { steps: [] }); if (it.undo) delete e.skipped; else e.skipped = true; }
          return { [it.kind]: x.name, date, skipped: !it.undo };
        }
        if (it.kind === 'habit') {
          const h = mustFind(state.habits, it.id, 'habit');
          h.log ||= {};
          if (it.undo) delete h.log[date]; else h.log[date] = { done: true, ...(it.note ? { note: it.note } : {}) };
          return { habit: h.name, date, done: !it.undo };
        }
        const r = mustFind(state.routines, it.id, 'routine');
        r.log ||= {};
        const entry = (r.log[date] ||= { steps: [] });
        const touch = idx => {
          entry.steps[idx] = !it.undo;
          const hid = r.steps[idx]?.habit_id;
          const h = hid && state.habits.find(x => x.id === hid);
          if (h) { h.log ||= {}; if (it.undo) delete h.log[date]; else h.log[date] = { done: true, via: r.id }; }
        };
        if (it.kind === 'routine_step') {
          if (it.step == null || !r.steps[it.step]) throw new Error(`Routine ${r.name} has no step ${it.step}`);
          touch(it.step);
        } else {
          r.steps.forEach((_, i) => touch(i));
        }
        entry.done = r.steps.every((_, i) => entry.steps[i]);
        const next = r.steps.findIndex((_, i) => !entry.steps[i]);
        return { routine: r.name, date, done: entry.done, next_step: next >= 0 ? r.steps[next].title : null };
      });
      return { results };
    });
  },

  async find({ query, kind, status, context, project, who, limit = 30 }) {
    const state = await read();
    const q = query?.toLowerCase();
    const hit = (...fields) => !q || fields.some(f => f && String(f).toLowerCase().includes(q));
    const out = {};
    if (!kind || kind === 'task') {
      out.tasks = state.tasks.filter(t =>
        (status === 'any' || (status ? t.status === status : ['open', 'waiting'].includes(t.status))) &&
        (!context || t.context === context) && (!project || t.project === project) && (!who || t.who === who) &&
        hit(t.title, t.notes, t.project, t.context)).slice(0, limit).map(cleanTask);
    }
    const today = localParts(Date.now(), state.settings.tz).date;
    if (!kind || kind === 'habit') {
      out.habits = state.habits.filter(h => hit(h.name, h.cue, h.behavior)).map(h => ({ id: h.id, name: h.name, cue: h.cue, behavior: h.behavior, days: h.days, time: h.time, notes: h.notes, archived: h.archived, ...habitStatus(h, today) }));
    }
    if (!kind || kind === 'routine') {
      out.routines = state.routines.filter(r => hit(r.name, ...r.steps.map(s => s.title))).map(r => ({ id: r.id, name: r.name, cue: r.cue, days: r.days, time: r.time, notes: r.notes, archived: r.archived, steps: r.steps.map((s, i) => ({ index: i, ...s })) }));
    }
    return out;
  },

  async save_habit(input) {
    return mutate(state => {
      const fields = pick(input, ['name', 'cue', 'behavior', 'days', 'time', 'notes', 'archived']);
      if (input.id) {
        const h = mustFind(state.habits, input.id, 'habit');
        Object.assign(h, fields);
        return { updated: h.id, name: h.name };
      }
      if (!fields.name) throw new Error('name is required for a new habit');
      const h = { id: id('h'), start_date: localParts(Date.now(), state.settings.tz).date, log: {}, srbai: [], ...fields };
      state.habits.push(h);
      return { created: h.id, name: h.name };
    });
  },

  async save_routine(input) {
    return mutate(state => {
      const fields = pick(input, ['name', 'cue', 'days', 'time', 'steps', 'notes', 'archived']);
      if (input.id) {
        const r = mustFind(state.routines, input.id, 'routine');
        Object.assign(r, fields);
        return { updated: r.id, name: r.name };
      }
      if (!fields.name) throw new Error('name is required for a new routine');
      const r = { id: id('r'), start_date: localParts(Date.now(), state.settings.tz).date, steps: [], log: {}, ...fields };
      state.routines.push(r);
      return { created: r.id, name: r.name };
    });
  },

  async reorder({ id: taskId, direction, above, below, clear, via }) {
    return mutate(state => {
      const t = mustFind(state.tasks, taskId, 'task');
      const today = localParts(Date.now(), state.settings.tz).date;
      if (clear) { delete t.nudge; delete t.pin; return { task: t.title, cleared: true }; }
      const ranked = rankTasks(state).scored;
      const pos = ranked.findIndex(x => x.t.id === taskId);
      if (pos < 0) throw new Error('That task is not in the current queue (snoozed, blocked, done or Claude\'s)');
      let target, side;
      if (direction === 'top') {
        t.pin = today;
        target = ranked.find(x => !x.pinned && x.t.id !== taskId); side = 'above';
      } else if (direction === 'up') { if (pos === 0) return { task: t.title, rank: 1 }; target = ranked[pos - 1]; side = 'above'; }
      else if (direction === 'down') { if (pos === ranked.length - 1) return { task: t.title, rank: pos + 1 }; target = ranked[pos + 1]; side = 'below'; }
      else if (above || below) { target = ranked.find(x => x.t.id === (above || below)); side = above ? 'above' : 'below'; if (!target) throw new Error('Target task is not in the current queue'); }
      else throw new Error('Give direction, above or below');
      if (target && direction !== 'top') {
        // Scale this task's score to land between the target and the target's other neighbour
        // (geometric midpoint), so "up one" moves exactly one place even when scores are close.
        const others = ranked.filter(x => x.t.id !== taskId);
        const ti = others.indexOf(target);
        const beyond = side === 'above' ? others[ti - 1] : others[ti + 1];
        let want = beyond && !beyond.pinned ? Math.sqrt(target.score * beyond.score) : target.score * (side === 'above' ? 1.03 : 0.97);
        // Tied scores (identical small tasks) leave no gap: always clear the target itself.
        want = side === 'above' ? Math.max(want, target.score * 1.0001) : Math.min(want, target.score * 0.9999);
        const raw = ranked[pos].score / (ranked[pos].nudge || 1);
        t.nudge = Math.min(50, Math.max(0.02, want / raw));
        if (target.pinned && side === 'above') t.pin = today;
      }
      const feat = x => ({ id: x.t.id, family: x.t.family || null, weight: +x.w.toFixed(2), score: +(x.score / (x.nudge || 1)).toFixed(3), est_min: x.t.est_min || null, slack: x.slack == null ? null : Math.round(x.slack), hard: !!x.t.hard, area: x.t.project || null, consequence: x.t.impact?.consequence || null, magnitude: x.t.impact?.magnitude || null });
      state.choices = (state.choices || []).concat({ at: nowIso(), ...choiceContext(state, via), kind: 'reorder', moved: feat(ranked[pos]), [side === 'above' ? 'over' : 'under']: target ? feat(target) : null, direction: direction || side }).slice(-2000);
      const after = rankTasks(state).scored.findIndex(x => x.t.id === taskId);
      return { task: t.title, from_rank: pos + 1, to_rank: after + 1, ...(t.pin === today ? { pinned_today: true } : {}) };
    });
  },

  async save_goal({ project, weekly_min, archived }) {
    return mutate(state => {
      state.goals ||= [];
      const g = state.goals.find(x => x.project === project);
      const remove = archived || weekly_min === 0;
      if (remove) { state.goals = state.goals.filter(x => x.project !== project); return { removed: project }; }
      if (weekly_min == null) throw new Error('weekly_min is required');
      if (g) g.weekly_min = weekly_min; else state.goals.push({ project, weekly_min });
      return { goal: project, weekly_min, projects_with_tasks: [...new Set(state.tasks.filter(t => t.status === 'open' && t.project === project).map(t => t.project))].length > 0 };
    });
  },

  async log_automaticity({ habit_id, scores }) {
    return mutate(state => {
      const h = mustFind(state.habits, habit_id, 'habit');
      const mean = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      h.srbai ||= [];
      h.srbai.push({ date: localParts(Date.now(), state.settings.tz).date, scores, mean });
      return { habit: h.name, mean, history: h.srbai.map(x => [x.date, x.mean]) };
    });
  },

  async review() {
    const state = await read();
    const today = localParts(Date.now(), state.settings.tz).date;
    const weekAgo = addDays(today, -7);
    const doneThisWeek = state.tasks.flatMap(t => (t.history || []).filter(h => localParts(Date.parse(h.done), state.settings.tz).date > weekAgo).map(h => ({ title: t.title, done: h.done.slice(0, 10), actual_min: h.actual_min })));
    const open = state.tasks.filter(t => t.status === 'open');
    return {
      today,
      habits: state.habits.filter(h => !h.archived).map(h => ({ name: h.name, ...habitStatus(h, today), automaticity_trend: (h.srbai || []).map(x => [x.date, x.mean]) })),
      routines: state.routines.filter(r => !r.archived).map(r => {
        let sched = 0, done = 0;
        for (let i = 1; i <= 28; i++) { const d = addDays(today, -i); if (scheduledOn(r, d) && d >= r.start_date && !r.log?.[d]?.skipped) { sched++; if (r.log?.[d]?.done) done++; } }
        return { name: r.name, rate_28d: sched ? +(done / sched).toFixed(2) : null };
      }),
      estimate_model: durationModel(state),
      goals: goalStatus(state),
      choices_logged: (state.choices || []).length,
      done_last_7_days: doneThisWeek,
      overdue: open.filter(t => t.due && t.due.slice(0, 10) < today).map(cleanTask),
      stale: open.filter(t => !t.due && (Date.now() - Date.parse(t.updated || t.created)) > 30 * 864e5).map(t => ({ id: t.id, title: t.title, created: t.created.slice(0, 10) })),
      waiting: state.tasks.filter(t => t.status === 'waiting').map(cleanTask),
      counts: { open: open.length, mine: open.filter(t => t.who !== 'claude').length, claude: open.filter(t => t.who === 'claude').length },
    };
  },

  async delete({ kind, id: itemId }) {
    return mutate(state => {
      const key = { task: 'tasks', habit: 'habits', routine: 'routines' }[kind];
      const before = state[key].length;
      state[key] = state[key].filter(x => x.id !== itemId);
      if (state[key].length === before) throw new Error(`No ${kind} with id ${itemId}`);
      return { deleted: itemId };
    });
  },

  async settings(input) {
    const changes = pick(input, ['capacity_min_per_day', 'capacity_weekend_min', 'areas', 'k', 'urgency_hard', 'urgency_soft', 'default_est_min', 'tz']);
    if (!Object.keys(changes).length) return (await read()).settings;
    return mutate(state => { Object.assign(state.settings, changes); return state.settings; });
  },
};

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function callTool(name, args = {}) {
  const h = handlers[name];
  if (!h) throw new Error(`Unknown tool ${name}`);
  return h(args);
}
