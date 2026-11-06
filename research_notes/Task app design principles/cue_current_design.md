# Cue: current design inventory (codebase audit)

Scope: what Cue already implements, with file:line references into /home/user/cue (commit as of 2026-11-06). Sources below are repo paths, not URLs; "Source" links are relative to the repo root. Descriptive only, no recommendations. No secret values were read or copied.

## First screen: what the user sees on opening the queue, home widget, launcher and notifications

### Takeaway
There is no separate home page in `public/`, which holds only icons. The web home (`/`), the compact widget page (`/w`) and the in-Claude card are all one HTML/JS page in `lib/ui.js`, served by `api/web.js`. Top to bottom it shows: the quick-capture box; a header with the day, date, clock and Log mood; at most one warning line (hard deadlines due today) or a bedtime banner; a "Now" section with routines and habits due within 45 minutes; the locked "Today" list (1-5 tasks, or 1 on a low day) with an X/Y counter; then "See everything else"/"Keep going", "Later today", "Missed today", and a collapsed "Claude can do / waiting" drawer. Each task row shows a due tag (overdue in days, today, tomorrow, weekday or date, with a dot for hard deadlines), mood tag, deep tag, place, and corrected estimate. Impact, score and overdue counts are left off by design. One tap on the circle checks the item off, then an Undo row (15 min) with an optional one-tap mood question appears. The Android widget, the Cue Home launcher, the Chrome new tab and the Now notification all lead with one "Now" item plus Done / Start 25 / Not now and up to 3-5 remaining Today tasks with raw minutes.

### Cited Findings
**Web queue (`/`, `/w`, the Claude MCP card): layout order**
- `public/` holds only icons (`public/icons/*`). The page template is `PAGE` in lib/ui.js. The page starts with a hidden quick-capture form ("Add anything…"), which is shown on web only, then `#app` with skeleton placeholders, then `#moodq` — [lib/ui.js:296-297](lib/ui.js), [lib/ui.js:972](lib/ui.js)
- Task fetch limit: 12 on the full page and 5 on the widget view, with the comment "the queue commits to 3 tasks; the rest wait behind a tap". The compact embedded card slices the ranked list to 3 — [lib/ui.js:308](lib/ui.js), [lib/ui.js:708](lib/ui.js)
- Header: the brand mark, weekday and date, and the clock, plus a Log mood button and Expand/Collapse in Claude. On web it adds a nav row (Focus, Lift, Cook, Build, Mood, Shopping) and a "Turn on notifications" button if push is off — [lib/ui.js:420-437](lib/ui.js)
- Header stats show only one warning, "N hard deadline(s) today". The comment says: "Load, overdue counts, misses and goal gaps read as failure on a low day and live in the weekly review instead (today's list does the sizing)". After 17:00 a bedtime stat appears. During wind-down or after bedtime a banner appears ("Wind down… Bed at X, N min left. Start the night routine." / "Past bedtime… Go to bed.") — [lib/ui.js:421-436](lib/ui.js)
- From 20:00, or during wind-down, a "Rate today" recap card lists today's check-offs that have no mood yet as one-tap chips — [lib/ui.js:894-900](lib/ui.js)
- On Sunday and Monday morning the "Your week" card comes right after the header — [lib/ui.js:676](lib/ui.js), [lib/ui.js:608-618](lib/ui.js)
- "Now" section: routines and habits whose time is within 45 minutes (`soon`), late routines, routines already started, and untimed habits flagged dont_miss_twice. The header shows a count. Anything more than 180 minutes past its time moves to "Missed today" (unless snoozed or dont_miss_twice) — [lib/ui.js:394-404](lib/ui.js), [lib/ui.js:657-666](lib/ui.js), [lib/ui.js:677](lib/ui.js)
- Routine card: name, a time tag (or "anytime"; there is no "late" label: "still the right thing to do now"), mood tag, "d of n steps" (plus "· short version"), a progress bar, and a step block with the next step's Skip/Done, two upcoming steps, and "ready HH:MM" for gated steps — [lib/ui.js:678-691](lib/ui.js), [lib/ui.js:501-530](lib/ui.js)
- Habit card: a checkbox, the name, a "Don't miss twice" flag, the intention line "After I …, I will …", a time tag, "NN% last 28 days" (or "new"), mood tag, and "Log workout" for lift habits — [lib/ui.js:692-697](lib/ui.js)
- Undo row: "✓ <label> Undo" for the last check-off within 15 minutes. It can carry a one-tap "Your mood after?" or, for a task with predicted_mood, "Than you expected?" with Worse/Same/Better — [lib/ui.js:701-705](lib/ui.js)
- Task section heading: "Today X/Y" with a "Low day" toggle, or "Low day X/Y" with "Full list". It reads "Up next" when there is no Today plan and "Bonus" when showing all tasks. On a low day a note says "Just this one. Doing it is a full day." with the reason ("From your N mood" / "nothing done by 11:00", "tap Full list if that's wrong") — [lib/ui.js:706-713](lib/ui.js)
- Completion messages: "Today's list is done. You showed up for it." or, on a low day, "You did the one thing. That's today handled." The button under the list reads "Keep going" once Today is complete and "See everything else" before that. In the ranked view it reads "Show N more" (12 at a time) — [lib/ui.js:714-723](lib/ui.js)
- Empty state for tasks: "Nothing waiting on you right now." Shopping view: "Nothing to buy." Chrome new tab: "Nothing up / Capture something, or open the queue." Android: "Nothing up next" — [lib/ui.js:721](lib/ui.js), [lib/ui.js:674](lib/ui.js), [chrome/newtab.js:15](chrome/newtab.js), [android/app/src/main/java/com/nickcorona/cue/NowWidget.kt:64](android/app/src/main/java/com/nickcorona/cue/NowWidget.kt)
- Today's tasks are shown in live ranking order and grouped by place. The server sends today_tasks with est_corrected and `why`, but the UI row does not show `why` — [lib/today.js:110-123](lib/today.js), [lib/tools.js:1010](lib/tools.js), [lib/ui.js:716-719](lib/ui.js)
- Task row metadata: title (tap to expand notes), then dueTag, mood tag ("usually +X.X" or "builds"), a "deep" tag only when focus=deep, the context/place tag, the corrected estimate ("25m", or "1.5h" at 60 min or more), a "notes" chip, and "•••" for more options. Impact, consequence, weight, level/p1, score and strikes are not displayed — [lib/ui.js:716-719](lib/ui.js), [lib/ui.js:391](lib/ui.js), [lib/ui.js:842](lib/ui.js)
- Due tag rules: past due shows "yesterday" or "Nd overdue" (warning colour). Today shows "today [time]" (warning colour), tomorrow shows "tomorrow [time]" (amber), within a week shows the weekday (amber if 3 days or less), and anything later shows "Mon D". A hard deadline adds a dot before the label — [lib/ui.js:379-390](lib/ui.js), [lib/ui.js:143-145](lib/ui.js)
- Mood tags only mark activities that lift mood or build mastery. Drains are left off on purpose so tags don't feed avoidance — [lib/mood.js:235-238](lib/mood.js)
- Below the tasks: "Later today N", a grid of routines and habits with their times and a "Start now" button for routines. Then "Missed today N" with a Skip chip each (in compact mode a single line). Then a collapsed `<details>` drawer, "N Claude can do · N waiting", listing who=claude tasks and waiting-on items — [lib/ui.js:724-739](lib/ui.js)
- Compact Claude card: shows "Later today: N more" and a "Full queue · N more tasks" link, and hides the more/reorder controls — [lib/ui.js:726-730](lib/ui.js), [lib/ui.js:82-88](lib/ui.js)

