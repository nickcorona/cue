# Cue

Personal task, habit and routine manager that lives behind a Claude connector. The repo and Vercel project are still called `nick-tasks`. Both `https://nick-cue.vercel.app` and `https://nick-tasks.vercel.app` serve it (and the `-nickcoronas-projects` URL); sign-in cookies are per domain.

- `api/mcp.js`: MCP server (Streamable HTTP, stateless JSON). Auth is a secret path segment (`/mcp/<APP_KEY>`), or on `/mcp` a bearer token: the APP_KEY itself or an OAuth access token.
- `api/oauth.js`, `lib/oauth.js`: stateless OAuth 2.1 (discovery, dynamic client registration, PKCE) for clients that need it, e.g. Meta Muse. The consent page asks for the APP_KEY, or just Allow on a signed-in device. Tokens are HMAC-signed from APP_KEY, so rotating it revokes them.
- `api/web.js`: web view. `/app/<APP_KEY>` signs a device in (1-year cookie) and redirects; after that `/` is the full queue and `/w` the compact widget view. Also serves the PWA manifest and service worker.
- `lib/tools.js`: tool definitions, server instructions, handlers.
- `lib/logic.js`: ranking (Apparent Tardiness Cost with Smith's-rule baseline), planning-fallacy correction, habit and routine status.
- `lib/ui.js`: the queue UI, served both as an MCP App (`ui://nick-tasks/queue.html`, rendered inline in Claude by `show_queue`) and as the web view.
- `lib/views.js`: the plan-my-day (`show_plan`) and weekly-review triage (`show_review`) cards, MCP Apps only. The plan card sends the approved plan back to the chat for Claude to put on the calendar; the triage card applies decisions itself.
- Daily sweep (first read each local day, in `lib/tools.js`): drops tasks past `expires`, counts strikes for tasks left untouched in the top 10, parks stale wishes, and turns overdue waits into `who=claude` follow-ups. Routine ticks are keyed by step id.
- `lib/calendar.js`: busy time from Google Calendar's secret iCal address(es) in env `CALENDAR_ICS_URL` (comma-separated). Only events inside `personal_hours` count, minus Cue's own plan/routine events; that day's task capacity drops by the busy minutes.
- `lib/push.js`, `api/push.js`, `api/push-fire.js`: phone notifications (web push). Each ping is a Vercel Queue message delayed to its exact time; on delivery it re-checks the ping still applies before pushing. The installed app's "Turn on notifications" button subscribes the device. Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- `lib/lift.js`, `lib/liftui.js`: Cue Lift at `/lift`. Programs attached to lift habits, sessions with every set, double-progression targets, PRs, weekly hard sets per muscle. Finishing a session checks off the habit; rest timers ping via push.
- `lib/store.js`: one JSON document in a private Vercel Blob, ETag-guarded writes, daily backups.

Deployed on Vercel (project `nick-tasks`). Env: `APP_KEY`, optional `CALENDAR_ICS_URL`, plus a connected Blob store (`BLOB_STORE_ID`, OIDC).

## Setup notes

- Connector: claude.ai → Settings → Connectors → Add custom connector, URL `https://nick-tasks-nickcoronas-projects.vercel.app/mcp/<APP_KEY>`. After changing tool metadata (e.g. the MCP App link), reconnect so Claude reloads the tool list.
- Meta Muse: Settings → Connectors → Add custom connector, URL `https://nick-tasks.vercel.app/mcp`, then Allow on the sign-in page. If Muse instead builds the connector in chat, give it that URL with auth = bearer token and enter the APP_KEY in its secure credential prompt, not the chat.
- Deploys: the Vercel project is linked to this repo, so pushes to `main` deploy to production and PRs get preview deployments.
- Pings: timed routines and habits are recurring Google Calendar events; a scheduled Claude task (7:47am and 4:47pm Toronto) reads `get_queue` and `review` and pushes only when something needs attention.
- Phone: open the long `/app/<APP_KEY>` link once in Chrome, then menu → Install app (or Add to Home screen) for a full-screen app icon. For a live home-screen widget, point a web-widget app at `https://nick-tasks.vercel.app/w`.
