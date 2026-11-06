# Behavioral Science of Task Completion and Procrastination (for a personal to-do app)

Evidence grading used below:
- **A**: meta-analysis or multisite / preregistered replication supports the finding.
- **B**: several primary studies or large field data, no strong replication record either way.
- **C**: single study or small samples, untested replication, or contested.
- **X**: failed large-scale replication; treat as unreliable.

Method note: this session ran about 17 search/fetch calls. Findings marked "[verified this session]" were checked against an abstract or primary listing. Classic papers marked "[from prior knowledge; DOI given]" are cited from well-known published papers I did not re-fetch; the report writer should treat their exact numbers as needing a spot-check. Several publisher pages (T&F, Nature) blocked full-text fetches, so some numbers come from abstracts or secondary summaries, and the notes say so where that is the case.

## 1. Implementation intentions (when/where/how plans)

### Takeaway
If-then plans ("When X happens, I will do Y") reliably increase follow-through (grade A). The size of the effect is smaller than the classic d = 0.65 once publication bias is corrected (somewhere in d ≈ 0.15–0.35), and it is largest when the plan is in contingent if-then format, the person is already motivated, and the plan is rehearsed. For the app, this means asking for a cue (time, place or preceding event) and a concrete first action on tasks that matter. It will not rescue tasks the person does not actually want to do.

