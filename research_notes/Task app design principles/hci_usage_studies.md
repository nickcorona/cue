# How people actually use (and abandon) to-do lists: HCI and industry evidence

Scope note: Peer-reviewed findings are marked **[PR]**, and industry, vendor or blog claims are marked **[IND]**. Sample sizes are given wherever I found them, because most of this literature rests on small qualitative samples.

## 1. Classic HCI studies: task types, list bloat, reminding, deferral

### Takeaway
The classic field studies (Bellotti 2003/2004, Haraty/McGrenere 2012–2016, Kamsin 2012, Lund & Wiese 2021) agree on several points:
- Most to-dos never live in a dedicated list. They are scattered across email, calendar, paper and physical objects.
- People write them as minimal, ungrammatical cues.
- People prioritize competently. The hard part is the effort of making sure important things still happen when overload hits.
- Behavior differs a lot between people and drifts over time with workload.

The design lessons that recur are: very low-friction capture, flexible and unimposed structure, multiple views, "in-the-way" reminding, and a way to retire stale low-priority items.

### Cited Findings
**Bellotti et al. 2004, "What a To-Do" (CHI 2004, PARC) [PR]**
- **Snapshot pilot study:** 8 participants (3 admin staff, 4 researchers, 1 manager) counted 595 active to-dos.
  - The average was **74.4 active to-dos per person (median 65)**, spread over **11.25 different resources (median 11.5)**.
  - Email held the largest share (avg 26.6 per person, 35.8%), followed by the online calendar (8.6, 11.6%) and paper lists or notepads (7.2, 9.7%). A dedicated online to-do list held only 3 per person (4.0%).
  - "We found only 14% of the to-dos we counted were in a list."
  - About half of all to-dos were already online, mostly in email and the calendar. — [Bellotti et al. 2004 PDF](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Capture:** "To-dos are made expending minimal effort." Entries are ungrammatical cues ("Send Mother's Day", "Beth blah blah", "Joe the attorney"), and a cue that minimal "is only effective for a limited period of time while the task stays in memory." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **"In-the-way" reminding:** Many to-dos are prompts placed where a routine will cause them to be discovered at the right moment, such as an object left next to the bag you take home or an email left in the inbox. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **List bloat handled by neglect:** Two participants deliberately kept low-priority to-dos in an electronic form that would be lost if the app or machine crashed ("An effective way of reducing the task list!"). Among the stated design requirements is "A mechanism for handling stale to-dos of low importance that are diminishingly likely to ever get done but have not been explicitly deleted." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Other design requirements from the same paper:**
  - Diverse views that go beyond lists.
  - The in-the-way property: becoming the habitual place where routine activity happens.
  - Being "instantly on" for quick input.
  - "No formal task description, categorization or decomposition required from users," with any level of abstraction allowed.
  - The paper also notes that "PDA's are often abandoned due to slow laborious input and attenuated output." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Longer-term study design:** 7 busy professionals (managers, a professor, sales and product managers) tracked 287 to-dos (228 unique) over several weeks. The study combined weekly task tracking, a day of shadowing and a final interview, and inter-coder agreement was 92%. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Completion results from that study:**
  - **68% of tasks were done within a week. 81% were dealt with by the final interview.**
  - A further **16% were undone for a good reason**, such as no longer being needed.
  - **Only 3% were dropped without good reason.** The authors caveat that the 81% may overstate true completion because participants chose which tasks were tracked. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Deferral signal:** Older and newer tasks were completed at the same rate. The authors read this as "tasks planned for the weeks ahead that are not completed after two weeks are unlikely ever to get done." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Correlates of completion within a week (Table 3):**

  | Factor | Done if high/yes | Done if low/no |
  |---|---|---|
  | Urgency | 93% | 44% |
  | Meeting | 87% | 66% |
  | Importance | 81% | 42% |
  | Someone expecting it | 77% | 53% |
  | Other people involved | 82% | 62% |
  | Non-discretionary | 79% | 63% |

  - Having a deadline was not significant.
  - Self-assigned versus assigned-by-others made no difference.
  - Discretionary tasks were less likely to be done. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Lists and reminders:** Being on a list correlated positively with importance and *negatively* with being done within a week (p<0.001). Important tasks get listed because they are being delayed. Having **no reminder at all** correlated positively with completion within a week (p<0.01), because routine and habitual tasks don't get written down. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Duration estimates:** Recalled durations matched predictions in only 25% of cases. In 40% of cases tasks took less time than predicted (averaging 77% of the predicted time), and in 35% they took more (averaging 130%). — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Central conclusion:** "The problem with task management is not failure to prioritize well… it is the effort that must go into making sure that the important tasks get done, even if the unexpected occurs." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Strategies observed:**
  - "Task vistas": weekly whole-list overviews, with items reappearing week after week.
  - Small informal daily priority lists, made at home for the next day.
  - State-tracking boards for many parallel threads.
  - Calendar "events" to make sure something gets noticed later, and blocked time to protect critical tasks.
  - One manager bucketed tasks into "under 15 min" and "30 min–1 h+", which "made her task list seem far less daunting."
  - One overwhelmed manager simply replaced his list with a freshly structured one instead of updating it. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)

