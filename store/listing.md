# Cue: Chrome Web Store listing

## Store listing tab
Description:
New tab shows your next action from Cue, with Done, Not now and quick capture. Sites you list (YouTube, Reddit, X and others) open only through Unlock: type what you're opening it for, wait 20 seconds, then get 5 or 15 minutes. When the time's up the tab goes back to Unlock. Once locked, removing a site or turning the gate off takes 24 hours. Built for one person's own Cue app; it needs a Cue key to show tasks.

Category: Productivity
Language: English
Store icon: icon.png from the zip (128x128)
Screenshots: screenshot-newtab.png, screenshot-unlock.png
Small promo tile: promo-440x280.png
Homepage URL: https://nick-cue.vercel.app
Support URL: https://github.com/nickcorona/cue

## Privacy tab
Single purpose:
Keep the user on their own next action: the new tab shows their Cue task, and sites they list open only after a stated reason and a short wait.

Permission justifications:
- storage: Saves the user's list of gated sites, their unlock time boxes and reasons, and their Cue key, locally.
- tabs: Reads a tab's address to see if it's a gated site, and sends it to the Unlock page or back to it when its time box ends.
- webNavigation: Catches navigation to a gated site before it loads, so it can open Unlock instead.
- alarms: Ends each unlock's time box on time and checks pending 24-hour changes once a minute.
- Host permission (nick-cue.vercel.app): The user's own Cue server, for showing their next task, capture, and logging unlocks.

Remote code: No, I am not using remote code.

Data usage, tick:
- Authentication information (the Cue key)
- Web history (only the gated site's domain, sent with an unlock)
Then tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).

Privacy policy URL: https://nick-cue.vercel.app/privacy

## Distribution tab
Payments: Free of charge
Visibility: Unlisted
Regions: All regions