### Cited Findings
- Gollwitzer & Sheeran (2006), meta-analysis: 94 independent tests, more than 8,000 participants, medium-to-large effect on goal attainment, d = 0.65 [from prior knowledge; DOI given] — [Gollwitzer & Sheeran 2006, Adv. Exp. Soc. Psych. 38](https://doi.org/10.1016/S0065-2601(06)38002-1)
- Sheeran, Listrom & Gollwitzer (2024 online, *European Review of Social Psychology* 2025): 642 tests. Implementation intentions improved cognitive, affective and behavioral outcomes, .27 ≤ d ≤ .66. Effects were larger with **contingent (if-then) format**, **high goal motivation**, and **rehearsed plans** [abstract via search summary; full text 403] — [T&F listing](https://informahealthcare.com/doi/full/10.1080/10463283.2024.2334563?src=exp-la); [Konstanz repository](https://kops.uni-konstanz.de/handle/123456789/69905)
- Bias-corrected estimates reported for that review: trim-and-fill d = 0.35, robust Bayesian meta-analysis d = 0.15 (95% CI 0.08–0.22). These come from secondary summaries; confirm them against the paper — [summary of 642-test review](https://goalsandprogress.com/implementation-intentions-research/)
- Results vary by domain. Weekly alcohol consumption d+ = −0.14 with no effect on heavy episodic drinking (Cooke et al. 2023). Children g = 0.31 (registered-report meta-analysis, 52 effect sizes). Pro-environmental behavior d = 0.78 (k = 31, N = 10,466; preprint, so expect high heterogeneity) — [WhiteRose (Cooke et al.)](https://eprints.whiterose.ac.uk/id/eprint/191494/); [pro-environmental MA preprint](https://www.iit.comillas.edu/documentacion/revista/IIT-25-038R_preprint/A%20meta-analysis%20of%20the%20effectiveness%20of%20implementation%20intentions%20for%20pro-environmental%20behavior%20adoption.pdf)
- Field example: in a flu-vaccination mailing, prompting employees to write down the **date and time** they would get the shot raised vaccination by about 4 percentage points over control. Writing only the date had a smaller effect. Treat the exact percentages as needing a check [from prior knowledge; DOI given] — [Milkman et al. 2011, PNAS](https://doi.org/10.1073/pnas.1103170108)
- Boundary condition: very specific plans can make people "closed-minded" and cause them to miss alternative opportunities to reach the goal (Masicampo & Baumeister) — [Committed but closed-minded](https://typeset.io/pdf/committed-but-closed-minded-when-making-a-specific-plan-for-7mwopcdiw8.pdf)

### Inferences
- Design: on capture or scheduling, offer a lightweight "When/where will you do this?" slot tied to a cue (a time, a location, or "after X"). Time + date is the minimum that worked in field data. Reserve the full if-then prompt for tasks the user flags as important or keeps postponing, because the effect depends on motivation and unwanted friction on every capture would hurt use.
- Rehearsal moderates the effect, so showing the plan back (in a notification or the morning view) as "When 9am Tue → open draft" is probably better than storing it silently.
- Expect modest gains (roughly a small effect after bias correction). Don't market or design as if planning alone solves procrastination.
- Keep plans editable and easy to re-slot when the cue is missed, to avoid the "closed-minded" failure mode.

### Gaps
- I could not get the full text of Sheeran et al. 2024/2025 to confirm the bias-corrected numbers, or whether behavior-only outcomes differ from cognitive ones.
- I found no direct evidence on implementation intentions delivered through to-do apps specifically (as opposed to lab, health or mailing studies).

## 2. Open loops: the Zeigarnik effect and Masicampo & Baumeister (2011)

### Takeaway
The classic Zeigarnik claim, that unfinished tasks are better *remembered*, does **not** hold up as a general effect (2025 meta-analysis; grade X for the memory claim). The related Ovsiankina effect, a tendency to *resume* interrupted tasks, is supported (grade A–B). Masicampo & Baumeister's finding that making a specific plan quiets intrusive thoughts about unfinished goals is plausible and widely cited, but I found no direct replication (grade C). Capture plus a specific next action is still a sensible design choice, but the "open loops nag you" story is weaker than productivity folklore suggests.

### Cited Findings
- Ghibellini & Meier (2025) meta-analysis, *Humanities & Social Sciences Communications* 12: the Ovsiankina effect (resumption) reflects a general tendency to resume tasks, and the Zeigarnik effect "lacks universal validity". The authors found no reliable memory advantage for unfinished tasks and suggest moderators such as experimenter authority, situational demands and task involvement [verified via abstract listing] — [IDEAS/RePEc listing](https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html); [Bern PDF](https://www.kog.psy.unibe.ch/e48276/e1785865/s41599-025-05000-w1_ger.pdf)
- Secondary sources put the recall ratio at about 0.99 across 37 studies and the resumption rate at about 67% against a 50% baseline. I could not verify either figure in the primary text — [Wikipedia summary](https://en.wikipedia.org/wiki/Zeigarnik_effect)
- Masicampo & Baumeister (2011, JPSP 101(4)): unfinished goals produced intrusive thoughts, higher accessibility of goal-related words and poorer anagram performance. Writing specific plans removed these effects, and the reduction tracked how earnestly people planned — [PubMed 21688924](https://pubmed.ncbi.nlm.nih.gov/21688924/)
- Companion paper (JESP 2011): unfulfilled goals impaired executive-function tasks, most strongly in people high in goal tenacity. The effect disappeared once the goal was completed — [PMC4489331](https://pmc.ncbi.nlm.nih.gov/articles/PMC4489331)
- No published direct replication of the 2011 plan-making effect surfaced in search. These studies come from the same lab and era as ego depletion (see §10), which warrants caution.

### Inferences
- Design: quick, frictionless capture is justified mainly by the robust tendency to resume, the evident risk of forgetting, and plausible relief from intrusive thoughts. It should not be justified by a memory-tension mechanism.
- The Masicampo result specifically credits a *plan* (specific next step), not just writing the task down. So capture should nudge vague items ("Q3 stuff") into a verb-first next action, which Cue's MCP instructions already do. Flag this as resting on grade C evidence.
- Because the resumption effect is real, an app can use it on purpose: show a partially done task (a checklist of subtasks with some ticked) to draw the user back in.

### Gaps
- I found no preregistered replication of Masicampo & Baumeister 2011, and no exact meta-analytic effect sizes for the Ovsiankina effect (paywalled).

## 3. Procrastination models: Temporal Motivation Theory, task aversiveness, emotion regulation, self-compassion

### Takeaway
Steel's meta-analysis (2007, 691 correlations) finds that procrastination is reliably predicted by task aversiveness, delay of rewards, low self-efficacy and impulsiveness (grade A for the correlations; they are correlational, not causal). The emotion-regulation view (Sirois & Pychyl) holds that people procrastinate to repair their mood in the short term, which fits these predictors (grade B as theory). Self-forgiveness after procrastinating predicted less later procrastination in one well-known study (Wohl et al. 2010; grade C, observational, not directly replicated). In the app, this points to reducing a task's aversiveness and its distance from a reward, raising confidence that the next step can be done, and avoiding shaming language around overdue tasks.

### Cited Findings
- Steel (2007), "The nature of procrastination," *Psychological Bulletin* 133(1):65–94: a meta-analysis of 691 correlations. Task aversiveness, task delay, self-efficacy and impulsiveness were strong and consistent predictors, along with facets of conscientiousness (distractibility, organization, achievement motivation) — [U Calgary repository](https://prism.ucalgary.ca/handle/1880/47914); [ScienceDaily release](https://sciencedaily.com/releases/2007/01/070110090851.htm)
- Temporal Motivation Theory equation: Motivation = (Expectancy × Value) / (1 + Impulsiveness × Delay) [from prior knowledge; DOI given] — [Steel 2007, DOI](https://doi.org/10.1037/0033-2909.133.1.65)
- Sirois & Pychyl (2013): procrastination is the "priority of short-term mood regulation". People avoid the negative emotion a task evokes, and this trades future-self costs for present relief [from prior knowledge; DOI given] — [Sirois & Pychyl 2013, Soc. Pers. Psych. Compass](https://doi.org/10.1111/spc3.12011)
- Wohl, Pychyl & Bennett (2010), *Personality and Individual Differences* 48(7):803–808. In first-year students followed over two midterms (N reported as 119 or 134 depending on source), self-forgiveness for procrastinating before exam 1 predicted less procrastination before exam 2, mediated by reduced negative affect. The effect appeared only among high procrastinators. The data are self-report and observational — [BPS Research Digest](https://bps.org.uk/research-digest/cure-procrastination-forgive-yourself); [Psychology Today (Pychyl)](https://psychologytoday.com/blog/dont-delay/201002/forgive-yourself-stop-procrastinating)

### Inferences
- Design, mapped to the TMT terms:
  - **Expectancy**: break tasks into a do-able first step and show past completions of similar tasks.
  - **Value**: show why the task matters (its consequence) and pair it with a pleasant element (temptation bundling, §9).
  - **Delay**: bring the reward or consequence closer, for example with a near-term sub-deadline or immediate completion feedback.
  - **Impulsiveness**: remove distractions during focus sessions.
- Under the emotion-regulation view, the trigger for avoidance is a *feeling* about the task. A "This feels bad / don't know how to start" button that turns a task into a prep or first-step task targets the mechanism directly; Cue already has such a feature.
- Overdue-task UI should be neutral or forgiving, offering "reset" or "reschedule" rather than red counters and streak-loss shaming. This fits Wohl et al. and the emotion-regulation view, but it rests on grade C evidence.

### Gaps
- I could not retrieve Steel's exact r values (the full text redirected). From memory, task aversiveness r ≈ .40 and self-efficacy r ≈ −.38, but these are **unverified; do not cite them without checking the paper's tables**.
- I found no randomized replication of the Wohl et al. self-forgiveness finding.
- Sirois's self-compassion–procrastination correlations (e.g., Sirois 2014, *Self and Identity*) were not retrieved.

## 4. Planning fallacy, time estimation, and unpacking

### Takeaway
People systematically underestimate how long their own tasks will take (grade A–B; a robust, many-times-replicated phenomenon). Unpacking a multi-part task into its components produces longer and more accurate estimates for complex tasks (Kruger & Evans 2004; grade B–C). Duration fields should prompt for subtasks and learn a correction factor from actual-vs-estimated history.

### Cited Findings
- Buehler, Griffin & Ross (1994): honors students predicted their thesis would take about 34 days and it took about 55 days on average. Most did not finish by their own estimate [from prior knowledge; DOI given] — [Buehler et al. 1994, JPSP 67(3)](https://doi.org/10.1037/0022-3514.67.3.366)
- Kruger & Evans (2004), "If you don't want to be late, enumerate": prompting people to unpack multifaceted tasks into subcomponents led to longer, more realistic completion-time predictions. The benefit appeared for complex tasks, not simple ones [from prior knowledge; DOI given] — [Kruger & Evans 2004, JESP 40](https://doi.org/10.1016/j.jesp.2003.11.002)

### Inferences
- Design: when est_min is set on a multi-step task, offer "list the steps" and sum the step estimates. Track estimated vs actual time (focus-session data can supply this) and show a personal multiplier, e.g. "your 30-min tasks take 47 min".
- Use the corrected estimate for daily capacity planning ("over capacity" warnings). Raw self-estimates will over-commit the day.

### Gaps
- No search this session on newer unpacking replications or meta-analyses of planning-fallacy interventions. Whether *using* one's own past data (reference-class forecasting) reduces bias in personal apps is untested in the sources I gathered.

## 5. Task size, first steps, goal gradient, and progress feedback

### Takeaway
Motivation rises as a goal gets closer (goal gradient; grade B), and even illusory head-start progress speeds completion. Daily diary data link visible progress in meaningful work to positive inner work life (Amabile's progress principle; grade B–C, correlational). Breaking tasks down helps because it raises expectancy and creates frequent small wins. The app should make progress visible at the subtask level and give a task a head start.

### Cited Findings
- Kivetz, Urminsky & Zheng (2006): coffee-card customers accelerated purchases as they neared a reward. A 12-stamp card with 2 stamps pre-filled was completed faster than an equivalent 10-stamp blank card (illusion of progress) [from prior knowledge; DOI given] — [Kivetz et al. 2006, J. Marketing Research 43(1)](https://doi.org/10.1509/jmkr.43.1.39)
- Amabile & Kramer (2011): diary study of about 12,000 daily entries from 238 knowledge workers across 7 companies. Making progress in meaningful work was the most frequent event on people's best days. The design is observational [from prior knowledge] — [HBR, "The Power of Small Wins"](https://hbr.org/2011/05/the-power-of-small-wins)
- Megastudy evidence (§9): the top gym nudge rewarded *returning after a lapse*, which is consistent with recovery mattering more than raw streak length — [Milkman et al. 2021 summary](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost)

### Inferences
- Design: show subtask progress bars, count the first step as already partly done ("captured + planned = 1/4"), and frame remaining work as "2 steps left" near the end. Proximity framing works best late in a task.
- Offer a "shrink" action that turns a stalled task into a 2–5 minute first step. This rests on TMT expectancy and the goal gradient rather than a direct RCT of to-do apps.

### Gaps
- I did not search for direct experimental tests of "first-step" or "two-minute" interventions on real-world task completion. I know of no meta-analysis on subtasking as an intervention for procrastination.

## 6. Mere urgency effect

### Takeaway
People pick tasks with spurious, short deadlines over objectively more valuable tasks without one (Zhu, Yang & Hsee 2018; five experiments; grade B, single-lab origin). The effect is stronger in people who feel busy and weakens when payoffs are made salient at the moment of choice. An independent replication was published in JCR in September 2026, but I could not read its outcome. A task ranking should weight consequence or importance explicitly and show it at the point of choice, so that due dates alone do not dominate.

### Cited Findings
- Zhu, Yang & Hsee (2018), *Journal of Consumer Research* 45(3). Across five experiments, people chose to do tasks with objectively lower payoffs over higher-payoff tasks when the lower-payoff tasks carried only spurious urgency (an expiration cue). The authors call this a violation of dominance. The effect was stronger for self-perceived busy people, and reminding participants of payoffs at the moment of choice reduced it — [econbiz record](https://econbiz.de/Record/the-mere-urgency-effect-zhu-meng/10011929694); [JHU Hub](https://hub.jhu.edu/2018/05/31/meeting-deadlines-time-management-behaviors)
- "Brief Commentary: An Independent Replication Study of the Mere Urgency Effect," Richard Mills et al., *JCR* advance article, published 18 Sept 2026, DOI 10.1093/jcr/ucag026. The abstract was not displayed, so **its result is unknown** [listing verified this session] — [JCR advance access](https://academic.oup.com/jcr/advance-access)

### Inferences
- Design: rank by an explicit consequence/importance score first and use due dates for hard deadlines only. Avoid artificial urgency cues such as fake due dates or red "today" badges on unimportant items. Show the reason a task matters ("legal, irreversible") next to its title in the queue, since payoff salience at the moment of choice reduced the bias. Cue's impact-based ranking (consequence × magnitude × reversibility) matches this.
- The 2026 replication's outcome should be checked before the report leans heavily on this effect.

### Gaps
- The outcome of the Mills et al. 2026 replication is unknown. I found no field (non-lab) evidence of the mere urgency effect in real task lists.

## 7. Affective forecasting: underpredicting how good doing things feels

### Takeaway
Several well-designed studies find that people underpredict how positive social outreach and exercise will feel. Gratitude letters, talking to strangers and exercise are examples (grade B: a consistent pattern across several studies and labs, with some preregistered follow-ups in the social domain). Because the forecasts predicted willingness to act, an app that records predicted vs actual mood and shows the gap could correct a real barrier.

### Cited Findings
- Kumar & Epley (2018), *Psychological Science* 29(9):1423–1435. Gratitude-letter writers underestimated how happy recipients would be and overestimated how awkward recipients would feel. Willingness to express gratitude correlated with those (mis)predictions. Sources differ on whether there were three or four experiments — [UChicago News](https://news.uchicago.edu/story/people-underestimate-value-sending-letters-appreciation); [Chicago Booth Review](https://www.chicagobooth.edu/review/why-we-underestimate-power-expressing-gratitude)
- Epley & Schroeder (2014): commuters predicted that talking to a stranger would be less pleasant than solitude, but those who talked reported more positive experiences [from prior knowledge; DOI given] — [Epley & Schroeder 2014, JEP: General](https://doi.org/10.1037/a0037323)
- Ruby, Dunn, Perrino, Gillis & Viel (2011), "The invisible benefits of exercise": people underestimated how much they would enjoy exercise. Forecasts were anchored on the unpleasant start of a workout [from prior knowledge; DOI given] — [Ruby et al. 2011, Health Psychology](https://doi.org/10.1037/a0021859)

### Inferences
- Design: for social, health and avoided tasks, ask for a predicted feeling (0–10) at capture and a rating after check-off. Then show the running gap ("You expected 4, it averaged 7"). Cue's predicted_mood field is designed for this. Self-feedback of this kind is a plausible but untested intervention.
- Ordering tasks so that a workout ends on its pleasant part may also matter (Ruby et al.'s mechanism), but this is speculative.

### Gaps
- I did not retrieve meta-analytic estimates of the forecasting gap, or any RCT showing that feeding people their own forecast errors changes later behavior.

## 8. Habit formation vs tasks

### Takeaway
Habits form slowly and variably: a median of about 66 days to reach 95% of the automaticity plateau, with a range of 18–254 days in one small study (Lally et al. 2010; grade B–C, N ≈ 96 with heavy attrition). Habits run on stable context cues rather than on reminders or intentions (Wood & Neal; grade B). Habits and one-off tasks need different app models. A habit needs a consistent cue, tolerance of a missed day, and tracking of automaticity rather than completion. A task needs a plan, a deadline and a consequence.

### Cited Findings
- Lally, van Jaarsveld, Potts & Wardle (2010), *European Journal of Social Psychology* 40:998–1009. Volunteers repeated a self-chosen eating, drinking or exercise behavior daily in the same context. Median time to 95% of the asymptote of automaticity was 66 days (range 18–254), and missing a single opportunity did not materially affect the process [from prior knowledge; DOI given] — [Lally et al. 2010](https://doi.org/10.1002/ejsp.674)
- Wood & Neal (2007), "A new look at habits and the habit–goal interface," *Psychological Review* 114(4): habits are context–response associations cued by stable contexts, largely independent of current goals [from prior knowledge; DOI given] — [Wood & Neal 2007](https://doi.org/10.1037/0033-295X.114.4.843)

### Inferences
- Design: keep habits separate from tasks. Tie each habit to a fixed anchor ("after coffee"), which applies implementation intentions to a context cue. Use "don't miss twice" logic rather than streaks that reset to zero, since one miss doesn't derail formation. Periodically measure automaticity, e.g. with the Self-Report Behavioural Automaticity Index, instead of only counting check-offs. Expect two months or more, and say so to set expectations. Cue's log_automaticity tool and dont_miss_twice flag fit this.

### Gaps
- No larger or preregistered replication of the 66-day figure was found this session. Lally's sample was small and self-selected, and the range is very wide, so 66 days should be presented as a rough median, not a rule.

## 9. Fresh starts, temptation bundling, commitment devices, and the 2021 gym megastudy

### Takeaway
- **Fresh starts**: motivation proxies rise after temporal landmarks such as a new week, month, year or birthday (Dai, Milkman & Riis 2014; grade B, largely observational). One RCT using fresh-start framing for medication adherence was null.
- **Temptation bundling**: a large follow-up with N = 6,792 found 10–14% more weekly workouts when people got audiobooks and were encouraged to bundle (grade B). Most of the effect came from the audiobooks themselves rather than the encouragement.
- **Megastudy**: 45% of 54 nudges raised gym visits by 9–27% during the program, but only about 8% produced effects that lasted after it ended. Expert forecasters could not predict which nudges would work (grade A for the method, which compares many nudges on one population). The top nudge rewarded returning after a missed workout.

### Cited Findings
- Dai, Milkman & Riis (2014), *Management Science* 60(10). Google searches for "diet", gym visits, and goal commitments on a commitment website all increased after temporal landmarks (new week, month, year, semester, birthday, holidays) — [INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/mnsc.2014.1901); [Wharton PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)
- A randomized trial of medication reminders found no significant adherence advantage from birthday or New Year timing or framing over 90 days. This is reported in secondary summaries and needs checking against the primary paper — [The Behavioral Scientist glossary](https://www.thebehavioralscientist.com/glossary/fresh-start-effect)
- Milkman, Minson & Volpp (2014), *Management Science* 60(2):283–299, N = 226. Gym-only access to tempting audiobooks initially raised gym visits, but the effect declined over time (notably after Thanksgiving). Afterwards, 61% of participants chose to pay for gym-only audiobook access, which suggests demand for this kind of commitment device — [PMC4381662](https://pmc.ncbi.nlm.nih.gov/articles/PMC4381662/); [RePEc](https://econpapers.repec.org/RePEc:inm:ormnsc:v:60:y:2014:i:2:p:283-299)
- Kirgios et al. (2020), *OBHDP* 161 ("Teaching temptation bundling to boost exercise"), N = 6,792 in a 4-week program. Audiobooks plus encouragement to bundle raised the likelihood of a weekly workout by 10–14%. Encouragement added only a modest effect over giving audiobooks alone — [RePEc](https://econpapers.repec.org/RePEc:eee:jobhdp:v:161:y:2020:i:s:p:20-35)
- Milkman et al. (2021), *Nature*, "Megastudies improve the impact of applied behavioural science." About 61,000 24 Hour Fitness members, 54 four-week digital programs designed by 30 scientists. 45% of programs significantly raised weekly gym visits, by 9–27%. The top performer gave microrewards (bonus points) for returning after a missed workout. Only 8% of interventions had measurable effects after the four weeks, and impartial forecasters did not predict which would work — [Caltech record](https://authors.library.caltech.edu/records/mys88-cc756); [Scimex](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost); [BCFG](https://bcfg.wharton.upenn.edu/?p=2660)

### Inferences
- Design:
  - **Fresh starts**: offer weekly or monthly "fresh start" reviews at landmarks (Monday, the 1st, a birthday) for re-committing to stalled goals and clearing stale tasks.
  - **Lapses**: build a "welcome back" or recovery nudge after a missed habit day. This was the megastudy's top performer, and it sits better with Wohl et al. than streak-loss punishment does.
  - **Temptation bundling**: suggest pairing aversive tasks with a pleasure that the user saves for that task, such as a podcast only during admin.
  - **Durability**: expect novelty effects to fade. Most nudges stopped working when the program ended, so the app should rely on durable structure (habits, context cues) rather than escalating nudges.
- The megastudy's forecasting failure argues for self-experimentation inside a personal app: try a nudge, track whether completion rates change, and keep only what works for this user.

### Gaps
- No search this session on commitment-device meta-analyses (e.g., stickK, deposit contracts) or on the sustained effects of temptation bundling beyond the program period. The reported effect sizes for the individual megastudy arms were not retrieved.

## 10. Decision fatigue, ego depletion, and choice overload around long lists

### Takeaway
Ego depletion, the theory that willpower is a limited resource drained by use, failed two large preregistered multisite replications (Hagger et al. 2016: d ≈ 0.04; Vohs et al. 2021: d = 0.06, with Bayes factors favoring the null; grade X). Decision-fatigue arguments built on it should not drive design. Choice overload is real but conditional (grade B): Scheibehenne et al. 2010 found a near-zero mean effect, while Chernev et al. 2015 found it under specific moderators (complex sets, hard decisions, uncertain preferences, effort-minimizing goals), and a reanalysis contests even that. The case for showing a short "next few" queue rests on choice-overload moderators and on decision effort, not on depletion.

### Cited Findings
- Vohs et al. (2021), *Psychological Science* 32(10):1566–1581: a preregistered multisite "paradigmatic" replication, 36 labs, N = 3,531. The confirmatory effect was d = 0.06 (not significant). Bayesian meta-analyses found the data about 4 times more likely under the null. The exploratory full-sample effect was d = 0.08, larger in people reporting more fatigue — [PubMed 34520296](https://pubmed.ncbi.nlm.nih.gov/34520296/)
- Earlier challenges: Carter et al. (2015) meta-analysis and Hagger et al. (2016) registered replication report, with 23 labs, N ≈ 2,141 and d ≈ 0.04. The Hagger lab and N figures are from prior knowledge — [Vohs et al. 2021 PDF (context section)](https://carlsonschool.umn.edu/sites/carlsonschool.umn.edu/files/2026-01/vohs-et-al-2021-psci-ego-depletion.pdf); [Hagger et al. 2016 DOI](https://doi.org/10.1177/1745691616652873)
- Scheibehenne, Greifeneder & Todd (2010) meta-analysis: near-zero mean choice-overload effect across studies — [econbiz record](https://www.econbiz.de/Record/can-there-ever-be-too-many-options-a-meta-analytic-review-of-choice-overload-scheibehenne-benjamin/10008756224)
- Chernev, Böckenholt & Goodman (2015), *J. Consumer Psychology* 25(2):333–358: 99 observations, N = 7,202. Choice overload appears when choice-set complexity, decision-task difficulty, preference uncertainty and an effort-minimizing goal are high. Satisfaction, regret, deferral and switching are interchangeable measures of the effect. McShane & Böckenholt (2018) reanalyzed the same data and found the effect reversed at low moderator levels for some outcomes and absent for others — [Kellogg page](https://www.kellogg.northwestern.edu/faculty/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual); [Frontiers 2022 discussion](https://www.frontiersin.org/articles/10.3389/fpsyg.2022.800528)

### Inferences
- A long, undifferentiated task list is a "hard decision with uncertain preferences" set, which is the condition where choice overload, and specifically **choice deferral**, is most likely. Deferral is the procrastination-relevant outcome.
- Design: default to a ranked short queue (the top 3–5 items, or a single "do this next") with the full list one tap away. Pre-rank so the user isn't comparing dozens of items.
- Don't justify features with "willpower runs out by evening" claims. Time-of-day scheduling can still be justified by actual fatigue or energy data from the user's own history.

### Gaps
- I did not retrieve the pooled effect size for Chernev 2015 (one blog's d ≈ 0.5–0.6 under high moderators is unverified). I found no studies on choice overload in to-do lists specifically.
- The parole-judges "decision fatigue" study (Danziger et al. 2011) and its critiques were not reviewed this session.