**Bellotti, Ducheneaut, Howard & Smith 2003, "Taking email to task" (CHI 2003) [PR]**
- Taskmaster reframed the email client as a task manager by grouping messages, links and attachments into thread-based task collections ("thrasks"). It was evaluated with live email data over a two-week period. — [CHI 2003 citation](https://bibtex.github.io/CHI-2003-BellottiDHS.html); [Stanford seminar abstract](https://hci.stanford.edu/seminar/abstracts/02-03/030214-bellotti.html)
- Analysis by content found that 46.9% of messages were threaded. Workload was characterized by the number of threads tracked per day and the length of the intervals between messages in them. — [archive.org copy](https://archive.org/3/items/p_20231125/P5.pdf) (from the search snippet; full text not verified)

**Haraty, McGrenere & Tang 2016, "How personal task management differs across individuals" (IJHCS 88) [PR]**
- **Methods:** Study 1 was a focus group plus contextual interviews with 19 academics. Study 2 was an online survey of 178 respondents, 164 of whom were classified.
- **Three user types:**
  - **Adopters** use a dedicated e-PTM tool.
  - **DIYers** use and personalize a general tool such as paper, a planner or a text file.
  - **Make-doers** use general tools such as email, calendar or paper without personalizing them.
- In Study 1 there were 11 DIYers, 4 adopters and 4 make-doers. In the survey, many people were mixtures of these tendencies rather than clean types. — [Haraty et al. 2016 PDF](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Settling as DIYers:** 5 of 11 DIYers became DIYers *after trying* dedicated tools. The reasons included a mismatch with existing PTM systems and their steep learning curve. One said of GTD: "much overhead for me… It was over-organizing everything." DIYers cherry-picked GTD strategies rather than adopting the whole method. — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Make-doers and defaults:** None of the make-doers had ever changed default calendar reminder settings, yet 2 of 4 complained that the default 10-minute-ahead reminder was too short. — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Remembering strategies:** Five emerged:
  - notification-based (setting reminders)
  - polling-based (checking a list)
  - placing cues
  - relying on others to remind
  - rehearsal

  The notification strategy dominated among people whose tools offered reminders. — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Recommendation:** Tools should be personalizable for DIY tendencies but "relatively effortless to use and integrate well with other systems" for make-do tendencies. — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Framing quote on abandonment:** The paper quotes a Quora respondent: "All solutions have high abandonment rates, and ironically pen and paper is voted the best task manager on Lifehacker each year." This is an anecdote the paper quotes, not a finding. — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- A companion paper exists: Haraty et al., "How and why personal task management behaviors change over time" (Graphics Interface 2015). — [GI record](https://graphicsinterface.org/?p=5190) (not read in full)

**Kamsin, Blandford & Cox 2012, "Personal Task Management: My Tools Fall Apart When I'm Very Busy!" (CHI EA 2012) [PR, extended abstract]**
- Studied academics' PTM. The title states the core finding: tools break down under heavy workload. — [search result / thesis on Scribd](https://www.scribd.com/document/707323284/AKamsinPhD-Thesis)
- The related PhD thesis, "Improving Tool Support for PTM" (UCL 2014), covers academics' strategies over time and an evaluation of existing tools. — [Kamsin thesis](https://www.scribd.com/document/707323284/AKamsinPhD-Thesis)

**Lund & Wiese 2021, "Less is More: Exploring Support for Time Management Planning" (DIS 2021) [PR]**
- **Methods:** 19 graduate students took part in interviews plus a 5-day guided planning diary.
- **Results:**
  - Only **2 of 19 fully engaged in all prescribed planning behaviors for all 5 days**, and only 6 in total even partially engaged in every behavior each day.
  - Prioritization was the behavior most often dropped. Some participants gave every task the same priority.
  - Several found prioritizing and assigning times "tedious."
  - 6 participants had at least one day with no planning at all, typically when one dominant event or illness overrode everything or when all tasks were already routine.
  - 2 participants never did the diary at all. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353)
- **Planning drifts with workload:** People move toward more structure when overwhelmed and fall back to simple lists or memory when less pressed. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353)
- **Checking off motivates:** 11 of 19 said marking tasks complete was motivating. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353)
- **Design conclusion:** TMP software "must not impose a specific structure." The authors propose a flexible, notes-app-like planner that encourages but does not require planning behaviors. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353)

