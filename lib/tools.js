import crypto from 'node:crypto';
import { read, mutate } from './store.js';
import { withCalendar } from './calendar.js';
import { schedulePing, dayPlan, pushReady } from './push.js';
import { buildState, rankItems, itemOut, brief, STAGES } from './build.js';
import { cookState, normalizeRecipe, recipeOut, cookOut } from './cook.js';
import { focusState, sessionOut as focusOut, workedMs, endsAt, minutesByProject, DEFAULT_BLOCKS } from './focus.js';
import { liftState, normalizeExercise, sessionView, targets, prs, weeklySets, dueProgram, weekStart, TARGET_SETS, MUSCLES } from './lift.js';
import {
  rankTasks, why, localParts, capacityOn, baseCapacity, similarity, effectiveTime, goalStatus, taskWeight, weightLevel, habitStatus, routineStatus, durationModel,
  advanceDue, scheduledOn, isAvailable, addDays, addBusinessDays, localToEpoch,
  isWish, lastTouch, STRIKES, PARK_AFTER_DAYS, routineFriction, dowOf, bedtimeStatus,
} from './logic.js';

const id = p => `${p}_${crypto.randomBytes(4).toString('hex')}`;
const nowIso = () => new Date().toISOString();

export const INSTRUCTIONS = `This is Cue, Nick's task, habit and routine app. Call it Cue. He captures everything through Claude, so treat this as the source of truth.

CAPTURE: When Nick mentions something he needs to do, add it with add_tasks. Don't ask permission for obvious captures. Write the title as a concrete next action starting with a verb ("Email Sam the Q3 loss ratios", not "Q3 stuff"). A specific next action is what stops an open loop from nagging (Masicampo & Baumeister 2011). Always set est_min (your best guess is fine), project (the area it belongs to, from settings.areas), and impact instead of a priority: consequence = what happens if it's done late or never (none, annoyance, money, health, career, legal), magnitude = how big that is (1 small, 2 medium, 3 large), reversible = false only if the damage can't be undone. Judge these from the task's meaning and his goals, and keep them factual so the same task always gets the same tags. The server turns them into the ranking weight. Set priority_override (1-4) only when Nick explicitly says how important something is. Also set family (a short canonical label shared by every version of the same kind of task); reuse labels you've seen in get_queue or find. If add_tasks reports possible_duplicates, tell him and offer to drop the new task or merge it into the existing one. Set focus (deep, normal, light) when it's clear from the task. Set due only if there is a real date. Set hard=true only for real external deadlines. Set expires when the task itself names a point after which it stops mattering (the heat comes on Monday, the link expires Oct 29): unlike due, it isn't a failure, the task just drops off as expired the next day.

TRIAGE: Before adding, ask yourself whether Claude can do the task itself (drafting, research, calculations, lookups). If Claude can do it fully right now, offer to just do it. If Claude can do the bulk but Nick has to review or send it, add it with who="claude" and offer to start. who="me" is for things only Nick can do.

WHAT NEXT: When he asks what to do or wants to see his list, call show_queue. In Claude it renders the interactive queue card, so don't repeat the list in text: add a line or two at most (anything flagged dont_miss_twice, over capacity, a hard deadline today). Where no card renders, present routines and habits that are due first, especially anything flagged dont_miss_twice, then the top tasks in the given order. Use get_queue whenever you need the queue for something else (planning the day, the review, finding ids): it returns the same data and shows nothing. Don't reorder by your own judgment. If he disagrees with the order because an input is wrong (impact, estimate, due, hard), fix the input with update_tasks and say which one. If he just wants a specific order ("do X before Y", "put this first"), use reorder: it is his call and it is logged as a preference for later calibration.

SHOPPING: Plain purchases go on per-store lists with add_to_list ("add eggs", "need omega 3s"), not add_tasks; each list ranks as one run in the queue. Set need_by when he'll run out by a date and consequence only when running out matters (contacts, medication). Purchases that need a decision first stay tasks. When he says he got things, check_off kind=list with the item_ids (or no item_ids for everything).

CHECKING OFF: When he says he did something, find the item (the ids are in get_queue, or use find) and call check_off. Ask how long it took only if the task was 30 minutes or more and he hasn't said. Actual times train the estimate correction.

WAITING: When something is waiting on someone else, set status=waiting with waiting_on. Cue sets a chase date 3 business days out (override with chase_after). When it passes, a "Follow up: ..." task appears with who=claude: draft the follow-up for him to send (never send it). When he says the reply came, set the original back to open or done, which cancels the follow-up.

BACKLOG: A task that sits in the top 10 untouched gets a strike per day. Obligations (money, legal, health, career) at 3 strikes show shrink_due: propose the smallest concrete first step ("Open the Velocity resident portal", not "Book the elevator"), and when he accepts or edits it call shrink_task; if he says no, shrink_task with decline=true. Wishes (none, annoyance) park themselves after 3 strikes or 14 days untouched, never deleted; setting status=open revives one.

ROUTINES: To change a routine, use edit_routine_steps on individual steps (step ids are in get_queue and find); use save_routine with steps only for a full rewrite. A step can wait on another with not_before (minoxidil dry time, eye drops before contacts). When check_off returns gates_opening and he's in the chat, create a calendar event at each ready_at (private, popup at start, titled with the step) so he gets pinged. To skip one step for today, check_off routine_step with skip=true: skipped steps aren't misses. Mark each routine's few essential steps core=true; on a rough day offer the short version (check_off kind=routine, short=true), which only asks for core steps, rather than skipping the whole routine. For travel or illness lasting days, use set_away. In the weekly review, a step skipped or stalled 3+ times in two weeks (friction) gets shrunk, moved, merged or dropped.

BUILDING: Things Nick is making (Cue itself, side projects) have backlogs in Build (nick-cue.vercel.app/build). When he reports a bug, friction or idea about one of them, use build_add, not add_tasks: a repeat adds a hit, and repeated friction is what earns a fix. Turn an inbox item into ready by writing concrete done_when checks. Each project's top item shows up in the queue. In a Claude Code session working on a project: build_status to pick the next item (building, then ready), build_update stage building, test against done_when, then build_update with add_commit and stage shipped.

COOKING: Cook mode (nick-cue.vercel.app/cook) walks through a recipe: scale servings, tick ingredients (missing ones go to the shopping list), big-text steps with timers that ping the phone, and a rating and note at the end. When a cook's note says what to change ("potatoes needed 5 more min"), offer to fold it into the recipe with cook_recipe. Save recipes he likes with cook_recipe (ingredients with store, steps with timer_min, protein_g per serving), and link a routine step to one with edit_routine_steps (recipe_id).

FOCUS: Cue Focus (nick-cue.vercel.app/focus) times work blocks on a task; finishing with "done" checks the task off with the real focused minutes, which train the estimate correction and count toward goal minimums. When he's about to start a deep or long task, offer a focus block (focus_start) or point him to the Focus screen.

LIFTING: Lift habits have programs in Cue Lift (nick-cue.vercel.app/lift), where he logs sets on his phone; finishing a session checks off the habit. If he reports a workout in chat, log it with lift_start, lift_log and lift_finish. For progress questions use lift_history; keep each upper-body muscle near 10 hard sets a week (lift_status shows the week). Change a program with lift_program, reusing exercise keys so history carries over.

HABITS: Define each habit as an implementation intention: cue = an existing event ("after I pour my morning coffee"), behavior = the small action. If he misses once, that's fine. Two misses in a row is the thing to prevent. When he's sick or travelling, offer to skip habits and routines for the day (check_off with skip=true): skips are excused, so they don't count as misses. When automaticity_check_due is true, ask the 4 SRBAI items (1 to 7 agreement) and save them with log_automaticity: "[Behavior] is something I do automatically", "...I do without having to consciously remember", "...I do without thinking", "...I start doing before I realize I'm doing it".

TODAY'S LOAD: get_queue returns today_load. If over_capacity is true, say so plainly and suggest which dated tasks to move (soft ones first) rather than letting the day silently overflow.

GOALS: A goal is an outcome with a horizon, tied to an area: title = the end state, concrete enough to know when it's done ("Signed offer for a Director/Sr Manager DS role", not "career growth"), by = the date, project = the area its tasks use. Keep them few (3 to 5). Optionally a weekly_min guarantees the area time each week, and its tasks get boosted while that's behind. Goals don't change ranking otherwise (area importance already does): their job is making sure something under each one is always ready to do. get_queue flags a goal with needs_next_action (no open, available task in its area) or stalled (nothing done in its area for 7 days): propose one concrete next action, verb first and about 30 minutes or less, and add it when he agrees (who="claude" if you can do it). Only tasks with a matching project count. When a goal is reached or no longer wanted, save_goal with status achieved or dropped. When he says something matters but keeps slipping, suggest making it a goal.

PLAN MY DAY: When he asks to plan the day (or right after the morning check-in if he wants it), read today's calendar, take today_load plus the top of get_queue, and propose time blocks in real free gaps: hard deadlines first, then the ranked order, using each task's corrected estimate plus a 10 minute buffer, never more than today's capacity, and leave existing events and routine times alone. Show the plan with show_plan: pass every block in time order, his existing events and routine times as kind "event"/"routine" for context, the tasks as kind "task" with their task_ids, and anything that doesn't fit in left_out. In Claude that renders a card where he can nudge, remove and approve; don't repeat the plan in text. His approval arrives as a message starting "Plan approved", with the final times (use those, not your original ones). Where no card renders, show the plan as a short list instead. Only after he approves, create the calendar events (private, popup at start). Title each with the task(s). Make the description something he can act from without opening anything else, in HTML: per task a bold title with deadline and estimate, the concrete steps from its notes, and direct links: look up the relevant email threads in Gmail and link them, link any URL already in the notes (forms, LinkedIn threads), and link the app or site the task happens in. End with a link to https://nick-tasks.vercel.app/ to check it off. If the day doesn't fit, say what moves to tomorrow.

WEEKLY REVIEW: When he does the weekly review (the Sunday routine, or he asks), call review and go through it in this order: overdue tasks (reschedule, drop or do), stale tasks (for each: keep, drop, or defer with a start date), waiting-on items (chase or drop), then goals (each still right? progress since last week? a next action ready?), then one line on what got parked or expired this week (parked_last_7_days, expired_last_7_days: revive any he wants), then habits (low rate or flat automaticity means shrink the behavior or change the cue). Finish by re-checking priorities on the top 10 of get_queue. For the overdue and stale part, call show_review with your suggested call for every task (action plus a short reason): in Claude it renders a triage card where he taps to confirm or change and applies everything himself, then a "Triage applied" message comes back and you carry on with waiting-on items. Where no card renders, go through them in batches of about 10, propose your call so he only has to confirm, and apply his decisions with update_tasks in one batch.

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
  focus: { type: 'string', enum: ['deep', 'normal', 'light'], description: 'deep = sustained thinking for 30+ min (analysis, writing, coding, applications); light = admin, errands, quick messages, chores; normal otherwise. Deep tasks rise in peak hours, light ones outside them.' },
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
  core: { type: 'boolean', description: 'Part of the short version: on a short day only core steps are asked for' },
  recipe_id: { type: 'string', description: 'Link a Cook mode recipe: the step gets a Cook button, and finishing the cook ticks the step' },
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
    description: 'Mark things done: a task, a habit for a day, a whole routine, one routine step, or shopping list items (kind=list, id = list id; omit item_ids for the whole run; anything not found stays on the list). Set undo=true to reverse. For habits and routines, skip=true excuses today (sick, travelling) and snooze_until moves it later today.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['task', 'habit', 'routine', 'routine_step', 'list'] },
              item_ids: { type: 'array', items: { type: 'string' }, description: 'list: just these items (default: the whole list)' },
              not_bought: { type: 'boolean', description: 'list: remove the items without logging a purchase (no longer needed)' },
              id: { type: 'string' },
              step_id: { type: 'string', description: 'Step id for routine_step (preferred)' },
              step: { type: 'integer', description: 'Step index for routine_step (if no step_id)' },
              date: { type: 'string', description: 'YYYY-MM-DD, default today (for habits/routines)' },
              actual_min: { type: 'number', description: 'How long the task actually took' },
              note: { type: 'string' },
              undo: { type: 'boolean' },
              skip: { type: 'boolean', description: 'Habit/routine: skip it today as an excused day (not a miss). routine_step: skip just that step today.' },
              short: { type: 'boolean', description: 'Routine only: do the short version today (only core steps; the rest are excused). undo=true goes back to the full routine.' },
              snooze_until: { type: 'string', description: 'Habit/routine only: HH:MM later today to move it to' },
              via: { type: 'string', enum: ['chat', 'panel', 'web', 'lift', 'focus'], description: 'Where the check-off happened; omit from chat' },
            },
            required: ['kind', 'id'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'add_to_list',
    description: 'Add things to buy to a store\'s shopping list (created if new). Each list shows in the queue as one run. Use for plain purchases; anything that needs a decision first (which TV mount, spending a gift card) stays a task.',
    inputSchema: {
      type: 'object',
      properties: {
        list: { type: 'string', description: 'Store or channel: "No Frills", "Shoppers", "Online", "Costco"' },
        context: { type: 'string', enum: ['errands', 'computer'], description: 'errands = go there; computer = order online. Default: computer for Online/Amazon, else errands' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'The thing, short: "Eggs", "Omega 3s"' },
              note: { type: 'string', description: 'Brand, size, quantity' },
              need_by: { type: 'string', description: 'YYYY-MM-DD when it runs out or is needed' },
              consequence: { type: 'string', enum: ['none', 'annoyance', 'money', 'health', 'career', 'legal'], description: 'Only if running out matters more than annoyance (contacts, medication: health)' },
            },
            required: ['title'],
          },
        },
      },
      required: ['list', 'items'],
    },
  },
  {
    name: 'build_status',
    description: 'Project backlogs: projects, and each project\'s items by stage (building, ready, inbox, recently shipped), ranked by how often the friction was hit, then size.',
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'Project id or name; omit for all' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'build_project',
    description: 'Create or update a project (something Nick is building). area = the Cue area its work counts toward; repo = owner/name on GitHub for commit links.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, area: { type: 'string' }, repo: { type: 'string' }, notes: { type: 'string' }, archived: { type: 'boolean' } } },
  },
  {
    name: 'build_add',
    description: 'Capture an idea, bug or friction for a project. If an open item already describes it, that item gets another hit instead of a duplicate. Lands in the inbox unless it already has done_when checks (then ready).',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project id or name' }, title: { type: 'string', description: 'Short, concrete: what is wrong or what to build' },
        problem: { type: 'string', description: 'What happened / what hurts' }, why: { type: 'string' },
        done_when: { type: 'array', items: { type: 'string' }, description: 'Checks that prove it is done' },
        size: { type: 'string', enum: ['S', 'M', 'L'] }, not_before: { type: 'string', description: 'YYYY-MM-DD: keep it out of the queue until then' },
      },
      required: ['project', 'title'],
    },
  },
  {
    name: 'build_update',
    description: 'Edit a build item: fields, stage (inbox, ready, building, shipped, dropped), hit=true when the friction happened again, add_commit to link a commit (set stage shipped when it is done).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, title: { type: 'string' }, problem: { type: 'string' }, why: { type: 'string' }, notes: { type: 'string' },
        done_when: { type: 'array', items: { type: 'string' } }, size: { type: 'string', enum: ['S', 'M', 'L'] }, not_before: { type: 'string' },
        stage: { type: 'string', enum: STAGES }, hit: { type: 'boolean' },
        add_commit: { type: 'object', properties: { sha: { type: 'string' }, msg: { type: 'string' }, url: { type: 'string' } }, required: ['sha'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'build_brief',
    description: 'A paste-ready brief for a Claude Code session: problem, why, done-when checks, and how to report back.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'cook_status',
    description: 'Cook mode overview: recipes (with last rating and note), the cook in progress, and recent cooks.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'cook_recipe',
    description: 'Create or update a Cook mode recipe (pass id to update; archived=true hides it). Ingredients carry quantities for serves people and the store they come from (for adding missing ones to shopping lists). Steps are short imperative lines; timer_min makes a step offer a timer. Put protein_g per serving when known.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, name: { type: 'string' }, serves: { type: 'integer' }, minutes: { type: 'integer', description: 'Total time' },
        protein_g: { type: 'number', description: 'Per serving' }, notes: { type: 'string' }, archived: { type: 'boolean' },
        ingredients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, note: { type: 'string' }, store: { type: 'string', description: 'Shopping list it goes on, e.g. No Frills' } }, required: ['name'] } },
        steps: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, timer_min: { type: 'number' } }, required: ['text'] } },
      },
    },
  },
  {
    name: 'cook_start',
    description: 'Start (or resume) cooking a recipe. routine_id + step_id tie it to a routine step that gets ticked when the cook finishes.',
    inputSchema: { type: 'object', properties: { recipe_id: { type: 'string' }, servings: { type: 'integer' }, routine_id: { type: 'string' }, step_id: { type: 'string' } }, required: ['recipe_id'] },
  },
  {
    name: 'cook_timer',
    description: 'Start a timer in a cook (pings the phone when it ends), or cancel one with cancel=true and its ends value.',
    inputSchema: { type: 'object', properties: { cook_id: { type: 'string' }, step: { type: 'integer' }, label: { type: 'string' }, minutes: { type: 'number' }, cancel: { type: 'boolean' }, ends: { type: 'string' } }, required: ['cook_id'] },
  },
  {
    name: 'cook_finish',
    description: 'Finish a cook with an optional 1-5 rating and a note on what to change next time (shown the next time it is cooked). Ticks the linked routine step. discard=true deletes it instead.',
    inputSchema: { type: 'object', properties: { cook_id: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, note: { type: 'string' }, discard: { type: 'boolean' } }, required: ['cook_id'] },
  },
  {
    name: 'focus_status',
    description: 'Cue Focus overview: the running work block (if any), focused minutes today and per project this week, and the top tasks to pick from.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'focus_start',
    description: 'Start a timed focus block on a task (task_id) or on something without a task (title). Returns the running block; Nick gets a push when it ends.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, title: { type: 'string' }, minutes: { type: 'integer', description: 'Default 25' } } },
  },
  {
    name: 'focus_pause',
    description: 'Pause the running focus block, resume it (resume=true), or add time to it (extend_min).',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, resume: { type: 'boolean' }, extend_min: { type: 'integer' } }, required: ['session_id'] },
  },
  {
    name: 'focus_stop',
    description: 'End a focus block. outcome: done (the task is finished: checks it off with the total focused minutes as its actual time), progress (worked on it, still open), stopped (abandoned). minutes overrides the timed minutes. break_min starts a break with a ping when it ends.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, outcome: { type: 'string', enum: ['done', 'progress', 'stopped'] }, minutes: { type: 'number' }, break_min: { type: 'integer' } }, required: ['session_id', 'outcome'] },
  },
  {
    name: 'lift_status',
    description: 'Cue Lift overview: which workout is due today, any session in progress, programs, this week\'s hard sets per muscle against the 10-set target, and recent sessions.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'lift_start',
    description: 'Start (or resume) a workout session for a lift habit. Returns every exercise with last time\'s sets and today\'s targets (double progression).',
    inputSchema: { type: 'object', properties: { habit_id: { type: 'string' } }, required: ['habit_id'] },
  },
  {
    name: 'lift_log',
    description: 'Log one set in a session (key = exercise key, i = set number from 0). Logging the same key and i again replaces it; undo=true removes it. Use this when Nick reports sets in chat.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, key: { type: 'string' }, i: { type: 'integer' }, weight: { type: 'number' }, reps: { type: 'integer' }, undo: { type: 'boolean' } }, required: ['session_id', 'key', 'i'] },
  },
  {
    name: 'lift_finish',
    description: 'Finish a session: records it, reports personal records, and checks off the lift habit for the day. discard=true deletes an empty or mistaken session instead.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, discard: { type: 'boolean' } }, required: ['session_id'] },
  },
  {
    name: 'lift_program',
    description: 'Set the workout program attached to a lift habit (replaces its exercise list), and/or the weight unit. Exercise kind: weight (load x reps), bodyweight (added load x reps, 0 = none), check (just tick sets, e.g. stretches, planks). muscles drive the weekly volume count. Reuse the same key for the same exercise across programs so history carries over.',
    inputSchema: {
      type: 'object',
      properties: {
        habit_id: { type: 'string' },
        name: { type: 'string' },
        unit: { type: 'string', enum: ['lb', 'kg'] },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' }, name: { type: 'string' }, sets: { type: 'integer' }, min: { type: 'integer' }, max: { type: 'integer' },
              kind: { type: 'string', enum: ['weight', 'bodyweight', 'check'] },
              muscles: { type: 'array', items: { type: 'string', enum: MUSCLES } },
              rest: { type: 'integer', description: 'Rest seconds after a set' },
              note: { type: 'string', description: 'Short cue shown on the card, e.g. "or cable" or "20-30 s"' },
            },
            required: ['name'],
          },
        },
      },
    },
  },
  {
    name: 'lift_history',
    description: 'Training history for analysis: per exercise, the best set of each session with estimated 1RM; weekly hard sets per muscle for recent weeks. Use for progress check-ins and the Physique goal.',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: 'One exercise; omit for all' }, weeks: { type: 'integer', description: 'Default 8' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'set_away',
    description: 'Travel, illness or any stretch of days off: excuse every habit and routine from today (or from) through until, so nothing counts as missed. cancel=true removes the away days still ahead.',
    inputSchema: { type: 'object', properties: { until: { type: 'string', description: 'YYYY-MM-DD, last day away' }, from: { type: 'string', description: 'YYYY-MM-DD, default today' }, cancel: { type: 'boolean' } } },
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
    description: 'Create or change the goal for an area (one per project): an outcome with a horizon, plus an optional weekly time minimum. Tasks in that project count toward it. status achieved or dropped closes it.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'The area this goal belongs to, as used in task project fields' },
        title: { type: 'string', description: 'The outcome, concrete enough to know when it is done' },
        by: { type: 'string', description: 'YYYY-MM-DD horizon' },
        weekly_min: { type: 'number', description: 'Optional weekly time minimum; 0 clears it' },
        notes: { type: 'string', description: 'Why it matters, or what done looks like' },
        status: { type: 'string', enum: ['active', 'achieved', 'dropped'] },
        archived: { type: 'boolean', description: 'Legacy: same as status dropped' },
      },
      required: ['project'],
    },
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
    description: 'Read or change ranking settings: capacity_min_per_day (focused task minutes on a weekday), capacity_weekend_min (same for Sat/Sun), areas (importance 1-5 per project/area; pass the full map), urgency_hard and urgency_soft (how many times worse missing that kind of deadline is than the task value), default_est_min, tz, peak_hours (when deep work goes best), personal_hours (weekday/weekend windows where calendar events reduce task capacity), bedtime, push. Reading also reports push_status: subscribed devices and recently sent pings, for checking why a notification did not arrive.',
    inputSchema: { type: 'object', properties: {
      peak_hours: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } }, required: ['start', 'end'], description: 'HH:MM local' },
      push: { type: 'object', description: 'Phone notifications (pass the full object): gates (wait timers ending, default on), times (ping at routine and habit times, default off since calendar events already do), dont_miss_twice (evening nudge, default on), nudge_time (HH:MM, default 20:30), bedtime (wind-down and bedtime pings when settings.bedtime is set, default on). Snoozed items always ping at their new time.', properties: { gates: { type: 'boolean' }, times: { type: 'boolean' }, dont_miss_twice: { type: 'boolean' }, nudge_time: { type: 'string' }, bedtime: { type: 'boolean' } } },
      bedtime: { type: 'object', description: 'When Nick goes to bed. time HH:MM local (before noon means after midnight), wind_down_min (default 60): the night routine starts then. Drives the queue banner and the wind-down and bedtime pings. Pass {} to clear.', properties: { time: { type: 'string' }, wind_down_min: { type: 'number' } } },
      personal_hours: { type: 'object', properties: { weekday: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } }, weekend: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } } },
      capacity_min_per_day: { type: 'number' }, capacity_weekend_min: { type: 'number' }, areas: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 5 } }, urgency_hard: { type: 'number' }, urgency_soft: { type: 'number' }, default_est_min: { type: 'number' }, tz: { type: 'string' } } },
  },
];

// ---------- helpers ----------

const TASK_FIELDS = Object.keys(taskProps).concat(['status', 'waiting_on']);

function cleanTask(t) {
  const out = {};
  for (const k of ['id', 'title', 'level', 'impact', 'priority_override', 'est_min', 'due', 'hard', 'start', 'expires', 'context', 'focus', 'project', 'family', 'who', 'status', 'waiting_on', 'waiting_since', 'chase_after', 'follow_up_for', 'drop_reason', 'repeat', 'blocked_by', 'notes', 'list_id', 'items', 'build_id']) {
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

// ---------- hints ----------
// What Claude should do about flagged items, carried in the results themselves so the
// guidance arrives even when a client truncates the server instructions.
const forClaude = list => (list.length ? { for_claude: list } : {});

function queueHints({ habits, today_load, top, open, goals }) {
  const out = [];
  for (const h of habits) {
    if (h.dont_miss_twice) out.push(`"${h.name}" was missed last time: put it first and keep it small (don't miss twice).`);
    if (h.automaticity_check_due) out.push(`Weekly automaticity check due for "${h.name}": ask the 4 SRBAI items (1 to 7 agreement) and save them with log_automaticity.`);
  }
  if (today_load.over_capacity) out.push(`Today is over capacity (${today_load.due_today_min} of ${today_load.capacity_min} min due): say so plainly and suggest which dated tasks to move, soft deadlines first.`);
  for (const x of top) {
    if ((x.t.strikes || 0) >= STRIKES && !isWish(x.t)) out.push(`"${x.t.title}" has sat untouched in the top 10 for ${x.t.strikes} days: propose the smallest concrete first step and call shrink_task when he agrees (decline=true if he says no).`);
  }
  for (const t of open) if (t.follow_up_for) out.push(`"${t.title}": draft the follow-up for Nick to send himself (never send it). When the reply comes, set the waiting task back to open or done.`);
  for (const g of goals) {
    const name = g.title || g.project;
    if (g.needs_next_action) out.push(`Goal "${name}" has nothing ready to do: propose one concrete next action (verb first, about 30 min or less, project "${g.project}") and add it when he agrees.`);
    else if (g.stalled) out.push(`Goal "${name}" has had no progress for 7+ days: ask what's in the way and propose a next step.`);
  }
  return out;
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

