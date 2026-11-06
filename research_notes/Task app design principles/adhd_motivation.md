# Executive-function-friendly (ADHD-informed) design and motivation mechanics for task apps

Evidence grades used below: **[MA]** meta-analysis or systematic review; **[RCT]** randomized controlled trial; **[EXP]** lab or field experiment, not clinical; **[OBS]** archival or observational data; **[QUAL]** qualitative/HCI interviews; **[IND]** industry A/B test or company data, not peer reviewed; **[PRAC]** practitioner consensus or popular summary. The research was done November 2026. Many search results were blog or AI-generated summaries, and those are flagged wherever they were the only source.

## 1. ADHD and executive function: point of performance, time blindness, externalized working memory, and what CBT programs prescribe

### Takeaway
Barkley's model treats ADHD as a problem of *doing* what one knows, not of *knowing*. Help therefore has to sit at the place and moment the task is done: cues outside the head, time made visible, and incentives that arrive immediately. The two best-tested adult psychosocial programs (Safren's CBT, Solanto's MCT) both make a structured system their first or central module: one calendar plus one task list, everything kept in one place, large tasks broken into manageable steps, A/B prioritization, and daily review practice. Both beat active controls in RCTs.

### Cited Findings
- **[PRAC, secondary summaries of Barkley]** ADHD is described as "a performance disorder, not a knowledge disorder. You know what to do, but you cannot perform what you know." The prescribed response is scaffolding at the point of performance, not more teaching, and tips that only add knowledge tend to fail. — [Akiflow summary of Barkley method](https://akiflow.com/blog/barkley-method-help-adhd); [Simply Psychology, "Future blindness"](https://www.simplypsychology.org/adhd-future-blindness.html)
- **[PRAC]** Barkley-derived guidance on externalizing: put reminders outside the brain (planners, checklists, digital task systems). For time, make it physical and visible with clocks, timers and watches, because time blindness makes durations and elapsed time hard to judge. — [Simply Psychology](https://www.simplypsychology.org/adhd-future-blindness.html); [Akiflow](https://akiflow.com/blog/barkley-method-help-adhd)
- **[PRAC]** In Barkley's account, motivation is a timing problem: the ADHD brain weights the immediate over the distant, so motivation needs immediate, tangible incentives. — [Simply Psychology](https://www.simplypsychology.org/adhd-future-blindness.html)
- **[MA]** Supporting evidence for the immediacy principle: Marx et al. (2018) pooled 37 group comparisons (N = 3,763, mixed ages) and found that ADHD groups choose more impulsively (steeper delay aversion), and the effect was stronger with real rather than hypothetical rewards. A 2023 review notes that adults with ADHD keep higher delay-discounting rates. — [Marx et al. 2018 record](https://www.peeref.com/works/5447080); [PMC review 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10070913/)
- **[RCT] Safren et al. (JAMA 2010):** 86 adults already medicated but still symptomatic were randomized to 12 sessions of CBT or to relaxation plus educational support. The CBT group was about 4 times more likely to respond (about 67% vs 33% response reported in press coverage). — [Dr Sharma summary](https://www.drsharma.ca/?p=5352); [ABC7 coverage](https://abc7ny.com/archive/7627381/)
- **[Manual] Safren's "Mastering Your Adult ADHD" (2nd ed., 2017):** The first module is psychoeducation plus organizing and planning. Its content is "use of calendar and task list system", called "cornerstones of staying organized", together with problem-solving training. Later modules cover distractibility, cognitive restructuring, and optional procrastination and significant-other modules. — [OUP workbook chapter](https://academic.oup.com/book/1239/chapter/140165437); [CHADD article](https://chadd.org/attention-article/mastering-your-adult-adhd/)
- **[PRAC/clinical training] MGH (Henin) CBT slides:** Agree on a single calendar system and consolidate everything in one place. For large tasks, list the steps and make sure each step is manageable. Rank items and finish "A" items before "B" items. — [MGH CME slides 2026](https://mghcme.org/app/uploads/2026/02/Henin-CBT-and-Psychosocial.pdf); [2021 slides](https://mghcme.org/app/uploads/2021/03/Henin-CBT-ADHD-talk-2021.pdf)
- **[RCT] Solanto et al. (Am J Psychiatry 2010; 167:958–968):** 88 adults received a 12-week manualized group meta-cognitive therapy targeting time management, organization and planning, compared against supportive psychotherapy that matched nonspecific factors. Significantly more MCT participants improved, by self-report, collateral report and a blind evaluator. Dropout was about 11–12% in both arms. Inattention improvement tracked the number of home exercises completed. COI: the author had pharma advisory and consulting ties. — [Psychiatry Online abstract](https://psychiatryonline.org/doi/abs/10.1176/appi.ajp.2009.09081123); [ScienceDaily](https://www.sciencedaily.com/releases/2010/03/100330142437.htm); [Cochrane table](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494390/table/CD010840-tblf-0012)

### Inferences
- Design translation of "point of performance": the cue should appear where and when the action happens (a notification at the right moment, a home-screen widget, the next step showing on the lock screen). An item stored away to be checked later does little.
- The clinical programs converge on **one trusted capture place, one list plus a calendar, daily review, decomposition into manageable steps, and simple priority tiers**. That supports an app that is the single source of truth, has a lightweight daily planning ritual, and has built-in task shrinking.
- The immediacy and delay-aversion evidence supports *immediate* feedback on completion (micro-rewards, visible progress). As section 4 shows, the form of that feedback matters.
- The MCT result that benefit scales with home practice suggests the app should make the daily practice itself (review, planning) as cheap as possible to repeat.

### Gaps
- I could not reach Barkley's primary texts (e.g., *ADHD and the Nature of Self-Control*). The point-of-performance wording above comes from secondary summaries. One wiki-style critique calls the concept elastic and close to unfalsifiable ([austin-wiki](https://austin-wiki.pages.dev/concepts/boole-learn-barkley-adhd/)).
- I did not verify specific MCT techniques (e.g., Solanto's planner rules, "make it smaller" phrasing, the "if it's not in the planner it doesn't exist" maxim) against the manual.
- I found no RCT that isolates the task-system module from the other CBT components.

## 2. HCI research on ADHD and productivity tools

### Takeaway
HCI work increasingly treats ADHD task trouble as a mismatch between tools and how attention works, not as a willpower deficit. Interview studies find that adults with ADHD manage tasks *relationally and emotionally* (other people, co-regulation), while mainstream tools assume steady self-regulation and linear time. Peer-reviewed evaluations of named consumer apps (Tiimo, Goblin Tools, Structured, Inflow) are essentially absent.

### Cited Findings
- **[QUAL] Chen, Meng & Nie, "Not Just Me and My To-Do List" (arXiv 2026, accepted CSCW 2026):** 22 semi-structured interviews with adults who identify as ADHD, plus a speed-dating study with 20 more participants covering 13 speculative AI concepts. Task management is "relationally and affectively co-constructed, rather than an isolated individual act". Existing tools assume consistent self-regulation and linear time. Implications: AI that is socially aware and supports co-regulation, and tools that accommodate nonlinear attention rhythms. — [arXiv 2603.17258](https://arxiv.org/abs/2603.17258)
- **[Review] Spiel, Hornecker, Williams & Good, "ADHD and Technology Research – Investigated by Neurodivergent Readers" (CHI '22):** A critical review of ADHD technology research by neurodivergent readers. It also cites Cibrian et al.'s overview of self-regulation technologies for children with ADHD. — [Typeset PDF](https://typeset.io/pdf/adhd-and-technology-research-investigated-by-neurodivergent-5i3o69ux.pdf)
- **[QUAL] Psychoeducational app for adults with ADHD (Ireland):** Analytics plus 14 user interviews, analysed with reflexive thematic analysis. Adults newly diagnosed benefited significantly, while adults already familiar with their ADHD wanted something different. — [DOAJ record](https://library.kab.ac.ug/Record/doaj-art-64178dcc0ebe43bd879a5adfadf11792/Description)
- **[PRAC/marketing, low reliability]** Commercial roundups say Tiimo's visual, color-coded schedules and AI task breakdown won it Apple's 2025 App of the Year, with "relief" as a common review theme. They say Structured turns lists into a visual timeline and automatically reshuffles missed tasks, and that Goblin Tools does AI task breakdown. — [habi.app roundup](https://habi.app/insights/best-adhd-planner-apps/); [DEV community](https://dev.to/betzy_flores_1b008f235189/best-productivity-apps-for-adults-with-adhd-well-tested-12al)

### Inferences
- Recurring design themes in the HCI and practitioner material: visual time (timelines rather than bare lists), automatic rescheduling of missed items instead of piles of failures, AI decomposition for tasks the person can't start, and social or co-regulation features.
- Since newly diagnosed and experienced users want different things (Ireland study), configurable depth or progressive disclosure is likely better than a single fixed regimen.

### Gaps
- I found no peer-reviewed controlled evaluation of Tiimo, Goblin Tools, Structured or Inflow.
- I could not locate the specific Cibrian/Lakes adult productivity papers in this pass. Cibrian's work is mostly on children and self-regulation wearables.
- I did not retrieve the full text of the CSCW paper, so I can't report which AI concepts participants preferred.

## 3. Body doubling and accountability

### Takeaway
Body doubling has strong community endorsement but weak, mixed controlled evidence. No peer-reviewed controlled trial in adults with ADHD was found, and Focusmate's numbers are company-run self-report. It should be an optional feature, not a core mechanic.

### Cited Findings
- **[QUAL/EXP, small]** A 2025 VR body-doubling paper states that no peer-reviewed controlled trials have examined body doubling's impact on adults with ADHD. Its own study compared alone, human and AI body doubles with 12 adults with ADHD. — [arXiv 2509.12153](https://arxiv.org/html/2509.12153v1)
- **[EXP, small]** A Drake University EEG study (2025, n = 26, conference poster) found no significant effect of body doubling on performance, focus or calm. — [CCSC Central Plains 2025 poster](https://www.ccsc.org/centralplains/2025/talks/talk-poster16/)
- **[OBS survey]** An Appalachian State survey across seven campuses found that some students with ADHD preferred working with someone else, but the performance boost was small and they did not seek it out more than peers without ADHD. The researcher warned that some people with ADHD may do *worse* with a body double than alone with distractions reduced. — [Popular Science](https://www.popsci.com/health/body-doubling-focus-benefits/)
- **[IND]** Focusmate reports a "161% increase in productivity" among neurodivergent members (842 active members) and 152% in a survey of 212 ADHD users. Both are self-reported, company-run and not peer reviewed. — [Focusmate media kit](https://www.focusmate.com/?p=3865)
- **[PRAC]** CHADD notes that Focusmate isn't designed for ADHD specifically, that some experts find it helps, and that body doubling "doesn't work for everyone." — [CHADD](https://chadd.org/attention-article/focusmate-virtual-coworking)

### Inferences
- A single-user app can approximate the active ingredients cheaply: a visible "someone is with you" presence, check-in or out statements of intent, or an AI co-working prompt. Given the evidence, these should be opt-in and tested on the user rather than assumed.
- The CSCW interview finding (section 2) that ADHD task management is relational is the strongest qualitative support for social scaffolds.

### Gaps
- I found no peer-reviewed Focusmate study and no RCT of social commitment devices specifically in ADHD.
- I did not retrieve the VR study's outcome results.

## 4. Gamification, streaks and rewards

### Takeaway
Gamification has small-to-medium positive average effects, but they are fragile: motivational and behavioral effects are less robust than cognitive ones in rigorous studies, and results are heavily mixed. Streaks reliably drive engagement *while intact*, but the streak becomes a goal in itself, and a broken streak lowers subsequent engagement, especially when people blame themselves. Two things soften the cliff: designs that let people repair streaks or build in "emergency reserves", and lowering the bar for what counts as a day. Tangible, expected rewards can undermine intrinsic motivation. Positive informational feedback enhances it.

### Cited Findings
- **[MA] Sailer & Homner (2020), Educational Psychology Review 32:77–112:** Gamification had positive effects on learning. The cognitive effect was stable among high-rigor studies, but motivational and behavioral effects "were less stable". Game fiction and social interaction moderated behavioral outcomes, and competition combined with collaboration helped. (A secondary source reports cognitive g ≈ .49. I could not verify this or the per-outcome figures. Commonly quoted values are cognitive g = .49, motivational g = .36, behavioral g = .25, to check against the paper.) — [Augsburg repository PDF](https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf); [Springer](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- **[Systematic review] Koivisto & Hamari (2019), Int J Information Management 45:191–210:** 819 studies reviewed. Results "lean toward positive" but "the amount of mixed results is notable". The field lacks coherent models and theory. Points, badges and leaderboards were the most common mechanics. — [Trepo PDF](https://trepo.tuni.fi/bitstream/10024/115953/2/the_rise_of_motivational_2019.pdf); [Tampere summary](https://webpages.tuni.fi/gamification/2019/06/24/the-rise-of-motivational-information-systems-a-review-of-gamification-research/)
- **[EXP, 7 studies] Silverman & Barasch (2023), J Consumer Research 49(6):1095–1117:** Intact streaks highlighted in behavioral logs increase subsequent engagement compared with broken streaks. The effect depends on how the log *represents* the behavior, regardless of actual past behavior, because consumers treat the streak as a goal in itself. The demotivating effect of a broken streak is stronger when people blame themselves, and weaker when the streak can be "repaired". — [UDel repository](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb/full)
- **[PRAC + classic EXP]** The "what-the-hell" (abstinence-violation-like) effect from Polivy & Herman's dieting research: a small lapse cascades into full abandonment. This came via secondary summaries, and I did not retrieve the primary paper. — [UDel paper context](https://udspace.udel.edu/bitstreams/7e3e3b64-8bf2-4527-ac93-94a160358165/download)
- **[EXP, field + 4 lab] Sharif & Shu (2021), OBHDP 163:17–29, "Nudging persistence after failure through emergency reserves":** Framing a goal with allowed skips (e.g., a 7-day goal with 2 emergency reserves) is a cost-free nudge. In a step challenge (n > 270), people who missed and used a reserve were more likely to persist the next day, took up to 20% more steps, and met their goal on up to 40% more days. The mechanism is greater perceived progress, which raises commitment. An earlier paper in JMR (2017) reported similar results. Counterpoint: a small Utrecht student-thesis replication in diet (n = 11 per arm) found no effect. — [UCLA Anderson Review](https://anderson-review.ucla.edu/emergency-reserves/); [paper PDF](https://anderson-review.ucla.edu/wp-content/uploads/2021/03/Sharif-Shu_EmergencyReserveFailure_OBHDP2019.pdf); [Utrecht thesis](https://studenttheses.uu.nl/handle/20.500.12932/44466)
- **[PRAC, advice]** Milkman-derived advice: use "emergency reserves" or slack with a psychological cost, so a small lapse doesn't become a big one, and accept two of three planned gym days. — [Pattern Health/Forbes](https://pattern.health/?p=2548)
- **[IND] Duolingo:** Learners at a 7-day streak are 2.4x more likely to return the next day. Decoupling the streak from the daily goal, so one lesson extends the streak, gave +3.3% D14 retention, +1% DAU, and +10.5% of daily learners on a streak (+19% for new learners). The share with 7+ day streaks rose from about a third to just over half. The trade-off was that fewer learners hit their full daily goal. — [Duolingo blog: Improving the streak](https://blog.duolingo.com/improving-the-streak)
- **[IND]** Duolingo's Streak Freeze lets the user "pause your streak for a day", and up to two can be equipped. A third party claims the streak wager lifted retention by 14%, but sources disagree on whether that was D7 or D14, so it is unverified. — [Duolingo blog: How the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit); [Lenny's podcast summary](https://podcasts-distilled-hugo-content.pages.dev/lennys-podcast-product-career-growth/behind-the-product-duolingo-streaks-jackson-shuttleworth-group-pm-retention-team/)
- **[PRAC/critical]** Some long-streak users describe a sense of obligation and anxiety and deliberately abandon very long streaks. These are anecdotal accounts. — [Android Authority](https://www.androidauthority.com/reasons-give-up-duolingo-streak-3543009); [Clozemaster forum, argument against freezes](https://forum.clozemaster.com/t/an-argument-against-streak-freezes/48429)
- **[MA] Deci, Koestner & Ryan (1999), Psychological Bulletin 125(6):627–668, 128 studies:** Tangible, expected and performance-contingent rewards significantly undermined free-choice intrinsic motivation (reported ds −0.28 to −0.40). Engagement- and completion-contingent rewards undermined self-reported interest (d = −0.15, −0.17). **Positive feedback enhanced** free-choice behavior (d = 0.33) and interest (d = 0.31). Cameron & Pierce dispute the size of the undermining effect. — [UBalt PDF](https://home.ubalt.edu/ntygmitc/642/Articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf); [UW PDF](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf)

### Inferences
- For a user with inconsistent motivation, a hard streak is a high-variance mechanic. It gives a lift while it lasts and a cliff when it breaks, and the cliff is worst under self-blame, which is common in ADHD. The evidence favors **forgiving streaks**: a low bar for a day to count (Duolingo), built-in reserves or skips (Sharif & Shu), repair or earn-back (Silverman & Barasch), and "don't miss twice" framing, which is effectively a one-day reserve.
- Reward design should lean on **informational, positive feedback** (what you did, progress made) over tangible, contingent payouts (points to exchange). This fits the DKR meta-analysis and the delay-aversion evidence that feedback should be immediate.
- Overjustification risk is mainly for activities that are already intrinsically enjoyed. Rewards attached to aversive chores are less risky.

### Gaps
- I could not verify the per-outcome effect sizes in Sailer & Homner from the full text, or a novelty-effect (decay over time) finding in the reviews.
- I found no peer-reviewed study of streak mechanics specifically in ADHD populations, and no published Duolingo data on how streak loss affects churn.
- Blog statistics such as "63% more likely to quit after a miss (2020 CHI study)" could not be traced to a source and were excluded.
- I did not retrieve Lally et al. (2010) on missed days and habit formation. The claim that one missed day doesn't materially derail habit formation is widely repeated but unverified here.

## 5. Shame, guilt, overdue piles, self-compassion and fresh starts

### Takeaway
Direct experimental evidence on red overdue counters is missing. The adjacent evidence consistently points the same way: self-blame after a lapse amplifies disengagement (streak research), self-forgiveness predicts *less* future procrastination, self-compassion is moderately and negatively associated with procrastination, and temporal landmarks ("fresh starts") spontaneously boost goal pursuit. This supports rollover or reset designs over accumulating failure piles.

### Cited Findings
- **[OBS longitudinal] Wohl, Pychyl & Bennett (2010), Personality and Individual Differences 48(7):803–808:** Among students (n ≈ 119–134, sources disagree), forgiving oneself for procrastinating on the first exam predicted less procrastination on the second. The effect appeared mainly among heavy procrastinators and was mediated by reduced negative affect. All measures were self-report. — [BPS Research Digest](https://bps.org.uk/research-digest/cure-procrastination-forgive-yourself); [Psychology Today (Pychyl)](https://www.psychologytoday.com/us/blog/dont-delay/200903/self-forgiveness-reduces-procrastination)
- **[OBS] 2019 replication-style study:** In 217 university students, self-forgiveness was associated with lower procrastination, mediated by positive emotions. — [Springer, Current Psychology](https://link.springer.com/article/10.1007/s12144-018-9926-3)
- **[Mini-MA of own samples] Sirois (2014), Self and Identity:** Across four samples, self-compassion had a moderate negative association with procrastination, and self-compassion mediated the stress–procrastination link. — [White Rose eprint](https://eprints.whiterose.ac.uk/91791/1/Procrastination%20and%20self%20compassion%20rev2%20FINAL.pdf)
- **[EXP] Silverman & Barasch (2023):** The demotivating effect of a broken streak is stronger when people attribute the break to themselves. — [UDel](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb/full)
- **[OBS archival] Dai, Milkman & Riis (2014), Management Science, "The Fresh Start Effect":** Google searches for "diet", university gym visits and stickK commitment contracts all rise after temporal landmarks (start of a week, month or year, birthdays). Gym attendance declines over the course of each month and year. The authors describe the evidence on mechanism as imperfect. — [Penn CHIBE](https://chibe.upenn.edu/publications/the-fresh-start-effect-breaking-points-in-life-motivate-virtuous-behavior/)
- **[PRAC]** Commercial ADHD planners such as Structured auto-reshuffle missed tasks "reducing the cognitive load of manual replanning", and Tiimo users describe it as the first planner that "didn't make them feel broken". These are marketing-adjacent sources. — [habi.app](https://habi.app/insights/best-adhd-planner-apps/)
- **[QUAL]** The CSCW 2026 interview study frames ADHD task trouble as a tool mismatch, not a willpower deficit, and describes task management as "affectively co-constructed". — [arXiv 2603.17258](https://arxiv.org/abs/2603.17258)

### Inferences
- An ever-growing red overdue count encourages self-blame, and self-blame is the condition under which lapses most damage future engagement. Better designs: quietly roll unfinished items forward, cap or hide overdue counts, distinguish real hard deadlines from soft intentions, let items expire gracefully, and offer explicit "fresh start" moments (new day, Monday, new month) to re-triage.
- Copy should use non-judgmental, self-compassionate framing ("pick back up", not "you missed 12 tasks").

### Gaps
- I found no RCT or A/B test isolating the effect of overdue-counter visibility or red failure framing in task apps.
- I found no broad meta-analysis of self-compassion and procrastination, and no RCT of self-compassion interventions on task completion in ADHD.

## 6. Pomodoro and focus timers

### Takeaway
The best direct test (Biwer et al. 2023) found that fixed, systematic breaks (Pomodoro-style 24/6 or 12/3) gave lower fatigue and distractedness and higher concentration and motivation than self-regulated breaks. Self-regulators studied and rested longer. It was a single-day study with small samples, and evidence specifically in ADHD is absent.

### Cited Findings
- **[EXP, randomized] Biwer, Wiradhany, oude Egbrink & de Bruin (2023), British Journal of Educational Psychology:** Students in real self-study were assigned to self-regulated breaks (n = 35), systematic 24-minute work / 6-minute break (n = 25), or systematic 12/3 (n = 27). Self-regulated students had longer study sessions and longer breaks, which was associated with higher fatigue and distractedness and lower concentration and motivation than in the systematic conditions. Limitations: 87 students total, one day. — [Maastricht CRIS](https://cris.maastrichtuniversity.nl/en/publications/understanding-effort-regulation-comparing-pomodoro-breaks-and-sel); [PubMed 36859717](https://pubmed.ncbi.nlm.nih.gov/36859717/)
- **Conflict note:** A later citing paper words the result the other way round, saying systematic breaks gave *lower* concentration and motivation. The original abstract wording above (via Maastricht) is the authoritative version, and the citing paper appears to be a mis-citation. Some blogs also misstate the interval as 25 minutes. — [PMC12292963](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292963/)

### Inferences
- An externally paced timer fits the point-of-performance logic: the break decision is outsourced, so self-regulation isn't spent on it. It also makes time visible, which addresses time blindness. A focus timer with fixed default intervals is reasonably supported, and the exact 25/5 length seems unimportant (12/3 also worked).

### Gaps
- I found no RCT of Pomodoro in adults with ADHD.
- I did not confirm from full text whether task completion or output differed between conditions.

## 7. Choice reduction: one next task vs a full list

### Takeaway
No study directly compares "show one next task" with "show the full list" in task apps. Indirect support comes from the choice-overload meta-analysis: overload is real but conditional, and it is larger when tasks are hard, options are complex, preferences are uncertain, and the decider wants to minimize effort. Those conditions describe a depleted ADHD user facing a long backlog. The clinical programs' A/B prioritization (do A items first) is a practical version of choice reduction.

### Cited Findings
- **[MA] Chernev, Böckenholt & Goodman (2015), J Consumer Psychology 25(2):333–358:** 99 observations, N = 7,202. Assortment size significantly increases choice overload once four moderators are accounted for: decision task difficulty, choice set complexity, preference uncertainty, and an effort-minimizing goal. Higher levels of each increase overload. Satisfaction or confidence, regret, choice *deferral* and switching are interchangeable measures. — [Kellogg](https://www.kellogg.northwestern.edu/faculty/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual); [record](https://www.bohrium.com/paper-details/choice-overload-a-conceptual-review-and-meta-analysis/814702993403281408-7309)
- **[MA, contrary] Scheibehenne, Greifeneder & Todd (2010):** The mean effect of choice overload is virtually zero, with high variance between studies. — [EconBiz](https://www.econbiz.de/Record/can-there-ever-be-too-many-options-a-meta-analytic-review-of-choice-overload-scheibehenne-benjamin/10008756224); [reply PDF](https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.reply.2011.pdf)
- **[Manual/PRAC]** CBT for adult ADHD ranks tasks and completes "A" items before "B" items. — [MGH slides](https://mghcme.org/app/uploads/2026/02/Henin-CBT-and-Psychosocial.pdf)

### Inferences
- "Choice deferral" as an overload outcome maps directly onto procrastination. A default single "do next" item, with the full list one tap away, is a reasonable inference from the moderator findings. The user's state (low energy, high uncertainty) is exactly where the moderators predict overload.
- Keep the escape hatch: forcing one item removes autonomy, and SDT evidence links autonomy to motivation.

### Gaps
- I found no experimental or HCI study of single next-task interfaces versus lists, in ADHD or general populations.

## 8. Energy- and mood-aware scheduling, low-energy task menus

### Takeaway
I found no peer-reviewed evidence on energy-aware task scheduling or "low-energy menus" in task apps. The idea rests on practitioner consensus and on the HCI call to accommodate nonlinear attention rhythms. The fresh-start evidence shows that motivation fluctuates with temporal context.

### Cited Findings
- **[QUAL]** Tools should "accommodate nonlinear attention rhythms" rather than assume linear time and consistent self-regulation. — [arXiv 2603.17258](https://arxiv.org/abs/2603.17258)
- **[OBS]** Goal-directed behavior rises at temporal landmarks and decays across months and years, so motivation is not constant. — [Penn CHIBE, Fresh Start Effect](https://chibe.upenn.edu/publications/the-fresh-start-effect-breaking-points-in-life-motivate-virtuous-behavior/)
- **[IND]** Duolingo's lowered minimum (one lesson counts) raised habit formation and aggregate time even though fewer people met their full goal. This is evidence that a low-effort "minimum viable day" option increases consistency. — [Duolingo blog](https://blog.duolingo.com/improving-the-streak)

### Inferences
- Tagging tasks by effort or focus level and offering a low-energy subset on bad days is consistent with the choice-overload moderators (an effort-minimizing goal) and with the "lower the bar" streak data. It should be treated as a plausible practitioner pattern, not an evidence-backed intervention.

### Gaps
- I found no studies on energy- or mood-matched task selection, spoon theory in apps, or behavioral activation's activity scheduling applied to ADHD task apps. Behavioral activation literature for depression (activity scheduling, mood monitoring) is the nearest evidence base and was not searched in this pass.
- I did not search ADDitude or CHADD for practitioner consensus on energy-based planning.