**One-tap and per-item actions (web)**
- Tapping the circle (checkbox) on any item calls check_off at once. The card animates out, Claude gets a context update in the embedded card, and the queue reloads — [lib/ui.js:901-917](lib/ui.js), [lib/ui.js:746](lib/ui.js)
- Tapping the title toggles the notes open — [lib/ui.js:747](lib/ui.js)
- Task "•••" menu: Focus on it (opens /focus), Move to top, Up, Down, Snooze to Tomorrow / Saturday (weekdays only) / Monday / Next week / a date picker (which sets `start`; due is untouched), and Drop — [lib/ui.js:439-446](lib/ui.js), [lib/ui.js:481-500](lib/ui.js)
- Routine/habit "•••" menu: Short version or Full routine, Mark all done (routines), In 1 hour / Tonight 8pm / 9:30pm (only times later than now and later than the item's own time), and Skip today — [lib/ui.js:448-460](lib/ui.js)
- The "What's in the way?" sheet opens on the next visit after Not now on a task's notification (see the planning section) — [lib/ui.js:619-640](lib/ui.js), [lib/ui.js:983-986](lib/ui.js)

**Overdue and stale presentation**
- On the home screen an overdue task shows only its per-row "Nd overdue"/"yesterday" tag. There is no overdue count, no capacity bar and no over_capacity warning in the UI header. Those go to Claude as today_load/hints and to the weekly review — [lib/ui.js:421-426](lib/ui.js), [lib/tools.js:723](lib/tools.js)
- Stale and parked tasks are not shown on the home screen. They appear in review / show_review — [lib/tools.js:2121-2126](lib/tools.js)
- The only capacity sizing on screen is the Today list itself and its X/Y counter. Its budget is recent pace ×1.1 — [lib/today.js:35-39](lib/today.js)

**Now notification (web push / Android) content**
- Task Now card: the title, ctx (one of "Today · k/N", "Low day · just this one", "Due today" for a hard deadline due today that breaks in, "Work" during work hours, "Bonus · <area>", "Picked" / "You said now", prefixed "Out · " when away), and a body of "~N min · due MM-DD" or "overdue" plus the first line of the note. The progress ring shows Today done/total. Buttons are Done and, for tasks over 10 min, Start 25 min — [lib/push.js:47-55](lib/push.js), [lib/push.js:194-208](lib/push.js)
- Notification estimates use raw est_min (default_est_min fallback), not the corrected estimate — [lib/push.js:49](lib/push.js), [api/push.js:25-26](api/push.js)
- Habit Now card: ctx "Habit · k/N", body "After I …, I will …", and a ring of habits done today. Routine step cards show "Morning routine · 4/5" style context. When a gated step is waiting, other items are labelled "While you wait · …" — [lib/push.js:180-192](lib/push.js), [lib/push.js:163](lib/push.js), [README.md:14](README.md)
- Tapping a task notification opens `/?task=<id>`, which expands that task in place and widens to the full list if needed — [lib/push.js:50](lib/push.js), [lib/ui.js:405-417](lib/ui.js)

**Android home-screen widget (NowWidget)**
- Shows the Now item (ctx line, title, first body line), a primary button (Done, or "Start 25" when there is no check), Not now, and a "+" capture. A "Today · d/t done" header reads "Low day · just one thing" in low mode and "Today · all N done" when finished. It lists up to 5 remaining Today tasks as "○ title · Nm" (raw est_min), leaving out the task already shown as Now — [android/app/src/main/java/com/nickcorona/cue/NowWidget.kt:14-104](android/app/src/main/java/com/nickcorona/cue/NowWidget.kt), [api/push.js:22-41](api/push.js)
- Empty and error states: "Open Cue to sign in", "Cue · offline / Can't reach Cue", "Nothing up next". Tapping the widget body opens the Now item's URL. Tapping a Today row opens `/` — [android/app/src/main/java/com/nickcorona/cue/NowWidget.kt:60-100](android/app/src/main/java/com/nickcorona/cue/NowWidget.kt)
- Refreshes whenever Now changes, when the app is left, and every 30 minutes — [android/app/src/main/java/com/nickcorona/cue/NowWidget.kt:14-16](android/app/src/main/java/com/nickcorona/cue/NowWidget.kt)

**Android Cue Home launcher (dumbphone mode)**
- Layout: a big clock and date (with weather), quiet lines for the next event, rain/sunset and a body-weight line, then the Now block, then "Also today", then plain-text tools and an A-Z strip. "No icons, no badges" — [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:22-23](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt), [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:93-130](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt), [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:181-250](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt)
- Now block: the ctx label, the title at 26sp (21sp for titles over 40 characters), and buttons Done, Start 25, "Skip step" (routine steps), "Not now"/"Later", and Pick (always offered, even when nothing is up). Routines put off with Later show as "<name> paused · d/t · resume" — [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:298-356](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt)
- "Also today" lists up to 3 remaining Today tasks: a circle (one tap checks it off, shows ✓, and remembers Undo), a title (tap opens `/?task=id`), and minutes on the right — [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:358-391](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt)
- A running focus block takes over the top with a live countdown and Done, and the tools dim — [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:393-440](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt)
- Done and Not now move on at once using server-predicted `after_done`/`after_skip` — [android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt:491-525](android/app/src/main/java/com/nickcorona/cue/HomeActivity.kt), [api/push.js:36-41](api/push.js)

**Chrome new tab**
- Shows "Now" (title linked to its URL, body, Done, Not now), quick capture, and "Today · d/t done" with title and raw minutes per line, "so every tab opened starts from the next action instead of a feed" — [chrome/newtab.js:1-45](chrome/newtab.js)

### Inferences
- Every surface follows the same rule: one next action first, then a short committed Today list, with the rest behind a tap. Failure signals (overdue counts, load, misses) are kept off the home screen on purpose. Overdue shows up only as a per-row tag.
- Estimates differ between surfaces. The web queue shows the corrected estimate, while the notification, widget, launcher and Chrome tab show the raw est_min.

### Gaps
- Not checked: the CSS/visual weight of tags beyond the due colours, the Android widget XML layout, and PickActivity's contents (the "Pick" chooser).

## Data model: what fields do tasks, habits, routines, goals, moods have?

### Takeaway
A task carries factual impact tags (consequence/magnitude/reversible) instead of a priority, plus est_min, due/hard, start, expires, family, focus, context (place), who, predicted_mood, blocked_by, repeat, and status-driven fields (waiting_on, chase_after, strikes, nudge, pin, inbox). Habits are implementation intentions (cue + behavior) with day logs and SRBAI history; routines are ordered steps with core flags, gates, products, metrics/trials; goals are per-area outcomes with horizon, weekly_min and WOOP obstacle/plan; mood has entries, plans and a separate nightly day rating.

### Cited Findings
- Whole state is one JSON document in a private Vercel Blob with ETag-guarded writes and daily backups; top-level keys: settings, tasks, lists, purchases, habits, routines, estimates, goals, choices, meta — [lib/store.js:1-40](lib/store.js)
- Default settings: tz America/Toronto, capacity_min_per_day 120, capacity_weekend_min 300, urgency_hard 20, urgency_soft 5, default_est_min 30, peak_hours 09:00-12:00, work_hours 09:00-17:00 Mon-Fri, personal_hours weekday 17:00-23:00 / weekend 08:00-23:00, area importance map (Job search 5, Move 5, Health & fitness 4, Money & admin 4, Work 3, Errands & shopping 2, Home 2, Chores 2, Cue app 2, Someday 1) — [lib/store.js:15-30](lib/store.js)
- Task schema (taskProps): title ("concrete next action, verb first, about 24 characters"), notes, impact {consequence enum none/annoyance/money/health/career/legal, magnitude 1/2/3, reversible}, priority_override 1-4 ("only when Nick explicitly states"), legacy priority, est_min (raw; "server corrects for your usual overrun"), due (date or datetime), hard, start (hide until), expires, chase_after, context enum computer/phone/home/out, focus enum deep/normal/light, predicted_mood 0-10 ("his guess, not yours"), family (2-4 word canonical label, snapped server-side), project (area), who me/claude, blocked_by, repeat {every, unit day/week/month/year} — [lib/tools.js:74-110](lib/tools.js)
- Task statuses: open, waiting (with waiting_on), done, dropped, parked ("set aside, not deleted") — [lib/tools.js:156-163](lib/tools.js)
- Runtime task fields added by server: id, created, updated, history [{done, actual_min, note, from_focus, prev_due}] (last 50), strikes, nudge (reorder multiplier, clamped 0.02-50), pin (date), inbox, drop_reason 'expired', park_reason, follow_up_for, waiting_since — [lib/tools.js:1059-1063](lib/tools.js), [lib/tools.js:1169](lib/tools.js), [lib/tools.js:740-780](lib/tools.js), [lib/tools.js:1980-1990](lib/tools.js)
- Habits: name, cue ("After I ..."), behavior ("I will ..."), days/time schedule, per-date overrides (dates: "HH:MM" or false), log[date]={done|skipped, at, via}, srbai [{date, scores, mean}], snooze, start_date; queue presents them as "After I {cue}, I will {behavior}" — [lib/tools.js:458-468](lib/tools.js), [lib/tools.js:979-987](lib/tools.js), [lib/tools.js:2090-2096](lib/tools.js)
- Routine steps: id, title, est_min, habit_id (ticking also logs habit), notes, context, core (part of short version), recipe_id, product_id, from/until/until_task, temp_notes (lapse automatically), metric {name, lower_better, trial {start, block_days default 14, washout_days default 2, end}}, not_before gate {after_step, min} or {time} ("never blocks") — [lib/tools.js:112-131](lib/tools.js)
- Routine day log keys ticks by step id ('done'/'skip'), plus short flag, values for metrics — [lib/logic.js:542-598](lib/logic.js)
- Goals: one per area (project), title (end state), by (horizon), weekly_min, notes, obstacle and plan (WOOP), status active/achieved/dropped — [lib/tools.js:535-552](lib/tools.js)
- Mood entries: {id, at, mood 0-10, mastery 0-10?, activity, family, linked {kind,id,step_id}, note, plan_id, predicted {mood, mastery}, change -1/0/1, vs_predicted -1/0/1}; plans: {kind task|habit, family, activity, date, time, days, predicted} — [lib/mood.js:1-17](lib/mood.js)
- Day ratings: state.days[date] = {rating 0-10, note, tags {social, people[], exercise, outdoors, alcohol, sick, work_heavy, extra[]}, events[]} — [lib/days.js:1-12](lib/days.js)
- Shopping lists are per-store with items {title, note, need_by, consequence}; each non-empty list ranks as one errand "run" task (base 10 min errands / 5 min computer + 2 min per item, best item's impact, earliest need_by as soft due) — [lib/logic.js:311-336](lib/logic.js)
- Build backlogs: each project's single top item (building, else best ready) enters the queue as `b_<id>`, deep focus, impact annoyance with magnitude from recent hits — [lib/logic.js:338-356](lib/logic.js)
- Other stores: estimates [{est, actual, at}] for planning-fallacy correction; choices (check-off and reorder snapshots, last 2000) "for later learning of the ranking weights" — [lib/store.js:36-38](lib/store.js), [lib/tools.js:1155-1161](lib/tools.js)

### Inferences
- Priority is designed to be derived from consistent facts ("keep them factual so the same task always gets the same tags") rather than subjective p1-p4 ratings; manual priority is a narrow override path.
- The data model separates "due" (failure if missed) from "expires" (stops mattering, not a failure) and "start" (defer), a three-way date semantics.

### Gaps
- No explicit "value"/"enjoyment" or "energy cost" field beyond focus and predicted_mood; no subtasks/checklists inside tasks except via blocked_by chains.

## Ranking: how is the queue ordered?

### Takeaway
Tasks are scored by value-per-minute (Smith's rule) multiplied by an Apparent-Tardiness-Cost-style deadline term that uses the probability of missing the deadline if not done today (from a Bayesian lognormal duration model), then by goal shortfall boost, manual nudge and an energy/peak-hours fit. Sort order is pinned first, then work-hours slot, then score; then place-batching pulls up to two same-place tasks to the front for 45 minutes after a check-off. There is no age-based boost (aging) in the score.

### Cited Findings
- Weight: if priority_override, PRIORITY_WEIGHT {1:27, 2:9, 3:3, 4:1}; else area_importance (default 2) x CONSEQUENCE {none 0.5, annoyance 1, money 2, health 2.5, career 2.5, legal 3} x MAGNITUDE {1:1, 2:2, 3:4} x 1.5 if irreversible; else legacy priority weight — [lib/logic.js:5-28](lib/logic.js)
- Display level from weight: >=20 p1, >=7 p2, >=2.5 p3, else p4 — [lib/logic.js:30-33](lib/logic.js)
- Score formula documented as `score = (w / p) * (1 + U * P(late if left past today))`, U = urgency_hard or urgency_soft; "Asking 'if not today' rather than 'right now' makes a task rise the day before it's needed"; "Far-off dates add nothing, which keeps urgency from crowding out important work (mere urgency effect, Zhu, Yang & Hsee 2018)" — [lib/logic.js:358-369](lib/logic.js)
- Implementation: score = (w / p) * 60 * urgency * goalBoost * nudge * fit, where p = corrected estimate (min 5 raw minutes); overdue tasks get pLate = 1; available minutes = workMinutesBetween(now, due) minus corrected minutes of dated work due earlier (EDD order; overdue tasks excluded from "ahead"); pLate computed on (avail - todayLeft) — [lib/logic.js:378-423](lib/logic.js)
- Sort: (pinned desc) || (work slot desc: Work-area tasks first inside work hours, last outside) || (score desc) — [lib/logic.js:423](lib/logic.js), [lib/logic.js:168-176](lib/logic.js)
- Working minutes between two instants weight each local day by its capacity (weekday vs weekend) minus calendar busy minutes — [lib/logic.js:140-196](lib/logic.js)
- Planning-fallacy correction: Bayesian linear regression log(actual/est) = a + b*log(est/30) with prior a centred on log(1.3) (Buehler et al. 1994), b centred on 0, sigma 0.6; "people tend to underestimate long tasks and overestimate short ones (Halkjelsvik & Jorgensen 2012)"; uses last 300 estimate logs — [lib/logic.js:198-237](lib/logic.js)
- lateProbability = P(lognormal duration > available minutes) via normal CDF (Abramowitz & Stegun 26.2.17) — [lib/logic.js:239-252](lib/logic.js)
- Goal boost: 1 + 4 x shortfall of weekly_min (minutes from last 7 days of history and focus sessions), "counters the short-task bias of value-per-minute ranking" — [lib/logic.js:254-296](lib/logic.js), [lib/logic.js:404](lib/logic.js)
- Energy fit: deep tasks x1.5 in peak hours, x0.6 outside; light tasks x0.8 in peak, x1.2 outside ("synchrony effect, May & Hasher", no year given) — [lib/logic.js:154-166](lib/logic.js)
- Place batching: for 45 min after a check-off, up to 2 tasks in the same place scoring >=60% of the lead move to front ("attention residue, Leroy 2009") — [lib/logic.js:370-376](lib/logic.js), [lib/logic.js:425-437](lib/logic.js)
- Availability filter: open, not inbox, start <= today, no unfinished blocked_by; who=claude tasks excluded from ranking — [lib/logic.js:300-309](lib/logic.js), [lib/logic.js:384](lib/logic.js)
- Manual reorder: up/down/above/below sets a persistent multiplicative nudge at the geometric midpoint of neighbours; "top" pins for today; each move logged to choices as a preference "for later calibration" — [lib/tools.js:1957-1996](lib/tools.js), [lib/tools.js:34](lib/tools.js)
- Each check-off snapshots the ranking ("for fitting a paired-comparison model later: the chosen task beat everything ranked above it") — [lib/tools.js:1155-1161](lib/tools.js)
- Each ranked task carries a human-readable `why` (e.g. "money, medium, ~25m, due X, 40% risk if left past today, hard deadline, goal behind, deep work, peak hours, moved up by you") — [lib/logic.js:441-462](lib/logic.js)
- Claude is instructed: "Don't reorder by your own judgment"; if order is wrong because an input is wrong, fix the input — [lib/tools.js:34](lib/tools.js)

### Inferences
- Urgency is handled probabilistically and bounded (multiplicative, zero for far deadlines); importance enters through area x consequence x magnitude. The paired-comparison choice log exists but no code was found that fits weights from it yet (choices_logged count is only reported in review, [lib/tools.js:2120](lib/tools.js)).
- Aging/staleness does not raise score; it instead triggers strikes, shrink prompts or parking (see backlog section).

### Gaps
- Did not find any learned-weight model consuming `state.choices`; the comments speak of "later".

## Capture paths

### Takeaway
Capture comes from Claude chat via MCP (add_tasks/add_to_list with full tagging per server instructions), the app's quick-capture box / Android share sheet / Android notification "Add" / widget / Chrome new tab, all of which go to `/capture` where Haiku enriches one line into tool calls, falling back to an unranked inbox task.

### Cited Findings
- MCP server (Streamable HTTP, stateless JSON) at /mcp with APP_KEY path segment or bearer/OAuth token — [README.md:5-6](README.md)
- Server instructions: capture without asking for obvious items; title as concrete verb-first next action, ~24 chars, "A specific next action is what stops an open loop from nagging (Masicampo & Baumeister 2011)"; always set est_min, project, impact; family; focus; predicted_mood for Health & fitness, social, or put-off tasks; due only if real; hard only for external deadlines; expires when it names an end point — [lib/tools.js:28](lib/tools.js)
- Triage rule: if Claude can do it now, offer to; if Claude can do the bulk, who="claude"; contacting people defaults to email draft, never send without explicit "send" — [lib/tools.js:32](lib/tools.js)
- Duplicate check at capture: open/waiting tasks with title Jaccard similarity >= 0.6 (or same family and >= 0.5) returned as possible_duplicates (top 3), with a for_claude hint to offer drop/merge; family labels snapped to existing ones at similarity >= 0.6 — [lib/tools.js:1056-1077](lib/tools.js), [lib/tools.js:697-705](lib/tools.js), [lib/logic.js:123-138](lib/logic.js)
- Quick capture: Haiku (`claude-haiku-5-5`) turns one line into add_tasks / add_to_list calls with impact, est_min, area, family, context, focus; reads urgency words ("now", "asap" -> now=true, jumps to top of Now); never sets predicted_mood; without API key or on failure saves raw text as an inbox task kept out of ranking until Claude files it — [lib/capture.js:1-60](lib/capture.js), [README.md:24](README.md)
- Queue hint tells Claude to file inbox captures without asking — [lib/tools.js:992](lib/tools.js)
- Android: WebView of the web screens plus native Now notification with Add (type a capture in the shade), home-screen widget with + capture, long-press app icon Capture, share-to-Cue — [android/README.md:3-9](android/README.md)
- Chrome extension new tab: shows Now with Done/Not now, quick capture (posts to /capture) and today's list — [chrome/newtab.js:19-46](chrome/newtab.js), [README.md:33](README.md)
- Windows: only `lock-chrome.ps1`, which force-installs the Chrome extension and disables Incognito/Guest/new profiles (no capture client) — [windows/lock-chrome.ps1:1-9](windows/lock-chrome.ps1)
- Shopping: plain purchases go to per-store lists via add_to_list, not tasks — [lib/tools.js:38](lib/tools.js)
- Build backlog capture (build_add) for friction/ideas on projects; repeats add a hit — [lib/tools.js:50](lib/tools.js)

### Inferences
- All capture paths converge on the same tool schema, so ranking inputs are the same regardless of entry point (stated at [lib/capture.js:1-5](lib/capture.js)).

### Gaps
- No email-to-inbox or calendar-to-task capture path found.

## Daily planning, capacity, low days, reviews, and support mechanisms

### Takeaway
Cue locks a short "Today" list each day sized to recent pace (7-day average finished minutes x1.1, 15 min floor, capped at capacity, 1-5 tasks), shrinks it to one quickest task on low days, reports today_load vs capacity (calendar-adjusted), offers a Claude-built time-block plan card (show_plan) and a weekly review with triage card (show_review). Support mechanisms include dont_miss_twice, SRBAI automaticity checks, away mode, short routines, shrink_task / "What's in the way?" (Prep tasks, first step, 5-minute focus start), Focus timer, mood logging with predicted-vs-actual, nightly day rating with a Bayesian good_days model, and N-of-1 step trials.

### Cited Findings
- Today's list rationale: "Sizing and the low-day floor follow graded task assignment in behavioural activation: start below what feels possible and build"; budget = clamp(round(recentPace x 1.1 / 5) x 5, 15, capacity), recentPace includes zero days; MAX_ITEMS 5; locked once a day (sweep or first read); previous day's list saved to meta.days_log (60 days) — [lib/today.js:1-70](lib/today.js)
- Low day: set_day mode low, or latest mood today <= 4/10, or nothing done by 11:00 -> list becomes the single quickest task; any task done counts as the day complete; remaining ranked tasks are "bonus", "never as falling behind" — [lib/today.js:12-13](lib/today.js), [lib/today.js:79-128](lib/today.js), [lib/tools.js:34](lib/tools.js)
- Server instruction: "He has depression and many days are low; never frame a low day as failure" — [lib/tools.js:34](lib/tools.js)
- Today's list is grouped by place (computer, home, ...) in order of each place's best task — [lib/today.js:117-123](lib/today.js)
- today_load: corrected minutes of tasks due today or overdue vs capacityOn(today) (base capacity minus calendar busy minutes within personal_hours), routine minutes left reported separately, over_capacity flag; hint tells Claude to say so plainly and suggest moving soft deadlines first — [lib/tools.js:928-944](lib/tools.js), [lib/tools.js:723](lib/tools.js), [lib/tools.js:60](lib/tools.js), [lib/calendar.js](lib/calendar.js) (per [README.md:13](README.md))
- Plan my day: Claude reads calendar, proposes time blocks in real free gaps, hard deadlines first then ranked order, corrected estimate + 10 min buffer, never over capacity; show_plan card lets him shift blocks by 15 min, remove/add and approve; approved plan stays in Cue/chat, not calendar — [lib/tools.js:64](lib/tools.js), [lib/tools.js:604-631](lib/tools.js), [lib/tools.js:2133-2144](lib/tools.js)
- Weekly review order: how_cue_is_working metrics, overdue (reschedule/drop/do), stale (keep/drop/defer), waiting (chase/drop), goals, parked/expired last 7 days, habits (low rate or flat automaticity -> shrink behavior or change cue), routine friction, re-check top 10, then accountability note — [lib/tools.js:66](lib/tools.js), [lib/tools.js:2098-2130](lib/tools.js)
- show_review triage card with suggested action per task (keep, drop, done, reschedule, defer + date + reason); he applies — [lib/tools.js:633-655](lib/tools.js), [lib/tools.js:2146-2156](lib/tools.js)
- how_cue_is_working metrics: tasks finished, days with anything done, days today's list was finished, morning routine core completion, median minutes wake->first thing done, Now Done vs Not now taps — [README.md:26](README.md)
- "Your week" card (Sundays and Monday morning): done list vs his own previous four weeks' average, "never a target or a score", one suggestion aimed at the setup (rules: morning core <50% -> short version default; <=3 active days -> one small thing; Not now > Done -> use "What's in the way"; wake-to-first >120 min -> first step doable from bed); cites Harkin et al. 2016 and Kluger & DeNisi 1996 — [lib/metrics.js:73-130](lib/metrics.js)
- Accountability: Send button shares a plain progress note (done, time on goals, next-week commitments) to a named person; he sends it himself; "Harkin et al. 2016: d 0.47 to 0.55 against 0.19" — [lib/metrics.js:132-151](lib/metrics.js), [lib/tools.js:66](lib/tools.js)
- dont_miss_twice: a habit scheduled today, not done/skipped, whose previous scheduled day was missed; such habits sort first and generate a "keep it small" hint — [lib/logic.js:508-540](lib/logic.js), [lib/tools.js:978](lib/tools.js), [lib/tools.js:720](lib/tools.js)
- Habit rate_28d excludes skipped (excused) days; today isn't a miss until it ends — [lib/logic.js:519-525](lib/logic.js), [lib/logic.js:476-477](lib/logic.js)
- Automaticity: SRBAI (4 items, 1-7) due weekly once habit is 7+ days old; saved via log_automaticity; habit counts as automatic with recent SRBAI mean >= 5.5 (within 21 days) or >= 42 days at >= 90% rate, and not missed last time — [lib/logic.js:496-506](lib/logic.js), [lib/logic.js:526-538](lib/logic.js), [lib/tools.js:58](lib/tools.js), [lib/tools.js:593-596](lib/tools.js)
- Habits defined as implementation intentions (cue = existing event, behavior = small action) — [lib/tools.js:58](lib/tools.js), [lib/tools.js:458-460](lib/tools.js)
- Away mode: set_away excuses all habits and routines from..until (logged skipped via 'away'); cancel removes future away days — [lib/tools.js:439-442](lib/tools.js), [lib/tools.js:1806-1829](lib/tools.js)
- Short routine: check_off kind=routine short=true asks only core steps; non-core count as excused skips — [lib/logic.js:566-569](lib/logic.js), [lib/tools.js:44](lib/tools.js)
- Routine friction: a step skipped or stalled (first undone step on a started-but-unfinished day) >= 3 times in 14 days is flagged for review — [lib/logic.js:600-620](lib/logic.js)
- shrink_task: creates a first-step task (default 10 min, inherits project/impact/family/context/due/hard) and blocks the original on it; decline resets strikes — [lib/tools.js:521-533](lib/tools.js), [lib/tools.js:1943-1957](lib/tools.js)
- "What's in the way?" after Not now on a task's notification (within 3 h, `stuck_ask`): "Don't know how to start" -> adds who=claude "Prep: <task>" (10 min, family "task prep"); "Feels too big" -> he names a first step -> shrink_task (5 min); "Not feeling it" -> start a 5-minute focus block — [lib/ui.js:619-640](lib/ui.js), [lib/tools.js:1038-1047](lib/tools.js), [api/push.js:234-240](api/push.js)
- Claude instructed to do Prep tasks first when a chat opens and finish with shrink_task — [lib/tools.js:32](lib/tools.js)
- Focus timer: sessions with planned_min (default blocks 25/50), pauses, outcome done/progress/stopped; done checks the task off with real minutes (trains estimate model) and counts toward goal weekly minutes as they happen; Now notification holds a running block and pings wait until it ends; tasks >10 min get "Start 25 min" on Now — [lib/focus.js:1-48](lib/focus.js), [lib/tools.js:1677](lib/tools.js), [README.md:15](README.md)
- Actual-time capture: check_off asks actual minutes for tasks with est >= 30 min (chat) to train correction — [lib/tools.js:1153-1154](lib/tools.js)
- Mood (behavioral activation): entries 0-10 mood + mastery; insights per activity family vs window baseline, greyed under 3 entries, builders (mood dip, mastery gain) vs drains, mood by 2-hour block; queue tags only lifters/builders ("a tag saying a task feels bad would only feed avoidance") — [lib/mood.js:1-20](lib/mood.js), [lib/mood.js:82-123](lib/mood.js), [lib/mood.js:235-250](lib/mood.js)
- Predicted vs actual: plans and task predicted_mood compared with ratings; "Depression underpredicts how much an activity helps; a positive gap is that showing up in his own data"; after check-off of a task with predicted_mood, a one-tap "worse/better than expected" ask — [lib/mood.js:124-143](lib/mood.js), [lib/tools.js:855-866](lib/tools.js)
- Plan follow-through: planned vs done occurrences (missed counts against; skipped/upcoming don't) — [lib/mood.js:144-180](lib/mood.js)
- good_days: one nightly 0-10 day rating (+ optional note), day tags filled from calendar, check-offs and note (model tool call, word-list fallback); Bayesian linear regression with zero-centred priors per feature (social, exercise, outdoors, alcohol, sick, work_heavy, weekend, tasks_done, focus_h, screen_h, feeds_h, prev_social, prev_alcohol), 120-day lookback; no effects reported under 10 rated days; `sure` = posterior chance the sign is right; Claude told not to claim anything with sure < 0.8 and to phrase as association — [lib/days.js:1-95](lib/days.js), [lib/days.js:110-160](lib/days.js), [lib/tools.js:54](lib/tools.js)
- Social nudges: friends not seen in a while when the week is light on social days; Claude drafts a concrete plan — [lib/days.js:179-196](lib/days.js), [lib/tools.js:54](lib/tools.js)
- step_trial: alternating on/off blocks (default 14 days, 2 washout days) for a routine step with a 0-10 metric; reports n, mean, sd per arm, difference, SE; "present it as a screen, not proof" — [lib/steps.js:37-86](lib/steps.js), [lib/tools.js:587-591](lib/tools.js)
- Goals: needs_next_action (no available task in area) and stalled (7+ days no progress) flags drive hints to propose one concrete <=30 min next action; WOOP obstacle and if-then plan captured at goal setting ("g about 0.24 to 0.34") — [lib/logic.js:254-296](lib/logic.js), [lib/tools.js:62](lib/tools.js), [lib/tools.js:728-733](lib/tools.js)
- Bedtime: wind-down phase hints Claude to point at night routine, not new tasks; past bedtime, tell him to go to bed — [lib/logic.js:644-671](lib/logic.js), [lib/tools.js:996-997](lib/tools.js)
- Distraction gating: Chrome extension and Android "Cue Home" dumbphone mode gate sites/apps behind Unlock (reason of 3+ words, 20 s wait, 5 or 15 min), loosening waits 24 h; screen time and unlocks reported in the week card vs before Cue Home — [README.md:33](README.md), [android/README.md:11](android/README.md), [lib/metrics.js:60-71](lib/metrics.js)

### Inferences
- Capacity is used in two different ways: today_load/over_capacity checks dated work against capacity, while the Today list deliberately sizes to recent output rather than capacity.
- Many features are explicitly designed for a user with depression (low-day mode, non-judgmental week card, avoidance-sensitive mood tags).

### Gaps
- Did not inspect lib/views.js card UI or lib/calendar.js line-by-line; capacity reduction behaviour is taken from README.md:13 and logic.js.

## Notifications and reminders

### Takeaway
Phone pings are web push/FCM messages scheduled as delayed Vercel Queue messages and re-checked on delivery. The default is a single replaceable "Now" notification showing the one next thing (running routine's next core step, then due habits, then top task) that buzzes at wake and each routine/habit time, with Done / Not now / Start 25 min; plus an idle nudge run as a micro-randomized trial, wind-down/bedtime, nightly "How was today?", planned-activity pings, gate timers and a Sunday week card. Automatic habits are refreshed quietly instead of buzzing.

### Cited Findings
- Each ping is a Vercel Queue message delayed to its exact minute; on delivery it re-checks it still applies; no polling — [lib/push.js:1-5](lib/push.js)
- Defaults: week, now, idle (60 min), gates on; times off; dont_miss_twice on with nudge_time 20:30 (only when Now is off); bedtime, day on — [lib/push.js:23](lib/push.js)
- dayPlan schedules: Now buzz at wake (default 07:00) and each routine/habit time (automatic habits quiet), separate time pings if Now off, evening don't-miss-twice nudge if Now off, wind-down and bedtime, "How was today?" 30 min before wind-down (21:30 default), mood-plan times, first idle check an hour into personal hours, Sunday 10:00 week card, and tomorrow's 06:00 sweep ping — [lib/push.js:316-371](lib/push.js)
- Now item order: running focus block; his own Pick / "now" capture / pinned task; picked shopping list; running/due routines (core steps); habits due; top task / today's list (hard deadline due today can break in) — [lib/push.js:27-35](lib/push.js), [lib/push.js:74-130](lib/push.js), [README.md:24-25](README.md)
- Not now hides an item for 2 hours (not the day); on a routine step it skips the routine for now — [lib/push.js:58-72](lib/push.js), [api/push.js:234-250](api/push.js)
- Location-aware: when phone reports he's out (within 3 h), home tasks/routines wait; out in work hours counts as office — [lib/push.js:96-101](lib/push.js)
- Calendar-aware: buzzing pings wait until a minute after a current calendar event or focus block ends — [README.md:13-14](README.md), [lib/push.js:258-268](lib/push.js)
- Automatic habits not buzzed: "Reminders raise follow-through but can keep a habit from becoming automatic (Stawarz et al. 2015: SMS reminders gave the highest adherence and the lowest SRBAI)"; a miss brings the buzz back — [lib/logic.js:496-506](lib/logic.js), [lib/push.js:326-331](lib/push.js)
- Idle nudge: during personal hours, 60 min with nothing checked off/focused/logged re-buzzes Now as "Stand up first" (titles rotate), max 2 in a row; each due nudge sent or held on a coin flip and logged; idleTrial compares "something done within the hour" sent vs held; "Prompt effects tend to fade within weeks (HeartSteps: gone by day 28)" — [lib/push.js:218-289](lib/push.js)
- Progress ring large icon (core steps, habits, today's 3 tasks or focus minutes) — [README.md:14](README.md)
- 2-hourly mood check-in pings optional (push.mood) — [README.md:22](README.md)
- Separate scheduled Claude task (7:47am and 4:47pm Toronto) reads get_queue and review and pushes only when something needs attention — [README.md:32](README.md)

### Inferences
- The design consolidates notifications into one ever-current item to limit notification load, with escape valves (Not now with a 2 h hold, What's in the way follow-up).

### Gaps
- Not verified: exact content rules in pingContent for each ping type ([lib/push.js:373-483](lib/push.js) not read in full).

## Handling of overdue, stale, expired and duplicate tasks

### Takeaway
A once-a-day sweep drops tasks past `expires`, adds strikes to tasks that sat in yesterday's top 10 untouched, parks wishes (none/annoyance consequence, undated) at 3 strikes or 14 days untouched, and turns waiting tasks past their chase date into who=claude follow-ups. Obligations at 3 strikes get shrink_due prompts. Overdue tasks carry full urgency (pLate = 1) and are triaged in the weekly review alongside stale (undated, untouched 30+ days) tasks. Duplicates are flagged at capture, not merged automatically.

### Cited Findings
- Sweep runs on the first read each local day: expire, strikes, park wishes, follow-ups, resolve step expiries, lock Today — [lib/tools.js:737-782](lib/tools.js)
- Expired: open/waiting tasks with expires < today -> status dropped, drop_reason 'expired' — [lib/tools.js:742-746](lib/tools.js)
- Strikes: a task seen in a previous day's top 10 (meta.seen, recorded by noteTop on get_queue) and not touched since that day's start gets +1 strike; any deliberate action clears strikes — [lib/tools.js:747-756](lib/tools.js), [lib/tools.js:828-835](lib/tools.js), [lib/tools.js:875-876](lib/tools.js)
- Obligation = consequence in {money, legal, health, career}; wish = {none, annoyance}; STRIKES 3; PARK_AFTER_DAYS 14; untagged tasks never parked — [lib/logic.js:629-642](lib/logic.js)
- Parking: open, undated wishes with >= 3 strikes ('skipped') or untouched 14 days ('untouched') -> parked, never deleted; status=open revives — [lib/tools.js:757-762](lib/tools.js), [lib/tools.js:42](lib/tools.js)
- shrink_due shown on obligations (non-wishes) with >= 3 strikes, with hint to propose the smallest concrete first step — [lib/tools.js:1015](lib/tools.js), [lib/tools.js:724-726](lib/tools.js)
- Waiting: chase_after default 3 business days after waiting_since; when passed, a "Follow up: <title>" who=claude task (5 min, family 'follow up') is created; checking off a follow-up restarts the 3-business-day clock — [lib/tools.js:763-773](lib/tools.js), [lib/tools.js:1163-1165](lib/tools.js), [lib/logic.js:622-627](lib/logic.js)
- Overdue in ranking: pLate = 1 (full urgency U), flagged "OVERDUE" in why; excluded from the "work ahead" sum "so a backlog of missed chores shouldn't make every later deadline look unreachable" — [lib/logic.js:388-397](lib/logic.js), [lib/logic.js:409-412](lib/logic.js), [lib/logic.js:448](lib/logic.js)
- Repeating overdue task: on check-off the due date rolls forward until after today ("an overdue daily task lands on tomorrow") — [lib/tools.js:1170-1175](lib/tools.js)
- Review lists: overdue = open with due < today; stale = open, undated, not updated in 30 days; parked_last_7_days; expired_last_7_days — [lib/tools.js:2121-2126](lib/tools.js)
- Duplicates: flagged via similarity at add_tasks with an offer to drop/merge; inbox captures that duplicate can be dropped by Claude — [lib/tools.js:1065-1076](lib/tools.js), [lib/tools.js:992](lib/tools.js)
- Undo: last check-off within 15 minutes can be undone, restoring a repeating task's previous due — [lib/tools.js:838-853](lib/tools.js), [lib/tools.js:1143-1151](lib/tools.js)

### Inferences
- Backlog hygiene is asymmetric by consequence: obligations are made smaller, wishes are quietly set aside; neither path deletes.

### Gaps
- No automatic duplicate merging; no automatic rescheduling of overdue one-off tasks (left to weekly review / Claude).

## Research citations present in code comments, instructions and README

### Takeaway
Thirteen distinct research references appear, concentrated in ranking (logic.js), feedback/accountability (metrics.js), capture instructions (tools.js) and reminders (push.js/logic.js); several principles are named without a citation (implementation intentions, WOOP/mental contrasting, behavioural activation, graded task assignment, synchrony effect).

### Cited Findings
- Masicampo & Baumeister 2011 — specific next action stops an open loop from nagging — [lib/tools.js:28](lib/tools.js)
- Halkjelsvik & Jorgensen 2012 — underestimate long tasks, overestimate short ones — [lib/logic.js:201](lib/logic.js)
- Buehler et al. 1994 — prior of 1.3x overrun (planning fallacy) — [lib/logic.js:202](lib/logic.js)
- Zhu, Yang & Hsee 2018 — mere urgency effect — [lib/logic.js:367-368](lib/logic.js)
- Leroy 2009 — attention residue (place batching) — [lib/logic.js:425-426](lib/logic.js)
- May & Hasher (no year) — synchrony effect for peak hours — [lib/logic.js:155-156](lib/logic.js)
- Stawarz et al. 2015 — SMS reminders: highest adherence, lowest SRBAI automaticity — [lib/logic.js:496-499](lib/logic.js)
- SRBAI (Self-Report Behavioural Automaticity Index), 4 items — [lib/tools.js:58](lib/tools.js)
- HeartSteps (micro-randomized trial; prompt effects gone by day 28) — [lib/push.js:241-244](lib/push.js)
- Harkin et al. 2016 — progress monitoring/reporting (d 0.47-0.55 reported vs 0.19 private) — [lib/metrics.js:75](lib/metrics.js), [lib/metrics.js:132-134](lib/metrics.js), [README.md:22](README.md)
- Kluger & DeNisi 1996 — feedback aimed at the person backfires — [lib/metrics.js:77](lib/metrics.js)
- WOOP / mental contrasting, "g about 0.24 to 0.34" (no author/year) — [lib/tools.js:62](lib/tools.js)
- Schoenfeld et al. 2017 — 10 hard sets per muscle per week (lifting module) — [lib/lift.js:14](lib/lift.js)
- Named principles without citation: implementation intentions [lib/tools.js:58](lib/tools.js); behavioural activation and graded task assignment [lib/today.js:6-9](lib/today.js), [lib/mood.js:1](lib/mood.js); Smith's rule and Apparent Tardiness Cost scheduling [lib/logic.js:358-366](lib/logic.js), [README.md:9](README.md); "don't miss twice" [lib/logic.js:500](lib/logic.js); depression underpredicting activity benefit [lib/mood.js:124-125](lib/mood.js); goals as reference points [lib/today.js:8](lib/today.js)

### Inferences
- The codebase already cites research for roughly each major mechanism; a writer mapping principles can treat these as "implemented and cited" vs principles named only in prose.

### Gaps
- Citations were found by grep for author-year patterns and known terms; a principle described in prose without a recognizable name may have been missed. android/ Kotlin sources and lib/views.js / lib/ui.js were only spot-checked.