// Reads state, running the day's sweep first if it hasn't run yet. The sweep also queues
// the day's push pings (timed items, the evening check, tomorrow's wake-up).
async function fresh() {
  const state = await read();
  const today = localParts(Date.now(), state.settings.tz).date;
  if (state.meta.last_sweep === today) return state;
  const swept = await mutate(s => { if (s.meta.last_sweep !== today) sweep(s, today); return s; });
  await queuePings(dayPlan(swept));
  return swept;
}
export const dailyRefresh = fresh;

// Push scheduling must never break a tool call.
async function queuePings(list) {
  for (const { key, at, ...data } of list || []) { try { await schedulePing(key, at, data); } catch (e) { console.error('push schedule failed', key, e.message); } }
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
    ...(s.busy?.[today] ? { calendar_busy_min: s.busy[today], base_capacity_min: baseCapacity(today, s) } : {}),
    calendar: s.calendar || 'not connected',
    over_capacity: dueMin > capacityOn(today, s),
  };
  const ranked = scored.filter(x => !context || x.t.context === context);
  const bed = bedtimeStatus(state, now);

  const routines = state.routines.filter(r => !r.archived).map(r => ({ r, st: routineStatus(r, today, now, s.tz) }))
    .filter(x => x.st.scheduled && !x.st.done && !x.st.skipped)
    // An untimed night routine starts at wind-down.
    .map(x => ({ ...x, time: effectiveTime(x.r, today) || (x.r.id === bed?.routine_id ? bed.wind_down_at : null) }))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    .map(({ r, st, time }) => ({
      id: r.id, name: r.name, time: time || 'anytime', late: !!(time && time < lp.time),
      ...(r.steps.some(x => x.core) ? { has_core: true } : {}), ...(r.log?.[today]?.short ? { short_day: true } : {}),
      ...(r.snooze?.date === today ? { snoozed_to: r.snooze.until } : {}),
      steps_done: `${st.steps.filter(x => x.done || x.skipped).length}/${st.steps.length}`,
      next_step: st.next_step ? { id: st.next_step.id, index: st.next_step.index, title: st.next_step.title, ...(st.next_step.notes ? { notes: st.next_step.notes } : {}), ...(st.next_step.wait_until ? { wait_until: st.next_step.wait_until } : {}) } : null,
      // All steps, so he can see what's coming and do or skip them out of order (check_off routine_step).
      steps: st.steps.map(x => ({
        id: x.id, index: x.index, title: x.title, done: x.done,
        ...(x.skipped ? { skipped: true } : {}), ...(x.short_skip ? { short_skip: true } : {}), ...(x.core ? { core: true } : {}), ...(x.est_min ? { est_min: x.est_min } : {}),
        ...(x.wait_until ? { wait_until: x.wait_until } : {}), ...(x.not_before ? { not_before: x.not_before } : {}),
        ...(x.recipe_id ? { recipe_id: x.recipe_id } : {}),
      })),
    }));

  const habits = state.habits.filter(h => !h.archived).map(h => ({ h, st: habitStatus(h, today) }))
    .filter(x => x.st.due_today)
    .map(x => ({ ...x, time: effectiveTime(x.h, today) }))
    .sort((a, b) => (b.st.dont_miss_twice - a.st.dont_miss_twice) || (a.time || '99').localeCompare(b.time || '99'))
    .map(({ h, st, time }) => ({
      id: h.id, name: h.name, intention: `After I ${h.cue || '...'}, I will ${h.behavior || h.name}`,
      time: time || 'anytime', dont_miss_twice: st.dont_miss_twice, rate_28d: st.rate_28d,
      ...(h.snooze?.date === today ? { snoozed_to: h.snooze.until } : {}),
      ...(state.lift?.programs?.[h.id] ? { lift: true } : {}),
      ...(st.automaticity_check_due ? { automaticity_check_due: true } : {}),
    }));

  const open = state.tasks.filter(t => t.status === 'open');
  const top = ranked.slice(0, limit);
  const goals = goalStatus(state, now);
  const hints = queueHints({ habits, today_load, top, open, goals });
  if (bed?.phase === 'wind_down' && !bed.routine_done) hints.unshift(`Wind-down time: bed at ${bed.time}, ${bed.min_left} min left. Point him at the night routine, not new tasks.`);
  if (bed?.phase === 'past') hints.unshift(`${bed.min_over} min past his ${bed.time} bedtime: tell him plainly to go to bed${bed.routine_done ? '' : ' (core night steps only)'}, and don't offer tasks.`);
  return {
    now: `${today} ${lp.time} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][lp.dow]})`,
    ...forClaude(hints),
    ...(bed ? { bedtime: { time: bed.time, wind_down_at: bed.wind_down_at, phase: bed.phase, ...(bed.min_left != null ? { min_left: bed.min_left } : {}), ...(bed.min_over != null ? { min_over: bed.min_over } : {}), ...(bed.routine_id ? { routine_done: bed.routine_done } : {}) } } : {}),
    routines,
    habits,
    tasks: top.map((x, i) => ({
      rank: i + 1, ...cleanTask(x.t), level: weightLevel(x.w), weight: +x.w.toFixed(1), score: +x.score.toFixed(2), why: why(x),
      ...(x.t.strikes ? { strikes: x.t.strikes } : {}),
      ...((x.t.strikes || 0) >= STRIKES && !isWish(x.t) ? { shrink_due: true } : {}),
    })),
    more_tasks: Math.max(0, ranked.length - limit),
    lists: (state.lists || []).filter(l => !l.archived).map(l => ({ id: l.id, name: l.name, context: l.context, items: l.items.map(it => ({ id: it.id, title: it.title, ...(it.note ? { note: it.note } : {}), ...(it.need_by ? { need_by: it.need_by } : {}) })) })),
    claude_can_do: open.filter(t => t.who === 'claude' && !(t.start && t.start.slice(0, 10) > today)).map(t => ({ id: t.id, title: t.title, due: t.due })),
    waiting: state.tasks.filter(t => t.status === 'waiting').map(t => ({ id: t.id, title: t.title, waiting_on: t.waiting_on })),
    hidden: {
      deferred: open.filter(t => t.start && t.start.slice(0, 10) > today).length,
      blocked: open.filter(t => t.who !== 'claude' && !isAvailable(t, state, today) && !(t.start && t.start.slice(0, 10) > today)).length,
    },
    today_load,
    goals,
    families: [...new Set(state.tasks.filter(t => t.status !== 'dropped').map(t => t.family).filter(Boolean))].sort(),
    estimate_multiplier: factor,
  };
}