**Whittaker et al. 2011, "Am I wasting my time organizing email?" (CHI 2011, IBM) [PR]**
- **Methods:** An instrumented email client was deployed to 345 long-term users, covering more than 85,000 refinding actions.
- **Findings:**
  - Search and threading supported more effective refinding.
  - People who filed messages into folders were no more successful at refinding than people who let their inbox grow.
  - Scrolling was the most common refinding behavior.

  The figures popularly quoted from this study, "3.4× faster" and "filers waste 20 minutes a day", were not verified against the paper. — [IBM Research page](https://researcher.ibm.com/publications/am-i-wasting-my-time-organizing-email-a-study-of-email-refinding); [itnews coverage](https://www.itnews.com.au/news/ibm-says-email-filing-a-waste-of-time-258539)

### Inferences
- Effort spent organizing (folders, categories, prescribed planning steps) often doesn't pay off. Across email refinding (Whittaker), the GTD-overhead quotes (Haraty) and planning-diary compliance (Lund & Wiese), people skip structure that a system demands. Cheap capture plus good retrieval beats upfront filing.
- Bellotti's "a list correlates with *not* being done this week" and "unfinished after two weeks means likely never" together suggest that age-based staleness is a usable signal for surfacing, demoting or retiring items.
- Social accountability (someone expecting it, other people involved, meetings) is among the strongest completion correlates. Self-imposed discretionary tasks are where lists underperform, which is exactly where a personal app has to do the most work.
- A single-user app should expect users to move between "adopter" and "make-doer" modes and between heavy and light planning, depending on load. It should degrade gracefully into a simple list rather than demand full use.

### Gaps
- I couldn't access the full text of Kamsin 2012, Haraty GI 2015 (change over time) or Bellotti 2003, so their specific numbers on tool switching and breakdown under load are missing.
- Whittaker's work on email as a task manager (Whittaker & Sidner 1996, "Email overload") is cited only indirectly, via Haraty 2016's mention of three email-management strategies. I did not read it.

## 2. Task completion rates and the "41% never completed" stat

### Takeaway
The widely quoted figure that "41% of to-do items are never completed" is an iDoneThis internal user-data claim from about 2012–2014. It has no published methodology: no sample size, time window, or definition of "never" (it may include items users abandoned or kept as wish lists). Treat it as marketing-grade. The best peer-reviewed number points the other way: in Bellotti's tracked sample, 81% of tasks were dealt with and only 3% were dropped without good reason. That sample was small and self-selected.

### Cited Findings
- **iDoneThis claims [IND]:** "41% of to-do items are never completed", "50% of completed to-do items are done within a day", and "15% of dones started as to-do items." The figures were later repeated by Entrepreneur, NBC and others. — [Entrepreneur](https://www.entrepreneur.com/article/235440); [NBC News](https://www.nbcnews.com/news/amp/wbna55607471); [CUInsight headline](https://www.cuinsight.com/41-of-items-on-the-average-to-do-list-are-never-finished/)
- **Original blog unavailable:** The iDoneThis blog URL now 301-redirects to an unrelated company (oz.anyreach.ai), so the original post and any methods can't be retrieved. — [blog.idonethis.com redirect](https://blog.idonethis.com/?p=1475)
- **Context on the source:** iDoneThis is a "done list" product with a commercial interest in arguing that to-do lists fail. A search summary also reports that iDoneThis later dropped its own to-do feature because tasks piled up as a persistent list. This is from a snippet I did not verify. — [blog.idonethis.com](https://blog.idonethis.com/?p=1587)
- **Bellotti 2004 counter-evidence [PR]:** In the tracked sample (7 people, 287 tasks), 68% were done within a week, 81% were dealt with by the end of the study, 16% were justifiably undone and 3% were dropped without reason. The authors caveat that participants chose the tasks tracked. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf)
- **Columbia study on busyness and deadlines [PR, per press coverage]:**
  - Published in the *Journal of Personality and Social Psychology*. The authors are not named in the coverage.
  - The largest dataset logged 28,800 users of a task-management app over 18 months.
  - Busier people were more likely to push back deadlines but also more likely to eventually complete delayed tasks.
  - Less busy people who missed a deadline felt more guilt and were more likely to abandon the task.
  - I read the press coverage only, not the paper. — [ScienceAlert](https://www.sciencealert.com/staying-busy-is-the-secret-to-being-productive-says-study)

### Inferences
- The 41% and 3% figures measure different things:
  - iDoneThis likely counts every item ever entered in an app, including aspirational and stale items.
  - Bellotti counts only tasks that participants chose to track, and accepts "good reason" non-completion.

  A realistic framing is that a large share of captured items never get done, but many of these are legitimately obsolete rather than failures. So the app should make "no longer needed" or expiry a first-class, non-failure outcome.
- The Columbia finding suggests that missing a deadline is not itself fatal. What matters is whether the miss produces guilt-driven abandonment. Frictionless rescheduling with little shame may help completion.

### Gaps
- I found no published Todoist or Microsoft To Do completion-rate statistics, internal or otherwise.
- I didn't find the JPSP paper's authors or effect sizes, or the name of the app used.

## 3. Why people abandon productivity apps

### Takeaway
Hard retention data for to-do apps specifically is not public. General productivity apps keep roughly 4–12% of users at day 30, according to vendor benchmarks of mixed quality. Peer-reviewed qualitative work points to these reasons for abandoning tools:
- setup and organizing overhead, and steep learning curves
- imposed structure that doesn't fit
- tools collapsing under heavy workload
- the tool not changing behavior people would have done anyway

The "overdue pile-up and guilt leads to avoiding the app" mechanism is widely reported by founders and bloggers but not measured in peer-reviewed work.

### Cited Findings
- **Day-30 retention benchmarks [IND]:**
  - Productivity apps: about 4.1% in one source, an 8% median (UXCam 2026) in another, and 8% "average" / 12% "good" in Appalize's table.
  - Cross-category day-30 retention is about 4–6% (Adjust 2024: 5.7%). The widely cited ~6% figure traces to a 2021 AppsFlyer report. — [quashbugs summary](https://quashbugs.com/blog/app-retention-rate-statistics); [Appalize](https://www.appalize.com/blog/mobile-trends/app-retention-rate-benchmarks-by-category-in-2026); [Braze](https://www.braze.com/blog/mobile-app-retention-10-tip/)
- **Tool switching and overhead [PR]:** 5 of 11 DIYers gave up dedicated tools because of mismatch with their needs and steep learning curves. They cited GTD as "much overhead… over-organizing everything." — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf)
- **Breakdown under load [PR]:** Tools "fall apart when I'm very busy." — [Kamsin et al. 2012](https://www.scribd.com/document/707323284/AKamsinPhD-Thesis)
- **Prescribed planning gets dropped [PR]:** Planning-diary compliance collapsed within days. Prioritization and time-assignment were dropped as "tedious," and some participants skipped planning entirely on chaotic days. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353)
- **Williams & Beale 2025, "Am I Productive?" (CHItaly 2025) [PR]:**
  - **Methods:** A 2-week diary study plus interviews. Of 26 people who signed up, 18 completed; 8 dropped out, 6 of them by going non-responsive. Participants used either digital GTD-style apps (Todoist, Microsoft To Do, Any.do, Nirvana) or pen and paper.
  - **Productivity:** There was no significant difference in self-rated productivity between groups (18.36 vs 17.88; p=0.887).
  - **Where time went:** About 88% of tool time went to planning and writing tasks, 8.2% to scheduling, and 3.8% to finding information or customizing.
  - **Reasons tools lost value:** Some said the tool didn't change behavior ("would have done it anyway"), and re-entering routine tasks felt repetitive.
  - **Feature discovery:** Users wanted rescheduling and repeat tasks without knowing they already existed. Learning the basics took the full two weeks.
  - **Paper's weaknesses:** Paper users mainly lacked reminders and mobility. — [Williams & Beale 2025](https://ar5iv.arxiv.org/html/2510.06816)
- **Overdue pile-up and guilt [IND, anecdotal]:**
  - A founder reports that users stop "because opening the app starts feeling mentally heavy."
  - A product case study claims interviews with 24 users plus a diary study found that overdue counters, red badges and aggressive notifications led people to avoid the app. Its methodology is unpublished.
  - Blogs describe a loop: "30 overdue items → guilt → stop opening." — [Indie Hackers post](https://www.indiehackers.com/post/i-stopped-opening-todo-apps-because-of-the-guilt-so-i-built-one-with-no-overdue-label-at-all-gEmxidjhiObz4OgDfPs4); [Indie Hackers "guilt retention"](https://www.indiehackers.com/post/i-think-productivity-apps-accidentally-optimize-for-guilt-retention-a6049f01c8); [goalsandprogress.com](https://goalsandprogress.com/why-task-systems-fail/)
- **Guilt and abandonment of tasks [PR via press]:** Guilt after a missed deadline, combined with low motivation, predicted abandoning that task. — [ScienceAlert on JPSP study](https://www.sciencealert.com/staying-busy-is-the-secret-to-being-productive-says-study)

### Inferences
- Reducing ongoing overhead (re-entering recurring items, mandatory fields, prioritizing every item) matters more than features, since most tool time is spent just writing tasks.
- The "system collapse" pattern, where heavy load or missed days lead to an overdue wall and then avoidance, has strong qualitative support. It fits Kamsin's finding and the guilt mechanism in the JPSP study, but no quantitative app study confirms it. Design responses include a daily blank slate, quiet rollover of overdue items, and expiry or "stale" handling.

### Gaps
- I found no peer-reviewed quantitative churn analysis for to-do apps, and no Todoist, Things or Microsoft disclosure of retention or reasons for churn.
- I did not systematically sample Reddit or Hacker News threads, so practitioner patterns there rest on the secondary blog sources above.

## 4. Capture vs. review: weekly review, inbox processing, capture friction

### Takeaway
The evidence for low-friction capture is strong and consistent:
- To-dos are written as minimal cues.
- Slow input caused PDA abandonment.
- Most tool time is spent capturing.

The evidence for structured review is much weaker. GTD's weekly review has theoretical support only (Heylighen & Vidal 2008), and I found no controlled test of it. Bellotti's "task vista" practitioners did do weekly whole-list reviews naturally.

### Cited Findings
- **Capture effort:** To-dos are made with minimal effort, often ungrammatical, and the cue fades over time. A task list manager must be "instantly on" for quick input and must not require formal description or categorization. "PDA's are often abandoned due to slow laborious input." — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf) [PR]
- **Where tool time goes:** About 88% of tool time went to identifying and writing tasks. — [Williams & Beale 2025](https://ar5iv.arxiv.org/html/2510.06816) [PR]
- **Weekly review practiced naturally:** Two of seven Bellotti participants produced weekly "task vistas" (all on paper), with items reappearing week after week. Another made small daily priority lists the evening before. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf) [PR]
- **GTD's evidence base:** Heylighen & Vidal 2008 (*Long Range Planning* 41(6)) argue that GTD is consistent with distributed and situated cognition theory. It is a theoretical review, not an empirical test. — [Heylighen & Vidal (Scribd)](https://www.scribd.com/doc/263952001/Heylighen-Vidal-GTD-Science)
- **Weekly-planning field experiment (unverified):** A 2023 study in the *Journal of Occupational and Organizational Psychology* (208 participants, 947 weekly diaries) reportedly found that weekly planning reduced unfinished tasks and after-work rumination. This comes from a blog summary and is unverified. — [weekplan.net](https://weekplan.net/weekly-review-productivity/) [IND-reported]

### Inferences
- Capture should be "instantly on", accept a fragment, and let structure be added later or inferred. Review should be offered as a lightweight ritual, not required, because prescribed planning steps get skipped (Lund & Wiese).

### Gaps
- I found no peer-reviewed study comparing natural-language or voice capture with form-based capture for task completion.
- I found no controlled evidence on the GTD inbox-processing step specifically.

## 5. Reminders and notifications: what gets acted on vs. dismissed

### Takeaway
Most notifications that aren't messages are not acted on. Conversion is about 15–27% for email, social and other non-messaging apps, versus about 64–66% for messages, in a log of 794,525 notifications. Engagement is driven by sender importance and by content that is urgent, important or useful. The JITAI framework (Nahum-Shani) adds that a prompt should arrive in a state of opportunity *and* receptivity, meaning the person can actually receive and act on it. Bellotti's "in-the-way" finding suggests that placing a cue in a routine path can beat a timed alert.

### Cited Findings
- **Pielot, Vradi & Park 2018, "Dismissed!" (MobileHCI 2018) [PR]:**
  - Logged 794,525 notifications from 278 Android users in Spain over about 4 weeks.
  - The median user received 56 notifications per day.
  - Conversion rates:

    | Notification type | Conversion |
    |---|---|
    | Individual messages | 63.67% |
    | Group messages | 65.81% |
    | Email | 15.47% |
    | Social | 26.55% |
    | Other non-messaging | 16.19% |

  - 20–35% of notifications arrived while the phone was already unlocked.
  - "the main difference in handling notifications is how long users leave them unattended if they will ultimately not consume them." — [Pielot et al. 2018](https://www.interruptions.net/literature/Pielot-MobileHCI18.pdf)
- **Mehrotra et al. [PR]:**
  - A field study of 35 users collected about 70,000 notifications.
  - Messages from family and work-related email contacts had the highest acceptance, defined as attending to the notification within 10 minutes.
  - Analysis of 474 self-reports found that people click quickly when the sender is important or the content is important, urgent or useful.
  - Uninteresting or irrelevant notifications are mostly swiped away. — [Mehrotra/UCL repository](https://discovery.ucl.ac.uk/id/eprint/1502364/); [intelligent notification survey](https://arxiv.org/pdf/1711.10171)
- **Nahum-Shani et al. JITAI framework [PR]:**
  - A "state of vulnerability/opportunity" is a period of susceptibility to negative outcomes or to positive behavior change.
  - "Receptivity" is defined as "the conditions in which the person can receive, process, and use the support provided."
  - JITAIs adapt the timing and type of support to these states. — [Nahum-Shani et al. 2015 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4732268); [Nahum-Shani et al. 2017/18 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5364076)
- **JITAI implementation gaps:** A 2025 systematic review found that many JITAIs lacked essential elements such as adaptivity and receptivity. — [Frontiers in Digital Health 2025](https://www.frontiersin.org/articles/10.3389/fdgth.2025.1460167/full) [PR]
- **Receptivity detection:** Künzler et al. studied detecting receptivity to mHealth interventions in the wild. — [Künzler et al.](https://www.cs.dartmouth.edu/dfk/research/kunzler-receptivity/kunzler-receptivity.pdf) [PR] (not read in full)
- **Reminder defaults:** Make-doers never change default reminder lead times even when they dislike them (a 10-minute lead was considered too short). — [Haraty 2016](https://www.cs.ubc.ca/labs/edapt/papers/haraty2016_2.pdf) [PR]
- **Situated cues:** Situated prompts placed in a routine path ("in the way") are a primary reminding strategy in the wild. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf) [PR]
- **Reminders for done tasks:** Reminders about already-completed tasks are a known failure. White et al. built completion-detection models (accuracy above 80%) partly so that such notifications can be suppressed. — [MSR Task Completion Detection](https://www.microsoft.com/en-us/research/publication/task-completion-detection/) [PR]

### Inferences
- A to-do reminder competes in the low-conversion non-messaging class. To be acted on, it needs to look important, urgent or useful at a glance, and ideally to carry social weight (who is expecting it), echoing Bellotti's "someone expecting" correlate.
- Defaults matter enormously, because most users never change them. Notification lead times and quiet hours should be well chosen out of the box.
- A reminder left unattended for a long time is a signal that it won't be acted on. That signal could feed snooze, re-timing or "retire this task" prompts.

### Gaps
- I found no task-app-specific study of reminder conversion, such as Todoist reminder tap-through rates.
- The numbers for Mehrotra CHI 2016 ("My Phone and Me") come from search snippets, not the full text.

## 6. Microsoft Research task intelligence and "My Day"

### Takeaway
Microsoft Research has a body of peer-reviewed "task intelligence" work, mainly by Ryen White and colleagues, on detecting task completion, estimating task duration from calendar data, and detecting microtasks. It is motivated by the clutter of lists that mix done and undone items and by people's poor duration estimates. For My Day, Microsoft's public rationale is a daily blank slate that reduces anxiety about ever-growing lists. That rationale comes from product and marketing material, not a published study.

### Cited Findings
- **Task completion detection:** White, Hassan Awadallah & Sim, "Task Completion Detection: A Study in the Context of Intelligent Systems" (SIGIR 2019). The paper notes that lists mixing completed and open items lose value and generate reminders for work already done. Its models, trained on digital-assistant logs, infer completion with over 80% accuracy, so that finished items can be retired and notifications suppressed. — [MSR publication](https://www.microsoft.com/en-us/research/publication/task-completion-detection/); [SIGIR anthology](https://ir.webis.de/anthology/2019.sigirconf_conference-2019.43) [PR]
- **Task duration estimation:** White & Hassan Awadallah, "Task Duration Estimation" (WSDM 2019). It uses population-scale data from millions of anonymized calendar events to estimate how long tasks take, motivated by people's difficulty with estimates and their optimism and overconfidence biases. It is aimed at assistants and calendars that "find time for tasks." — [WSDM 2019 PDF](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/TaskDuration-WSDM2019.pdf) [PR]
- **Microtask detection:** White, Nouri, Woffinden-Luey, Encarnación & Jauhar, "Microtask Detection" (ACM TOIS 2021). It identifies short, self-contained actionable steps, because many list items are not directly actionable. — [Academia.edu copy](https://www.academia.edu/91876723/Microtask_Detection) [PR]
- **Overview talk:** MSR's "Task Intelligence: Doing More with Less" talk gives an overview of this research line. — [MSR video](https://www.microsoft.com/en-us/research/video/task-intelligence-doing-more-with-less/)
- **My Day rationale [IND]:**
  - The team wanted "a fresh start," and the daily reset frees users from "the anxiety that accompanies an ever-growing to-do lists."
  - My Day refreshes "so you can start the day with a blank slate," with unfinished items staying in their original lists. — [Microsoft Tech Community 2018](https://techcommunity.microsoft.com/t5/microsoft-to-do/introducing-steps-in-microsoft-to-do/m-p/3773684); [Microsoft 365 blog 2019](https://www.microsoft.com/en-us/microsoft-365/blog/2019/09/09/announcing-new-version-microsoft-to-do/)
- **Shipping status:** No source confirmed that the duration model shipped in Microsoft To Do. — [search results above]

### Inferences
- My Day operationalizes Bellotti's small daily "informal priority list" together with a defense against list bloat. It agrees with the qualitative abandonment evidence, though no published evaluation of it exists.
- Microtask detection and Bellotti's "under 15 minutes" bucketing both suggest that breaking work into small, sized steps reduces how daunting a list feels.

### Gaps
- I found no published user study of My Day's effect on completion or retention.
- I couldn't verify a Gil, Y. connection to the task-intelligence papers. Gil's earlier work on to-do-list intelligence (the CALO/ISI "to-do list" project) was not located in this search.

## 7. Calendaring tasks / timeboxing vs. list-keeping

### Takeaway
People do use calendars to make sure things get noticed and to protect time for critical tasks. However, calendars are overloaded with non-plans, and people routinely deviate from them. Only a minority of planners build time-specific schedules, and rigid calendar events fit poorly with fluid plans. I found no peer-reviewed study showing that timeboxing beats lists. The popular "timeboxing is the #1 hack" claim traces to an HBR opinion piece.

### Cited Findings
- **Calendar strategies:** Calendar "events" are placed to make sure a task gets noticed later, and time is blocked out to protect critical tasks ("a time slot that I wanted to protect"). Participants under the most deadline pressure used these strategies most; they accounted for 93% of deadline task codes. — [Bellotti 2004](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf) [PR]
- **Who schedules:**
  - Only 6 of 19 participants created schedules: 4 with concrete times and 2 with "soft" schedules. The rest made to-do lists or used a pause-and-resume approach.
  - Prior work cited in the paper shows calendars are used for many things other than task plans, and that "people tend not to follow what is on their calendars."
  - Paper or plain-text plans allowed fluid times ("on way back"), compared with "the rigidity of a calendar event."
  - Participants found assigning specific times "tedious" on some days. — [Lund & Wiese 2021](https://par.nsf.gov/servlets/purl/10311353) [PR]
- **Scheduling preferences:** Microsoft-affiliated work on scheduling preferences (Sun, Mok, Sen, Sarrafzadeh) used a survey of 165 respondents on temporal preferences in calendaring. It is not a timeboxing test. — [arXiv 2309.08104](https://arxiv.org/pdf/2309.08104) [preprint]
- **Source of the timeboxing claim:** The claim that timeboxing is the most useful productivity hack traces to an HBR analysis of 100 hacks, as cited secondhand. I found no primary peer-reviewed evidence. — [search results; e.g. Goodreads/Nir Eyal post](https://www.goodreads.com/author_blog_posts/17694932-how-timeboxing-works-and-why-it-will-make-you-more-productive?tab=author) [IND]

### Inferences
- Optional, soft time-anchoring (morning/afternoon, "before 3pm") is a better fit for observed behavior than mandatory hard timeboxes. Hard time blocks suit a minority of users and high-pressure periods.

### Gaps
- I found no controlled or field study comparing timeboxing with list-keeping on completion rates.
- The broad implementation-intentions literature (if-then plans) is relevant to "scheduling a when," but it was outside this search and is not covered here.
