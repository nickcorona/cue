import crypto from 'node:crypto';
import { read, mutate } from './store.js';
import {
  rankTasks, why, localParts, capacityOn, similarity, effectiveTime, goalStatus, taskWeight, weightLevel, habitStatus, routineStatus, durationModel,
  advanceDue, scheduledOn, isAvailable, addDays, addBusinessDays, localToEpoch,
  isWish, lastTouch, STRIKES, PARK_AFTER_DAYS,
} from './logic.js';

const id = p => `${p}_${crypto.randomBytes(4).toString('hex')}`;
const nowIso = () => new Date().toISOString();

export const INSTRUCTIONS = `This is Cue, Nick's task, habit and routine app. Call it Cue. He captures everything through Claude, so treat this as the source of truth.

CAPTURE: When Nick mentions something he needs to do, add it with add_tasks. Don't ask permission for obvious captures. Write the title as a concrete next action starting with a verb ("Email Sam the Q3 loss ratios", not "Q3 stuff"). A specific next action is what stops an open loop from nagging (Masicampo & Baumeister 2011). Always set est_min (your best guess is fine), project (the area it belongs to, from settings.areas), and impact instead of a priority: consequence = what happens if it's done late or never (none, annoyance, money, health, career, legal), magnitude = how big that is (1 small, 2 medium, 3 large), reversible = false only if the damage can't be undone. Judge these from the task's meaning and his goals, and keep them factual so the same task always gets the same tags. The server turns them into the ranking weight. Set priority_override (1-4) only when Nick explicitly says how important something is. Also set family (a short canonical label shared by every version of the same kind of task); reuse labels you've seen in get_queue or find. If add_tasks reports possible_duplicates, tell him and offer to drop the new task or merge it into the existing one. Set due only if there is a real date. Set hard=true only for real external deadlines. Set expires when the task itself names a point after which it stops mattering (the heat comes on Monday, the link expires Oct 29): unlike due, it isn't a failure, the task just drops off as expired the next day.

TRIAGE: Before adding, ask yourself whether Claude can do the task itself (drafting, research, calculations, lookups). If Claude can do it fully right now, offer to just do it. If Claude can do the bulk but Nick has to review or send it, add it with who="claude" and offer to start. who="me" is for things only Nick can do.

WHAT NEXT: When he asks what to do or wants to see his list, call show_queue. In Claude it renders the interactive queue card, so don't repeat the list in text: add a line or two at most (anything flagged dont_miss_twice, over capacity, a hard deadline today). Where no card renders, present routines and habits that are due first, especially anything flagged dont_miss_twice, then the top tasks in the given order. Use get_queue whenever you need the queue for something else (planning the day, the review, finding ids): it returns the same data and shows nothing. Don't reorder by your own judgment. If he disagrees with the order because an input is wrong (impact, estimate, due, hard), fix the input with update_tasks and say which one. If he just wants a specific order ("do X before Y", "put this first"), use reorder: it is his call and it is logged as a preference for later calibration.

CHECKING OFF: When he says he did something, find the item (the ids are in get_queue, or use find) and call check_off. Ask how long it took only if the task was 30 minutes or more and he hasn't said. Actual times train the estimate correction.

WAITING: When something is waiting on someone else, set status=waiting with waiting_on. Cue sets a chase date 3 business days out (override with chase_after). When it passes, a "Follow up: ..." task appears with who=claude: draft the follow-up for him to send (never send it). When he says the reply came, set the original back to open or done, which cancels the follow-up.

BACKLOG: A task that sits in the top 10 untouched gets a strike per day. Obligations (money, legal, health, career) at 3 strikes show shrink_due: propose the smallest concrete first step ("Open the Velocity resident portal", not "Book the elevator"), and when he accepts or edits it call shrink_task; if he says no, shrink_task with decline=true. Wishes (none, annoyance) park themselves after 3 strikes or 14 days untouched, never deleted; setting status=open revives one.

ROUTINES: To change a routine, use edit_routine_steps on individual steps (step ids are in get_queue and find); use save_routine with steps only for a full rewrite. A step can wait on another with not_before (minoxidil dry time, eye drops before contacts). When check_off returns gates_opening and he's in the chat, create a calendar event at each ready_at (private, popup at start, titled with the step) so he gets pinged. To skip one step for today, check_off routine_step with skip=true: skipped steps aren't misses.

HABITS: Define each habit as an implementation intention: cue = an existing event ("after I pour my morning coffee"), behavior = the small action. If he misses once, that's fine. Two misses in a row is the thing to prevent. When he's sick or travelling, offer to skip habits and routines for the day (check_off with skip=true): skips are excused, so they don't count as misses. When automaticity_check_due is true, ask the 4 SRBAI items (1 to 7 agreement) and save them with log_automaticity: "[Behavior] is something I do automatically", "...I do without having to consciously remember", "...I do without thinking", "...I start doing before I realize I'm doing it".

TODAY'S LOAD: get_queue returns today_load. If over_capacity is true, say so plainly and suggest which dated tasks to move (soft ones first) rather than letting the day silently overflow.

GOALS: A goal guarantees a project a weekly minimum of time (save_goal). get_queue reports each goal's last-7-day minutes and shortfall, and tasks in a behind goal get boosted. When he says something matters but keeps slipping (job search, a side project), suggest a goal for it. Only tasks with a matching project field count.

PLAN MY DAY: When he asks to plan the day (or right after the morning check-in if he wants it), read today's calendar, take today_load plus the top of get_queue, and propose time blocks in real free gaps: hard deadlines first, then the ranked order, using each task's corrected estimate plus a 10 minute buffer, never more than today's capacity, and leave existing events and routine times alone. Show the plan with show_plan: pass every block in time order, his existing events and routine times as kind "event"/"routine" for context, the tasks as kind "task" with their task_ids, and anything that doesn't fit in left_out. In Claude that renders a card where he can nudge, remove and approve; don't repeat the plan in text. His approval arrives as a message starting "Plan approved", with the final times (use those, not your original ones). Where no card renders, show the plan as a short list instead. Only after he approves, create the calendar events (private, popup at start). Title each with the task(s). Make the description something he can act from without opening anything else, in HTML: per task a bold title with deadline and estimate, the concrete steps from its notes, and direct links: look up the relevant email threads in Gmail and link them, link any URL already in the notes (forms, LinkedIn threads), and link the app or site the task happens in. End with a link to https://nick-tasks.vercel.app/ to check it off. If the day doesn't fit, say what moves to tomorrow.

WEEKLY REVIEW: When he does the weekly review (the Sunday routine, or he asks), call review and go through it in this order: overdue tasks (reschedule, drop or do), stale tasks (for each: keep, drop, or defer with a start date), waiting-on items (chase or drop), then one line on what got parked or expired this week (parked_last_7_days, expired_last_7_days: revive any he wants), then habits (low rate or flat automaticity means shrink the behavior or change the cue). Finish by re-checking priorities on the top 10 of get_queue. For the overdue and stale part, call show_review with your suggested call for every task (action plus a short reason): in Claude it renders a triage card where he taps to confirm or change and applies everything himself, then a "Triage applied" message comes back and you carry on with waiting-on items. Where no card renders, go through them in batches of about 10, propose your call so he only has to confirm, and apply his decisions with update_tasks in one batch.

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
  expires: { type: 'string', description: 'YYYY-MM-DD after which the task stops mattering (heat comes on, link expires). Unlike due, missing it is not a failure: the next day it is dropped as expired.' },
  chase_after: { type: 'string', description: 'Waiting tasks: YYYY-MM-DD to follow up if still no reply. Default 3 business days after it went to waiting.' },
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

const stepProps = {
  id: { type: 'string', description: 'Existing step id, to keep it (and today\'s tick) when rewriting' },
  title: { type: 'string' }, est_min: { type: 'number' }, habit_id: { type: 'string' }, notes: { type: 'string' },
  not_before: {
    type: 'object', description: 'Wait gate: at least min minutes after another step is checked off (contacts 10 min after eye drops). Shows "ready at" and suggests other steps meanwhile; never blocks.',
    properties: { after_step: { type: 'string', description: 'Step id (or exact title) it waits on' }, min: { type: 'number' } }, required: ['after_step', 'min'],
  },
};
const STEP_FIELDS = Object.keys(stepProps).filter(k => k !== 'id');

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
    name: 'show_queue',
    description: 'Show Nick his queue as an interactive card (check off, snooze, reorder). Same data as get_queue. Use only when he wants to see the list; use get_queue for anything else.',
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
    description: 'Edit tasks. Pass only the fields you want to change. Set a field to null to clear it. status can be open, waiting (on someone else), done, dropped or parked (set aside, not deleted; set open to revive).',
    inputSchema: {
      type: 'object',
      properties: { updates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['open', 'waiting', 'done', 'dropped', 'parked'] }, waiting_on: { type: 'string' }, ...taskProps }, required: ['id'] } } },
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
              step_id: { type: 'string', description: 'Step id for routine_step (preferred)' },
              step: { type: 'integer', description: 'Step index for routine_step (if no step_id)' },
              date: { type: 'string', description: 'YYYY-MM-DD, default today (for habits/routines)' },
              actual_min: { type: 'number', description: 'How long the task actually took' },
              note: { type: 'string' },
              undo: { type: 'boolean' },
              skip: { type: 'boolean', description: 'Habit/routine: skip it today as an excused day (not a miss). routine_step: skip just that step today.' },
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
        status: { type: 'string', enum: ['open', 'waiting', 'done', 'dropped', 'parked', 'any'], description: 'Tasks only, default open+waiting' },
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
    description: 'Create or update a routine: an ordered list of steps done together (e.g. morning, shutdown, weekly review). A step can link to a habit with habit_id, and checking that step also logs the habit. Passing steps replaces the whole list (steps are matched to existing ones by id, then title, so today\'s ticks survive). For small changes to an existing routine use edit_routine_steps instead.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, name: { type: 'string' }, cue: { type: 'string' }, ...scheduleProps,
        steps: { type: 'array', items: { type: 'object', properties: stepProps, required: ['title'] } },
        notes: { type: 'string' }, archived: { type: 'boolean' },
      },
    },
  },
  {
    name: 'edit_routine_steps',
    description: 'Change individual steps of a routine without resending the list: insert (before/after a step, or at top/bottom), move, update, delete. Step ids come from get_queue or find. Today\'s ticks stay on their steps.',
    inputSchema: {
      type: 'object',
      properties: {
        routine_id: { type: 'string' },
        ops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['insert', 'move', 'update', 'delete'] },
              step_id: { type: 'string', description: 'Step to move, update or delete' },
              before: { type: 'string', description: 'Insert/move: put it just before this step id' },
              after: { type: 'string', description: 'Insert/move: put it just after this step id' },
              position: { type: 'string', enum: ['top', 'bottom'], description: 'Insert/move without an anchor (default bottom)' },
              step: { type: 'object', properties: stepProps, description: 'Insert: the new step. Update: fields to change (null clears).' },
            },
            required: ['op'],
          },
        },
      },
      required: ['routine_id', 'ops'],
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
    name: 'shrink_task',
    description: 'For an obligation with shrink_due (skipped in the top 10 three days running): put a tiny first step in front of it. The step becomes its own task and the original is blocked by it. decline=true just resets the strike count.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        first_step: { type: 'string', description: 'The smallest concrete first action, verb first ("Open the Velocity resident portal")' },
        est_min: { type: 'number' },
        decline: { type: 'boolean' },
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
    name: 'show_plan',
    description: 'Show a proposed day plan as an interactive card: Nick can shift blocks by 15 minutes, remove or add them back, and approve. Approval comes back as his message starting "Plan approved" with the final times. Does not create calendar events.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD, default today' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'HH:MM local' },
              end: { type: 'string', description: 'HH:MM local' },
              title: { type: 'string' },
              kind: { type: 'string', enum: ['task', 'event', 'routine', 'break'], description: 'task and break blocks are editable; event and routine are fixed context' },
              task_ids: { type: 'array', items: { type: 'string' } },
              detail: { type: 'string', description: 'One short line, e.g. "hard deadline 5pm · ~25m + buffer"' },
            },
            required: ['start', 'end', 'title', 'kind'],
          },
        },
        left_out: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, reason: { type: 'string' } }, required: ['title'] }, description: 'Tasks that do not fit today' },
        note: { type: 'string', description: 'Optional one-line note shown above the plan' },
      },
      required: ['blocks'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'show_review',
    description: 'Weekly review triage card for overdue and stale tasks, with your suggested call preselected. Nick confirms or changes each and applies them himself; a "Triage applied" message comes back.',
    inputSchema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              action: { type: 'string', enum: ['keep', 'drop', 'done', 'reschedule', 'defer'], description: 'reschedule sets a new due date (overdue tasks); defer hides until a start date (stale tasks)' },
              date: { type: 'string', description: 'YYYY-MM-DD for reschedule or defer' },
              reason: { type: 'string', description: 'A few words' },
            },
            required: ['id', 'action'],
          },
        },
      },
    },
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
    description: 'Read or change ranking settings: capacity_min_per_day (focused task minutes on a weekday), capacity_weekend_min (same for Sat/Sun), areas (importance 1-5 per project/area; pass the full map), urgency_hard and urgency_soft (how many times worse missing that kind of deadline is than the task value), default_est_min, tz.',
    inputSchema: { type: 'object', properties: { capacity_min_per_day: { type: 'number' }, capacity_weekend_min: { type: 'number' }, areas: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 5 } }, urgency_hard: { type: 'number' }, urgency_soft: { type: 'number' }, default_est_min: { type: 'number' }, tz: { type: 'string' } } },
  },
];

// ---------- helpers ----------

const TASK_FIELDS = Object.keys(taskProps).concat(['status', 'waiting_on']);

function cleanTask(t) {
  const out = {};
  for (const k of ['id', 'title', 'level', 'impact', 'priority_override', 'est_min', 'due', 'hard', 'start', 'expires', 'context', 'project', 'family', 'who', 'status', 'waiting_on', 'waiting_since', 'chase_after', 'follow_up_for', 'drop_reason', 'repeat', 'blocked_by', 'notes']) {
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

// ---------- daily sweep ----------
// Runs once per local day on the first read (the scheduled check-ins guarantee one):
// expire tasks past their end point, count strikes for tasks that sat in yesterday's top 10
// untouched, park stale wishes, and turn overdue waits into follow-ups.
function sweep(state, today) {
  const now = Date.now(), tz = state.settings.tz;
  for (const t of state.tasks) {
    if (['open', 'waiting'].includes(t.status) && t.expires && t.expires.slice(0, 10) < today) {
      t.status = 'dropped'; t.drop_reason = 'expired'; t.dropped_at = today;
    }
  }
  const seen = state.meta.seen || {};
  for (const d of Object.keys(seen)) {
    if (d >= today) continue;
    const dayStart = localToEpoch(d + 'T00:00', tz);
    for (const tid of seen[d]) {
      const t = state.tasks.find(x => x.id === tid);
      if (t && t.status === 'open' && lastTouch(t) < dayStart) t.strikes = (t.strikes || 0) + 1;
    }
    delete seen[d];
  }
  state.meta.seen = seen;
  for (const t of state.tasks) {
    if (t.status !== 'open' || t.due || !isWish(t)) continue;
    const reason = (t.strikes || 0) >= STRIKES ? 'skipped' : lastTouch(t) < now - PARK_AFTER_DAYS * 864e5 ? 'untouched' : null;
    if (reason) { t.status = 'parked'; t.park_reason = reason; t.parked_at = today; }
  }
  for (const t of state.tasks.filter(x => x.status === 'waiting')) {
    t.waiting_since ||= (t.updated || t.created || nowIso()).slice(0, 10);
    t.chase_after ||= addBusinessDays(t.waiting_since, 3);
    const open = state.tasks.some(x => x.follow_up_for === t.id && x.status === 'open');
    if (t.chase_after <= today && !open) {
      state.tasks.push({
        id: id('t'), title: `Follow up: ${t.title}`, status: 'open', who: 'claude', created: nowIso(),
        project: t.project, impact: t.impact || { consequence: 'annoyance', magnitude: 1 }, est_min: 5, family: 'follow up',
        follow_up_for: t.id, notes: `Waiting on: ${t.waiting_on || 'a reply'}. Waiting since ${t.waiting_since}. Draft the follow-up for Nick to send.`,
      });
    }
  }
  state.meta.last_sweep = today;
}

// Reads state, running the day's sweep first if it hasn't run yet.
async function fresh() {
  const state = await read();
  const today = localParts(Date.now(), state.settings.tz).date;
  if (state.meta.last_sweep === today) return state;
  return mutate(s => { if (s.meta.last_sweep !== today) sweep(s, today); return s; });
}

// Remember which tasks reached the top 10 today, for tomorrow's strike count.
async function noteTop(state) {
  const today = localParts(Date.now(), state.settings.tz).date;
  const top = rankTasks(state).scored.slice(0, 10).map(x => x.t.id);
  const have = state.meta.seen?.[today] || [];
  if (top.every(x => have.includes(x))) return;
  await mutate(s => { s.meta.seen ||= {}; s.meta.seen[today] = [...new Set([...(s.meta.seen[today] || []), ...top])]; });
}

// Any deliberate action on a task clears its strikes.
function touched(t) { t.updated = nowIso(); delete t.strikes; }

// Match rewritten steps to existing ones (id, then exact title, then close title) so ids and
// today's ticks survive a full rewrite. Gate references may use a step title instead of an id.
function matchSteps(old, incoming) {
  const pool = [...old];
  const norm = x => String(x || '').trim().toLowerCase();
  const out = incoming.map(st => {
    let m = st.id && pool.find(o => o.id === st.id);
    m ||= pool.find(o => norm(o.title) === norm(st.title));
    if (!m) {
      let best = null, sim = 0;
      for (const o of pool) { const v = similarity(o.title, st.title); if (v > sim) { best = o; sim = v; } }
      if (sim >= 0.75) m = best;
    }
    if (m) pool.splice(pool.indexOf(m), 1);
    return { id: m ? m.id : id('s'), ...pick(st, STEP_FIELDS) };
  });
  return resolveGates(out);
}

function resolveGates(steps) {
  for (const st of steps) {
    const g = st.not_before;
    if (!g) continue;
    const ref = steps.find(o => o.id === g.after_step) || steps.find(o => o.title.trim().toLowerCase() === String(g.after_step).trim().toLowerCase());
    if (!ref || ref === st) throw new Error(`Step "${st.title}" waits on unknown step ${g.after_step}`);
    st.not_before = { after_step: ref.id, min: g.min };
  }
  return steps;
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
  const routineMin = state.routines.filter(r => !r.archived).map(r => routineStatus(r, today, now, s.tz))
    .filter(st => st.scheduled && !st.done && !st.skipped)
    .reduce((a, st) => a + st.steps.filter(x => !x.done && !x.skipped).reduce((b, x) => b + (x.est_min || 0), 0), 0);
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

  const routines = state.routines.filter(r => !r.archived).map(r => ({ r, st: routineStatus(r, today, now, s.tz) }))
    .filter(x => x.st.scheduled && !x.st.done && !x.st.skipped)
    .map(x => ({ ...x, time: effectiveTime(x.r, today) }))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    .map(({ r, st, time }) => ({
      id: r.id, name: r.name, time: time || 'anytime', late: !!(time && time < lp.time),
      steps_done: `${st.steps.filter(x => x.done || x.skipped).length}/${st.steps.length}`,
      next_step: st.next_step ? { id: st.next_step.id, index: st.next_step.index, title: st.next_step.title, ...(st.next_step.notes ? { notes: st.next_step.notes } : {}), ...(st.next_step.wait_until ? { wait_until: st.next_step.wait_until } : {}) } : null,
      // All steps, so he can see what's coming and do or skip them out of order (check_off routine_step).
      steps: st.steps.map(x => ({
        id: x.id, index: x.index, title: x.title, done: x.done,
        ...(x.skipped ? { skipped: true } : {}), ...(x.est_min ? { est_min: x.est_min } : {}),
        ...(x.wait_until ? { wait_until: x.wait_until } : {}), ...(x.not_before ? { not_before: x.not_before } : {}),
      })),
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
    tasks: ranked.slice(0, limit).map((x, i) => ({
      rank: i + 1, ...cleanTask(x.t), level: weightLevel(x.w), weight: +x.w.toFixed(1), score: +x.score.toFixed(2), why: why(x),
      ...(x.t.strikes ? { strikes: x.t.strikes } : {}),
      ...((x.t.strikes || 0) >= STRIKES && !isWish(x.t) ? { shrink_due: true } : {}),
    })),
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
  async get_queue(args) { const st = await fresh(); await noteTop(st); return queue(st, args); },
  async show_queue(args) { return handlers.get_queue(args); },

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
      const today = localParts(Date.now(), state.settings.tz).date;
      const updated = updates.map(u => {
        const t = mustFind(state.tasks, u.id, 'task');
        const was = t.status;
        for (const k of TASK_FIELDS) if (k in u) { if (u[k] === null) delete t[k]; else t[k] = u[k]; }
        if (u.family) t.family = snapFamily(state, u.family);
        if (u.status === 'done' && !t.completed) t.completed = nowIso();
        if (u.status === 'open') { delete t.completed; delete t.parked_at; delete t.park_reason; delete t.drop_reason; }
        // Waiting starts a chase clock; leaving waiting (a reply came) cancels open follow-ups.
        if (t.status === 'waiting' && was !== 'waiting') {
          t.waiting_since = today;
          t.chase_after = u.chase_after || addBusinessDays(today, 3);
        }
        if (was === 'waiting' && t.status !== 'waiting') {
          delete t.waiting_since; delete t.chase_after;
          for (const f of state.tasks) if (f.follow_up_for === t.id && f.status === 'open') { f.status = 'dropped'; f.drop_reason = 'reply received'; }
        }
        touched(t);
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
            const feat = x => ({ id: x.t.id, family: x.t.family || null, weight: +x.w.toFixed(2), area: x.t.project || null, area_importance: state.settings.areas?.[x.t.project] ?? null, consequence: x.t.impact?.consequence || null, magnitude: x.t.impact?.magnitude || null, reversible: x.t.impact?.reversible ?? null, override: x.t.priority_override || null, priority: x.t.priority || 4, est_min: x.t.est_min || null, slack: x.slack == null ? null : Math.round(x.slack), p_late: x.pLate == null ? null : +x.pLate.toFixed(3), hard: !!x.t.hard, context: x.t.context || null, project: x.t.project || null, score: +x.score.toFixed(3) });
            state.choices = (state.choices || []).concat({ at: nowIso(), ...choiceContext(state, it.via), chosen: feat(ranked[pos]), rank: pos + 1, above: ranked.slice(0, Math.min(pos, 10)).map(feat) }).slice(-2000);
          }
          if (t.context) state.meta.last_context = t.context;
          touched(t);
          // A sent follow-up restarts the chase clock on the item still waiting.
          const orig = t.follow_up_for && state.tasks.find(x => x.id === t.follow_up_for && x.status === 'waiting');
          if (orig) orig.chase_after = addBusinessDays(today, 3);
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
          else { const e = (x.log[date] ||= { ticks: {} }); if (it.undo) delete e.skipped; else e.skipped = true; }
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
        const entry = (r.log[date] ||= { ticks: {} });
        entry.ticks ||= {}; entry.at ||= {};
        // A skipped step linked to a habit excuses the habit for the day, like a skipped habit.
        const touch = (st, mark) => {
          if (it.undo) { delete entry.ticks[st.id]; delete entry.at[st.id]; }
          else { entry.ticks[st.id] = mark; if (mark === 'done') entry.at[st.id] = nowIso(); }
          const h = st.habit_id && state.habits.find(x => x.id === st.habit_id);
          if (h) { h.log ||= {}; if (it.undo) delete h.log[date]; else h.log[date] = mark === 'done' ? { done: true, via: r.id } : { skipped: true, via: r.id }; }
        };
        let step = null;
        if (it.kind === 'routine_step') {
          step = it.step_id ? r.steps.find(x => x.id === it.step_id) : r.steps[it.step];
          if (!step) throw new Error(`Routine ${r.name} has no step ${it.step_id || it.step}`);
          touch(step, it.skip ? 'skip' : 'done');
        } else {
          for (const st of r.steps) if (it.undo || !entry.ticks[st.id]) touch(st, 'done');
        }
        const st = routineStatus(r, date, Date.now(), state.settings.tz);
        entry.done = st.done;
        // Steps whose wait just started, so Claude can set a reminder for when they're ready.
        const gates = step && !it.undo && !it.skip ? st.steps.filter(x => x.not_before?.after_step === step.id && x.wait_until).map(x => ({ step: x.title, ready_at: x.wait_until })) : [];
        return {
          routine: r.name, date, done: st.done, next_step: st.next_step?.title || null,
          ...(st.next_step?.wait_until ? { next_ready_at: st.next_step.wait_until } : {}),
          ...(gates.length ? { gates_opening: gates } : {}),
        };
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
    if (status === 'parked' && out.tasks) {
      out.tasks = out.tasks.map(t => { const raw = state.tasks.find(x => x.id === t.id); return { ...t, parked_at: raw.parked_at, park_reason: raw.park_reason }; });
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
        if (fields.steps) fields.steps = matchSteps(r.steps, fields.steps);
        Object.assign(r, fields);
        return { updated: r.id, name: r.name, steps: r.steps.map((x, i) => ({ id: x.id, index: i, title: x.title })) };
      }
      if (!fields.name) throw new Error('name is required for a new routine');
      if (fields.steps) fields.steps = matchSteps([], fields.steps);
      const r = { id: id('r'), start_date: localParts(Date.now(), state.settings.tz).date, steps: [], log: {}, ...fields };
      state.routines.push(r);
      return { created: r.id, name: r.name };
    });
  },

  async edit_routine_steps({ routine_id, ops }) {
    return mutate(state => {
      const r = mustFind(state.routines, routine_id, 'routine');
      const steps = r.steps;
      const at = sid => { const i = steps.findIndex(x => x.id === sid); if (i < 0) throw new Error(`No step ${sid} in ${r.name}`); return i; };
      const place = (op, st) => {
        if (op.before) steps.splice(at(op.before), 0, st);
        else if (op.after) steps.splice(at(op.after) + 1, 0, st);
        else if (op.position === 'top') steps.unshift(st);
        else steps.push(st);
      };
      for (const op of ops) {
        if (op.op === 'insert') {
          if (!op.step?.title) throw new Error('insert needs step.title');
          place(op, { id: id('s'), ...pick(op.step, STEP_FIELDS) });
        } else if (op.op === 'move') {
          const [st] = steps.splice(at(op.step_id), 1);
          place(op, st);
        } else if (op.op === 'update') {
          const st = steps[at(op.step_id)];
          for (const k of STEP_FIELDS) if (op.step && k in op.step) { if (op.step[k] === null) delete st[k]; else st[k] = op.step[k]; }
        } else if (op.op === 'delete') {
          steps.splice(at(op.step_id), 1);
          for (const o of steps) if (o.not_before?.after_step === op.step_id) delete o.not_before;
        } else throw new Error(`Unknown op ${op.op}`);
      }
      resolveGates(steps);
      return { routine: r.name, steps: steps.map((x, i) => ({ id: x.id, index: i, title: x.title, ...(x.not_before ? { not_before: x.not_before } : {}) })) };
    });
  },

  async shrink_task({ id: taskId, first_step, est_min, decline }) {
    return mutate(state => {
      const t = mustFind(state.tasks, taskId, 'task');
      if (decline) { delete t.strikes; return { task: t.title, declined: true }; }
      if (!first_step) throw new Error('first_step is required unless decline=true');
      const step = {
        id: id('t'), title: first_step, status: 'open', who: 'me', created: nowIso(), est_min: est_min || 10,
        ...pick(t, ['project', 'impact', 'family', 'context', 'due', 'hard']), notes: `First step of: ${t.title}`,
      };
      state.tasks.push(step);
      t.blocked_by = [...(t.blocked_by || []), step.id];
      touched(t);
      return { added: { id: step.id, title: step.title }, blocked: { id: t.id, title: t.title } };
    });
  },

  async reorder({ id: taskId, direction, above, below, clear, via }) {
    return mutate(state => {
      const t = mustFind(state.tasks, taskId, 'task');
      touched(t);
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
    const state = await fresh();
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
      parked_last_7_days: state.tasks.filter(t => t.status === 'parked' && t.parked_at > weekAgo).map(t => ({ id: t.id, title: t.title, reason: t.park_reason })),
      expired_last_7_days: state.tasks.filter(t => t.drop_reason === 'expired' && t.dropped_at > weekAgo).map(t => ({ id: t.id, title: t.title })),
      counts: { open: open.length, mine: open.filter(t => t.who !== 'claude').length, claude: open.filter(t => t.who === 'claude').length },
    };
  },

  async show_plan({ date, blocks = [], left_out = [], note }) {
    const state = await read();
    const day = date || localParts(Date.now(), state.settings.tz).date;
    return {
      date: day,
      capacity_min: capacityOn(day, state.settings),
      blocks: [...blocks].sort((a, b) => a.start.localeCompare(b.start)),
      left_out,
      ...(note ? { note } : {}),
    };
  },

  async show_review({ suggestions = [] }) {
    const r = await handlers.review();
    const byId = Object.fromEntries(suggestions.map(x => [x.id, { action: x.action, ...(x.date ? { date: x.date } : {}), ...(x.reason ? { reason: x.reason } : {}) }]));
    const withSuggest = t => (byId[t.id] ? { ...t, suggest: byId[t.id] } : t);
    return {
      today: r.today,
      overdue: r.overdue.map(t => withSuggest({ id: t.id, title: t.title, due: t.due, hard: t.hard, project: t.project })),
      stale: r.stale.map(withSuggest),
      waiting_count: r.waiting.length,
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
    const changes = pick(input, ['capacity_min_per_day', 'capacity_weekend_min', 'areas', 'urgency_hard', 'urgency_soft', 'default_est_min', 'tz']);
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