// ---------- handlers ----------

const handlers = {
  async get_queue(args) { const st = await fresh(); await noteTop(st); return queue(await withCalendar(st), args); },
  async show_queue(args) {
    const q = await handlers.get_queue(args);
    return { ...q, for_claude: ['The card shows the queue: don\'t repeat the list in text, add a line or two at most.', ...(q.for_claude || [])] };
  },

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
      const dup = added.some(x => x.possible_duplicates);
      return { added, ...forClaude(dup ? ['Some tasks look like existing ones (possible_duplicates): tell him and offer to drop the new task or merge it into the existing one.'] : []) };
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
      const hints = [], pings = [];
      const results = items.map(it => {
        const date = it.date || today;
        if (it.kind === 'task' && String(it.id).startsWith('b_')) {
          const bi = buildState(state).items.find(x => `b_${x.id}` === it.id);
          if (!bi) throw new Error(`No build item ${it.id}`);
          bi.stage = 'shipped'; bi.shipped_at = nowIso(); bi.updated = nowIso();
          return { build: bi.title, stage: 'shipped' };
        }
        if (it.kind === 'list' || (it.kind === 'task' && String(it.id).startsWith('l_'))) {
          const l = (state.lists || []).find(x => x.id === it.id || `l_${x.id}` === it.id); // list id, or the run's id from the queue
          if (!l) throw new Error(`No list with id ${it.id}`);
          const ids = it.item_ids?.length ? new Set(it.item_ids) : new Set(l.items.map(x => x.id));
          const got = l.items.filter(x => ids.has(x.id));
          if (!got.length) throw new Error(`None of those items are on ${l.name}`);
          l.items = l.items.filter(x => !ids.has(x.id));
          if (!it.not_bought) state.purchases = (state.purchases || []).concat(got.map(x => ({ title: x.title, list: l.name, at: nowIso() }))).slice(-500);
          if (l.context) state.meta.last_context = l.context;
          return { list: l.name, [it.not_bought ? 'removed' : 'got']: got.map(x => x.title), left: l.items.map(x => x.title) };
        }
        if (it.kind === 'task') {
          const t = mustFind(state.tasks, it.id, 'task');
          if (it.undo) {
            t.status = 'open'; delete t.completed;
            return { task: t.title, status: 'reopened' };
          }
          if (it.actual_min && t.est_min) state.estimates.push({ est: t.est_min, actual: it.actual_min, at: nowIso() });
          if (!it.actual_min && (t.est_min || 0) >= 30 && (!it.via || it.via === 'chat')) hints.push(`Ask how long "${t.title}" actually took (estimate was ${t.est_min} min) and log it with check_off actual_min; it trains the estimate correction.`);
          // Snapshot the ranking at the moment of choice, for fitting a paired-comparison
          // model later: the chosen task beat everything ranked above it.
          const ranked = rankTasks(state).scored;
          const pos = ranked.findIndex(x => x.t.id === t.id);
          if (pos >= 0) {
            const feat = x => ({ focus: x.t.focus || null, fit: x.fit == null ? null : +x.fit.toFixed(2), id: x.t.id, family: x.t.family || null, weight: +x.w.toFixed(2), area: x.t.project || null, area_importance: state.settings.areas?.[x.t.project] ?? null, consequence: x.t.impact?.consequence || null, magnitude: x.t.impact?.magnitude || null, reversible: x.t.impact?.reversible ?? null, override: x.t.priority_override || null, priority: x.t.priority || 4, est_min: x.t.est_min || null, slack: x.slack == null ? null : Math.round(x.slack), p_late: x.pLate == null ? null : +x.pLate.toFixed(3), hard: !!x.t.hard, context: x.t.context || null, project: x.t.project || null, score: +x.score.toFixed(3) });
            state.choices = (state.choices || []).concat({ at: nowIso(), ...choiceContext(state, it.via), chosen: feat(ranked[pos]), rank: pos + 1, above: ranked.slice(0, Math.min(pos, 10)).map(feat) }).slice(-2000);
          }
          if (t.context) state.meta.last_context = t.context;
          touched(t);
          // A sent follow-up restarts the chase clock on the item still waiting.
          const orig = t.follow_up_for && state.tasks.find(x => x.id === t.follow_up_for && x.status === 'waiting');
          if (orig) orig.chase_after = addBusinessDays(today, 3);
          t.history = (t.history || []).concat({ done: nowIso(), ...(it.actual_min ? { actual_min: it.actual_min } : {}), ...(it.note ? { note: it.note } : {}), ...(it.via === 'focus' ? { from_focus: true } : {}) }).slice(-50);
          if (t.repeat && t.due) {
            t.due = advanceDue(t.due, t.repeat);
            while (t.due.slice(0, 10) < today) t.due = advanceDue(t.due, t.repeat);
            return { task: t.title, status: 'done, next due ' + t.due };
          }
          t.status = 'done'; t.completed = nowIso();
          return { task: t.title, status: 'done' };
        }
        if (it.kind === 'routine' && it.short) {
          const r = mustFind(state.routines, it.id, 'routine');
          if (!r.steps.some(x => x.core)) throw new Error(`${r.name} has no core steps yet: mark them with edit_routine_steps (core: true)`);
          r.log ||= {};
          const e = (r.log[date] ||= { ticks: {} });
          if (it.undo) delete e.short; else e.short = true;
          // Habits linked to steps the short version leaves out are excused too, not missed.
          for (const x of r.steps) {
            const h = !x.core && !e.ticks?.[x.id] && x.habit_id && state.habits.find(y => y.id === x.habit_id);
            if (!h) continue;
            h.log ||= {};
            if (it.undo) { if (h.log[date]?.via === r.id && h.log[date]?.skipped) delete h.log[date]; }
            else if (!h.log[date]) h.log[date] = { skipped: true, via: r.id };
          }
          delete e.done; // recompute from the ticks, not the stale flag
          const st = routineStatus(r, date, Date.now(), state.settings.tz);
          e.done = st.done;
          return { routine: r.name, date, short: !it.undo, left: st.steps.filter(x => !x.done && !x.skipped).map(x => x.title) };
        }
        if ((it.kind === 'habit' || it.kind === 'routine') && (it.skip || it.snooze_until)) {
          const x = mustFind(it.kind === 'habit' ? state.habits : state.routines, it.id, it.kind);
          if (it.snooze_until) {
            x.snooze = { date, until: it.snooze_until };
            pings.push({ key: `snooze:${x.id}:${date}:${it.snooze_until}`, at: localToEpoch(`${date}T${it.snooze_until}`, state.settings.tz) });
            return { [it.kind]: x.name, date, moved_to: it.snooze_until };
          }
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
        delete entry.done; // recompute from the ticks, not the stale flag
        const st = routineStatus(r, date, Date.now(), state.settings.tz);
        entry.done = st.done;
        // Steps whose wait just started, so Claude can set a reminder for when they're ready.
        const gates = step && !it.undo && !it.skip ? st.steps.filter(x => x.not_before?.after_step === step.id && x.wait_until).map(x => ({ step: x.title, ready_at: x.wait_until })) : [];
        for (const x of st.steps) if (step && !it.undo && !it.skip && x.not_before?.after_step === step.id && x.ready_ts) pings.push({ key: `gate:${r.id}:${date}:${x.id}`, at: x.ready_ts });
        if (gates.length) hints.push('If phone notifications are off (settings push / no device), and Nick is in the chat, create a calendar event at each gates_opening ready_at (private, popup at start, titled with the step) so he gets pinged; with notifications on, Cue pings his phone itself.');
        return {
          routine: r.name, date, done: st.done, next_step: st.next_step?.title || null,
          ...(st.next_step?.wait_until ? { next_ready_at: st.next_step.wait_until } : {}),
          ...(gates.length ? { gates_opening: gates } : {}),
        };
      });
      return { results, ...forClaude([...new Set(hints)]), _pings: pings };
    }).then(async out => {
      const { _pings, ...rest } = out;
      await queuePings(_pings);
      return rest;
    });
  },

  async build_status({ project } = {}) {
    const state = await read();
    const b = buildState(state);
    const today = localParts(Date.now(), state.settings.tz).date;
    const projs = b.projects.filter(p => !p.archived && (!project || p.id === project || p.name.toLowerCase() === String(project).toLowerCase()));
    return {
      projects: projs.map(p => {
        const its = b.items.filter(it => it.project_id === p.id);
        const by = st => rankItems(its.filter(it => it.stage === st), Date.now(), today).map(it => itemOut(it));
        return { id: p.id, name: p.name, area: p.area || null, repo: p.repo || null, building: by('building'), ready: by('ready'), inbox: by('inbox'),
          shipped: its.filter(it => it.stage === 'shipped').sort((x, y) => Date.parse(y.shipped_at || 0) - Date.parse(x.shipped_at || 0)).slice(0, 10).map(it => itemOut(it)) };
      }),
    };
  },

  async build_project(input) {
    return mutate(state => {
      const b = buildState(state);
      const fields = pick(input, ['name', 'area', 'repo', 'notes', 'archived']);
      if (input.id) { const p = mustFind(b.projects, input.id, 'project'); Object.assign(p, fields); return p; }
      if (!fields.name) throw new Error('name is required');
      const ex = b.projects.find(p => p.name.toLowerCase() === fields.name.toLowerCase());
      if (ex) { Object.assign(ex, fields); return ex; }
      const p = { id: id('p'), ...fields };
      b.projects.push(p);
      return p;
    });
  },

  async build_add({ project, title, problem, why, done_when, size, not_before }) {
    return mutate(state => {
      const b = buildState(state);
      const p = b.projects.find(x => x.id === project || x.name.toLowerCase() === String(project).toLowerCase());
      if (!p) throw new Error(`No project ${project}: create it with build_project`);
      const open = b.items.filter(it => it.project_id === p.id && ['inbox', 'ready', 'building'].includes(it.stage));
      const dup = open.map(it => ({ it, sim: similarity(it.title, title) })).sort((a, c) => c.sim - a.sim)[0];
      if (dup && dup.sim >= 0.5) {
        dup.it.hits = [...(dup.it.hits || []), nowIso()];
        dup.it.updated = nowIso();
        if (problem && !dup.it.problem) dup.it.problem = problem;
        return { merged_into: itemOut(dup.it), note: 'Already on the backlog: counted as another hit' };
      }
      const it = {
        id: id('b'), project_id: p.id, title, ...(problem ? { problem } : {}), ...(why ? { why } : {}),
        done_when: done_when || [], size: size || 'M', stage: done_when?.length ? 'ready' : 'inbox',
        hits: [nowIso()], commits: [], ...(not_before ? { not_before } : {}), created: nowIso(), updated: nowIso(),
      };
      b.items.push(it);
      return { added: itemOut(it) };
    });
  },

  async build_update(input) {
    return mutate(state => {
      const b = buildState(state);
      const it = mustFind(b.items, input.id, 'build item');
      for (const k of ['title', 'problem', 'why', 'notes', 'done_when', 'size', 'not_before']) if (k in input) { if (input[k] === null) delete it[k]; else it[k] = input[k]; }
      if (input.hit) it.hits = [...(it.hits || []), nowIso()];
      if (input.add_commit) {
        const p = b.projects.find(x => x.id === it.project_id);
        const c = input.add_commit;
        it.commits = [...(it.commits || []).filter(x => x.sha !== c.sha), { sha: c.sha, ...(c.msg ? { msg: c.msg } : {}), url: c.url || (p?.repo ? `https://github.com/${p.repo}/commit/${c.sha}` : undefined) }];
      }
      if (input.stage) {
        it.stage = input.stage;
        if (input.stage === 'shipped') it.shipped_at ||= nowIso(); else delete it.shipped_at;
      } else if (it.stage === 'inbox' && it.done_when?.length) it.stage = 'ready'; // a spec makes it ready
      it.updated = nowIso();
      return itemOut(it);
    });
  },

  async build_brief({ id: itemId }) {
    const state = await read();
    const b = buildState(state);
    const it = mustFind(b.items, itemId, 'build item');
    return { brief: brief(b.projects.find(p => p.id === it.project_id) || { name: '?' }, it) };
  },

  async cook_status() {
    const state = await read();
    const ck = cookState(state);
    const active = ck.cooks.find(c => !c.finished && Date.now() - Date.parse(c.started) < 12 * 3600e3);
    return {
      recipes: ck.recipes.filter(r => !r.archived).map(r => recipeOut(ck, r)),
      active: active ? cookOut(ck, active) : null,
      recent: ck.cooks.filter(c => c.finished).slice(-8).reverse().map(c => ({ id: c.id, recipe: ck.recipes.find(r => r.id === c.recipe_id)?.name, date: c.date, rating: c.rating ?? null, note: c.note || null })),
    };
  },

  async cook_recipe(input) {
    return mutate(state => {
      const ck = cookState(state);
      const fields = pick(input, ['name', 'serves', 'minutes', 'protein_g', 'notes', 'archived', 'ingredients', 'steps']);
      if (input.id) {
        const i = ck.recipes.findIndex(r => r.id === input.id);
        if (i < 0) throw new Error(`No recipe ${input.id}`);
        ck.recipes[i] = normalizeRecipe(fields, ck.recipes[i]);
        return recipeOut(ck, ck.recipes[i]);
      }
      if (!fields.name) throw new Error('name is required for a new recipe');
      const r = normalizeRecipe({ id: id('rc'), ...fields });
      ck.recipes.push(r);
      return recipeOut(ck, r);
    });
  },

  async cook_start({ recipe_id, servings, routine_id, step_id }) {
    return mutate(state => {
      const ck = cookState(state);
      const r = mustFind(ck.recipes, recipe_id, 'recipe');
      // One cook at a time: an unfinished one for another recipe is dropped if it never got going.
      for (const c of ck.cooks.filter(c => !c.finished && c.recipe_id !== recipe_id)) c.finished = c.finished || nowIso();
      let c = ck.cooks.find(x => !x.finished && x.recipe_id === recipe_id);
      if (!c) {
        c = { id: id('ck'), recipe_id, servings: servings || r.serves, date: localParts(Date.now(), state.settings.tz).date, started: nowIso(), timers: [], ...(routine_id ? { routine_id, step_id } : {}) };
        ck.cooks.push(c);
        ck.cooks = ck.cooks.slice(-300);
      } else if (servings) c.servings = servings;
      return cookOut(ck, c);
    });
  },

  async cook_timer({ cook_id, step, label, minutes, cancel, ends }) {
    let ping = null;
    const out = await mutate(state => {
      const ck = cookState(state);
      const c = mustFind(ck.cooks, cook_id, 'cook');
      if (cancel) { c.timers = c.timers.filter(t => t.ends !== ends); return { timers: c.timers }; }
      if (!minutes) throw new Error('minutes is required');
      const r = ck.recipes.find(x => x.id === c.recipe_id);
      const t = { step: step ?? null, label: label || (r && step != null ? r.steps[step]?.text.slice(0, 60) : 'Timer'), ends: new Date(Date.now() + minutes * 60000).toISOString() };
      c.timers.push(t);
      ping = { key: `cook:${c.id}:${Date.parse(t.ends)}`, at: Date.parse(t.ends) };
      return { timer: t, timers: c.timers };
    });
    if (ping) await queuePings([ping]);
    return out;
  },

  async cook_finish({ cook_id, rating, note, discard }) {
    let tick = null;
    const out = await mutate(state => {
      const ck = cookState(state);
      const c = mustFind(ck.cooks, cook_id, 'cook');
      if (discard) { ck.cooks = ck.cooks.filter(x => x !== c); return { discarded: true }; }
      c.finished = nowIso();
      c.timers = [];
      if (rating) c.rating = rating;
      if (note) c.note = note;
      if (c.routine_id && c.step_id) tick = { kind: 'routine_step', id: c.routine_id, step_id: c.step_id, via: 'web' };
      const r = ck.recipes.find(x => x.id === c.recipe_id);
      return { recipe: r?.name, minutes: Math.round((Date.parse(c.finished) - Date.parse(c.started)) / 60000), servings: c.servings, ...(rating ? { rating } : {}), ...(note ? { note } : {}) };
    });
    if (tick) { try { out.routine_step = (await handlers.check_off({ items: [tick] })).results[0]; } catch (e) { out.routine_step_error = e.message; } }
    return out;
  },

  async focus_status() {
    const state = await read();
    const f = focusState(state);
    const now = Date.now();
    const lp = localParts(now, state.settings.tz);
    const dayStart = localToEpoch(`${lp.date}T00:00`, state.settings.tz);
    const running = f.sessions.find(x => !x.ended);
    const today = f.sessions.filter(x => (x.ended ? Date.parse(x.ended) : now) >= dayStart);
    // Worth a block: not light admin and at least ~15 minutes; fall back to anything if that's empty.
    const pool = rankTasks(state, now).scored.filter(x => !x.t.list_id);
    const worth = pool.filter(x => x.t.focus !== 'light' && x.p >= 15);
    const ranked = (worth.length ? worth : pool).slice(0, 6);
    return {
      running: running ? focusOut(running, now) : null,
      brk: f.brk && f.brk.until > now ? { until: new Date(f.brk.until).toISOString() } : null,
      blocks: DEFAULT_BLOCKS,
      today_min: Math.round(today.reduce((a, x) => a + (x.ended ? x.minutes || 0 : workedMs(x, now) / 60000), 0)),
      today_sessions: today.filter(x => x.ended).map(x => ({ title: x.title, minutes: x.minutes, outcome: x.outcome })),
      week_by_project: Object.fromEntries(Object.entries(minutesByProject(f, now - 7 * 864e5, now)).map(([k, v]) => [k, Math.round(v)])),
      suggestions: ranked.map(x => ({ id: x.t.id, title: x.t.title, project: x.t.project || null, focus: x.t.focus || null, est_min: Math.round(x.p), focused_min: Math.round(f.sessions.filter(s => s.task_id === x.t.id && s.ended).reduce((a, s) => a + (s.minutes || 0), 0)) })),
    };
  },

  async focus_start({ task_id, title, minutes = 25 }) {
    let ping = null;
    const out = await mutate(state => {
      const f = focusState(state);
      const running = f.sessions.find(x => !x.ended);
      if (running) return focusOut(running);
      const t = task_id ? mustFind(state.tasks, task_id, 'task') : null;
      if (!t && !title) throw new Error('Give a task_id or a title');
      const s = { id: id('f'), ...(t ? { task_id: t.id, project: t.project } : {}), title: t ? t.title : title, planned_min: Math.max(1, Math.min(180, Math.round(minutes))), started: nowIso(), paused_ms: 0 };
      f.sessions.push(s);
      f.sessions = f.sessions.slice(-1000);
      delete f.brk;
      if (t?.context) state.meta.last_context = t.context;
      ping = { key: `focus:${s.id}:${endsAt(s)}`, at: endsAt(s) };
      return focusOut(s);
    });
    if (ping) await queuePings([ping]);
    return out;
  },

  async focus_pause({ session_id, resume, extend_min }) {
    let ping = null;
    const out = await mutate(state => {
      const s = mustFind(focusState(state).sessions, session_id, 'focus session');
      if (s.ended) throw new Error('That block already ended');
      if (extend_min) { s.planned_min += extend_min; if (!s.paused_at) ping = { key: `focus:${s.id}:${endsAt(s)}`, at: endsAt(s) }; }
      else if (resume && s.paused_at) { s.paused_ms = (s.paused_ms || 0) + (Date.now() - Date.parse(s.paused_at)); delete s.paused_at; ping = { key: `focus:${s.id}:${endsAt(s)}`, at: endsAt(s) }; }
      else if (!resume && !s.paused_at) s.paused_at = nowIso();
      return focusOut(s);
    });
    if (ping) await queuePings([ping]);
    return out;
  },

  async focus_stop({ session_id, outcome, minutes, break_min }) {
    let ping = null, checkOff = null;
    const out = await mutate(state => {
      const f = focusState(state);
      const s = mustFind(f.sessions, session_id, 'focus session');
      if (!s.ended) {
        if (s.paused_at) { s.paused_ms = (s.paused_ms || 0) + (Date.now() - Date.parse(s.paused_at)); delete s.paused_at; }
        s.ended = nowIso();
      }
      s.minutes = Math.round(minutes ?? workedMs(s) / 60000);
      s.outcome = outcome;
      const t = s.task_id && state.tasks.find(x => x.id === s.task_id);
      const total = t ? f.sessions.filter(x => x.task_id === t.id && x.ended).reduce((a, x) => a + (x.minutes || 0), 0) : s.minutes;
      if (t && outcome === 'done' && t.status === 'open') checkOff = { id: t.id, actual_min: Math.max(1, total) };
      else if (t && outcome === 'progress') touched(t);
      if (break_min) { f.brk = { until: Date.now() + break_min * 60000, after: s.id }; ping = { key: `break:${s.id}:${f.brk.until}`, at: f.brk.until }; }
      return { session: focusOut(s), task_total_min: total, ...(t ? { task: t.title } : {}) };
    });
    if (checkOff) out.checked_off = (await handlers.check_off({ items: [{ kind: 'task', ...checkOff, via: 'focus' }] })).results[0];
    if (ping) await queuePings([ping]);
    return out;
  },

  async lift_status() {
    const state = await read();
    const lift = liftState(state);
    const day = localParts(Date.now(), state.settings.tz).date;
    const open = lift.sessions.find(x => !x.finished);
    const week = weeklySets(lift, day);
    return {
      unit: lift.unit,
      today: day,
      due: dueProgram(state, day),
      open: open ? sessionView(lift, open) : null,
      programs: Object.entries(lift.programs).map(([hid, p]) => {
        const h = state.habits.find(x => x.id === hid);
        return { habit_id: hid, name: p.name, exercises: p.exercises.length, days: h?.days || [], time: h?.time || null, done_today: !!h?.log?.[day]?.done };
      }),
      week: { from: weekStart(day), target: TARGET_SETS, sets: week },
      recent: lift.sessions.filter(x => x.finished).slice(-8).reverse().map(x => ({ id: x.id, name: x.name, date: x.date, sets: x.sets.filter(y => y.reps || y.done).length, minutes: Math.round((Date.parse(x.finished) - Date.parse(x.started)) / 60000) })),
    };
  },

  async lift_start({ habit_id }) {
    return mutate(state => {
      const lift = liftState(state);
      const p = lift.programs[habit_id];
      if (!p) throw new Error('No program for that habit yet: set one with lift_program');
      const day = localParts(Date.now(), state.settings.tz).date;
      let open = lift.sessions.find(x => !x.finished);
      if (open && open.habit_id !== habit_id) {
        // Starting something else closes the old session; an empty one is just dropped.
        if (open.sets.length) open.finished = nowIso(); else lift.sessions = lift.sessions.filter(x => x !== open);
        open = null;
      }
      if (!open) { open = { id: id('w'), habit_id, name: p.name, date: day, started: nowIso(), sets: [] }; lift.sessions.push(open); }
      lift.sessions = lift.sessions.slice(-400);
      return sessionView(lift, open);
    });
  },

  async lift_log({ session_id, key, i, weight, reps, undo }) {
    let rest = null;
    const out = await mutate(state => {
      const lift = liftState(state);
      const s = mustFind(lift.sessions, session_id, 'session');
      if (s.finished) throw new Error('That session is already finished');
      s.sets = s.sets.filter(x => !(x.key === key && x.i === i));
      if (!undo) s.sets.push({ key, i, ...(weight != null ? { weight } : {}), ...(reps != null ? { reps } : { done: true }), at: nowIso() });
      // Rest ping: when the rest after this set ends, unless another set is logged first.
      const p = lift.programs[s.habit_id];
      const ex = p?.exercises.find(e => e.key === key);
      if (!undo && ex) {
        const order = p.exercises.flatMap(e => Array.from({ length: e.sets }, (_, k) => ({ e, k })));
        const next = order.find(({ e, k }) => !s.sets.some(x => x.key === e.key && x.i === k));
        rest = { key: `rest:${s.id}:${s.sets.length}`, at: Date.now() + ex.rest * 1000, next: next ? `${next.e.name}, set ${next.k + 1}` : 'Last set done: finish the workout' };
      }
      return { ok: true, logged: s.sets.length, ...(rest ? { rest_s: ex.rest, rest_until: new Date(rest.at).toISOString() } : {}) };
    });
    if (rest) await queuePings([rest]).catch(() => {});
    return out;
  },

  async lift_finish({ session_id, discard }) {
    return mutate(state => {
      const lift = liftState(state);
      const s = mustFind(lift.sessions, session_id, 'session');
      if (discard) { lift.sessions = lift.sessions.filter(x => x !== s); return { discarded: true }; }
      if (!s.finished) s.finished = nowIso();
      const names = Object.fromEntries((lift.programs[s.habit_id]?.exercises || []).map(e => [e.key, e.name]));
      const records = prs(lift, s).map(r => ({ ...r, name: names[r.key] || r.key }));
      const h = state.habits.find(x => x.id === s.habit_id);
      if (h && s.sets.length) { h.log ||= {}; h.log[s.date] = { done: true, via: 'lift' }; }
      const work = s.sets.filter(x => x.reps);
      return {
        name: s.name, date: s.date,
        minutes: Math.round((Date.parse(s.finished) - Date.parse(s.started)) / 60000),
        sets: s.sets.length, volume: Math.round(work.reduce((a, x) => a + (x.weight || 0) * x.reps, 0)), unit: lift.unit,
        prs: records, habit_checked: !!(h && s.sets.length),
      };
    });
  },

  async lift_program({ habit_id, name, unit, exercises }) {
    return mutate(state => {
      const lift = liftState(state);
      if (unit) lift.unit = unit;
      if (!habit_id) return { unit: lift.unit };
      const h = mustFind(state.habits, habit_id, 'habit');
      const prev = lift.programs[habit_id];
      if (!exercises && !prev) throw new Error('exercises are required for a new program');
      lift.programs[habit_id] = { name: name || prev?.name || h.name, exercises: exercises ? exercises.map(normalizeExercise) : prev.exercises };
      return { habit: h.name, program: lift.programs[habit_id], unit: lift.unit };
    });
  },

  async lift_history({ key, weeks = 8 }) {
    const state = await read();
    const lift = liftState(state);
    const day = localParts(Date.now(), state.settings.tz).date;
    const since = addDays(weekStart(day), -7 * (weeks - 1));
    const done = lift.sessions.filter(x => x.finished && x.date >= since);
    const names = {};
    for (const p of Object.values(lift.programs)) for (const e of p.exercises) names[e.key] ||= e.name;
    const keys = key ? [key] : [...new Set(done.flatMap(x => x.sets.map(y => y.key)))];
    const exercises = keys.map(k => ({
      key: k, name: names[k] || k,
      sessions: done.map(x => {
        const sets = x.sets.filter(y => y.key === k && y.reps);
        if (!sets.length) return null;
        const best = sets.reduce((a, b) => ((b.weight || 0) * (1 + b.reps / 30) > (a.weight || 0) * (1 + a.reps / 30) ? b : a));
        return { date: x.date, sets: sets.length, best: { weight: best.weight, reps: best.reps }, e1rm: best.weight ? Math.round(best.weight * (1 + best.reps / 30)) : null };
      }).filter(Boolean),
    })).filter(x => x.sessions.length);
    const weekly = [];
    for (let w = 0; w < weeks; w++) {
      const start = addDays(since, 7 * w), end = addDays(start, 6);
      weekly.push({ week_of: start, sets: weeklySets({ ...lift, sessions: lift.sessions.filter(x => x.date >= start && x.date <= end) }, end) });
    }
    return { unit: lift.unit, target_sets: TARGET_SETS, exercises, weekly };
  },

  async set_away({ until, from, cancel }) {
    return mutate(state => {
      const today = localParts(Date.now(), state.settings.tz).date;
      const items = [...state.habits.filter(h => !h.archived), ...state.routines.filter(r => !r.archived)];
      if (cancel) {
        let n = 0;
        for (const x of items) for (const [d, e] of Object.entries(x.log || {})) if (d >= today && e.via === 'away' && !e.done) { delete x.log[d]; n++; }
        return { cancelled: n };
      }
      if (!until) throw new Error('until is required');
      const start = from || today;
      if (until < start) throw new Error('until is before the start');
      let days = 0;
      for (let d = start; d <= until; d = addDays(d, 1)) {
        days++;
        for (const x of items) {
          if (!scheduledOn(x, d)) continue;
          x.log ||= {};
          if (x.log[d]?.done) continue;
          x.log[d] = state.habits.includes(x) ? { skipped: true, via: 'away' } : { ...(x.log[d] || { ticks: {} }), skipped: true, via: 'away' };
        }
      }
      return { away: { from: start, until }, days, excused: items.map(x => x.name) };
    });
  },

  async add_to_list({ list, context, items }) {
    return mutate(state => {
      state.lists ||= [];
      const norm = x => String(x || '').trim().toLowerCase();
      let l = state.lists.find(x => norm(x.name) === norm(list));
      if (!l) {
        l = { id: id('l'), name: list.trim(), context: context || (/online|amazon|web/i.test(list) ? 'computer' : 'errands'), items: [] };
        state.lists.push(l);
      } else if (context) l.context = context;
      delete l.archived;
      const added = [], already = [];
      for (const it of items) {
        const dup = l.items.find(x => norm(x.title) === norm(it.title) || similarity(x.title, it.title) >= 0.8);
        if (dup) { Object.assign(dup, pick(it, ['note', 'need_by', 'consequence'])); already.push(dup.title); continue; }
        l.items.push({ id: id('i'), title: it.title.trim(), added: nowIso(), ...pick(it, ['note', 'need_by', 'consequence']) });
        added.push(it.title.trim());
      }
      return { list: { id: l.id, name: l.name, context: l.context }, added, ...(already.length ? { already_on_list: already } : {}), items: l.items.map(x => ({ id: x.id, title: x.title })) };
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
      return { created: r.id, name: r.name, steps: r.steps.map((x, i) => ({ id: x.id, index: i, title: x.title })) };
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
      if (String(taskId).startsWith('b_')) throw new Error('Build items rank by hits and size; change those in the Build screen instead');
      if (String(taskId).startsWith('l_')) throw new Error('Shopping runs can\'t be moved by hand; add need_by or consequence to an item instead');
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

  async save_goal({ project, title, by, weekly_min, notes, status, archived }) {
    return mutate(state => {
      state.goals ||= [];
      const today = localParts(Date.now(), state.settings.tz).date;
      let g = state.goals.find(x => x.project === project && !x.archived && (x.status || 'active') === 'active') || state.goals.find(x => x.project === project);
      if (!g) { g = { project, created: nowIso(), status: 'active' }; state.goals.push(g); }
      if (title !== undefined) g.title = title;
      if (by !== undefined) g.by = by;
      if (notes !== undefined) g.notes = notes;
      if (weekly_min !== undefined) { if (weekly_min) g.weekly_min = weekly_min; else delete g.weekly_min; }
      if (archived) status = 'dropped';
      if (status) { g.status = status; delete g.archived; if (status !== 'active') g.closed_at = today; else delete g.closed_at; }
      // A goal with neither an outcome nor a minimum is nothing; remove it instead of keeping an empty shell.
      if (!g.title && !g.weekly_min && g.status === 'active') { state.goals = state.goals.filter(x => x !== g); return { removed: project }; }
      const health = goalStatus(state).find(x => x.project === project);
      return {
        goal: { project: g.project, title: g.title, by: g.by, weekly_min: g.weekly_min, status: g.status },
        ...(health ? { next_actions: health.next_actions, ...(health.needs_next_action ? { needs_next_action: true } : {}) } : {}),
        ...forClaude(health?.needs_next_action ? [`Nothing in "${project}" is ready to do: propose one concrete next action for this goal and add it when he agrees.`] : []),
      };
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
        const friction = routineFriction(r, today);
        return { id: r.id, name: r.name, rate_28d: sched ? +(done / sched).toFixed(2) : null, steps: r.steps.length, core_steps: r.steps.filter(x => x.core).length, ...(friction.length ? { friction } : {}) };
      }),
      estimate_model: durationModel(state),
      goals: goalStatus(state),
      goals_closed_last_30_days: (state.goals || []).filter(g => g.closed_at && g.closed_at > addDays(today, -30)).map(g => ({ project: g.project, title: g.title, status: g.status })),
      choices_logged: (state.choices || []).length,
      done_last_7_days: doneThisWeek,
      overdue: open.filter(t => t.due && t.due.slice(0, 10) < today).map(cleanTask),
      stale: open.filter(t => !t.due && (Date.now() - Date.parse(t.updated || t.created)) > 30 * 864e5).map(t => ({ id: t.id, title: t.title, created: t.created.slice(0, 10) })),
      waiting: state.tasks.filter(t => t.status === 'waiting').map(cleanTask),
      parked_last_7_days: state.tasks.filter(t => t.status === 'parked' && t.parked_at > weekAgo).map(t => ({ id: t.id, title: t.title, reason: t.park_reason })),
      expired_last_7_days: state.tasks.filter(t => t.drop_reason === 'expired' && t.dropped_at > weekAgo).map(t => ({ id: t.id, title: t.title })),
      counts: { open: open.length, mine: open.filter(t => t.who !== 'claude').length, claude: open.filter(t => t.who === 'claude').length },
      for_claude: ['Weekly review order: overdue and stale tasks (call show_review with your suggested call and a short reason for each), waiting-on items (chase or drop), goals (still right? progress? next action ready?), one line on parked_last_7_days and expired_last_7_days, then routines (any step in friction, skipped or stalled 3+ times in two weeks: propose shrinking, moving, merging or dropping it with edit_routine_steps; a routine with no core steps: propose its short version), then habits (low rate or flat automaticity: shrink the behavior or change the cue). Finish by re-checking the top 10 of get_queue.'],
    };
  },

  async show_plan({ date, blocks = [], left_out = [], note }) {
    const state = await withCalendar(await read());
    const day = date || localParts(Date.now(), state.settings.tz).date;
    return {
      date: day,
      capacity_min: capacityOn(day, state.settings),
      blocks: [...blocks].sort((a, b) => a.start.localeCompare(b.start)),
      left_out,
      ...(note ? { note } : {}),
      for_claude: ['The card shows the plan: don\'t repeat it in text. His approval arrives as a message starting "Plan approved" with the final times; create the calendar events from those times (private, popup at start), not your original ones.'],
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
      for_claude: ['The card handles triage: wait for his "Triage applied" message, then carry on with waiting-on items, goals, parked and expired, then habits.'],
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
    const changes = pick(input, ['capacity_min_per_day', 'capacity_weekend_min', 'areas', 'urgency_hard', 'urgency_soft', 'default_est_min', 'tz', 'peak_hours', 'personal_hours', 'push', 'bedtime']);
    if (changes.bedtime && changes.bedtime.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(changes.bedtime.time)) throw new Error('bedtime.time must be HH:MM');
    if (!Object.keys(changes).length) {
      const state = await read();
      const sent = Object.entries(state.push?.sent || {}).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 15);
      return { ...state.settings, push_status: { ready: pushReady(), devices: (state.push?.subs || []).length, recent: Object.fromEntries(sent) } };
    }
    const updated = await mutate(state => {
      Object.assign(state.settings, changes);
      if (changes.bedtime && !changes.bedtime.time) delete state.settings.bedtime;
      return state;
    });
    // A new bedtime or push setting should apply tonight, not from tomorrow's sweep.
    if (changes.bedtime || changes.push) await queuePings(dayPlan(updated));
    return updated.settings;
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
