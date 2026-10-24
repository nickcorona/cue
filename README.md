# nick-tasks

Personal task, habit and routine manager that lives behind a Claude connector.

- `api/mcp.js`: MCP server (Streamable HTTP, stateless JSON). Auth is a secret path segment: `/mcp/<APP_KEY>`.
- `api/web.js`: web view. `/app/<APP_KEY>` signs a device in (1-year cookie) and redirects; after that `/` is the full queue and `/w` the compact widget view. Also serves the PWA manifest and service worker.
- `lib/tools.js`: tool definitions, server instructions, handlers.
- `lib/logic.js`: ranking (Apparent Tardiness Cost with Smith's-rule baseline), planning-fallacy correction, habit and routine status.
- `lib/ui.js`: the queue UI, served both as an MCP App (`ui://nick-tasks/queue.html`, rendered inline in Claude) and as the web view.
- `lib/store.js`: one JSON document in a private Vercel Blob, ETag-guarded writes, daily backups.

Deployed on Vercel (project `nick-tasks`). Env: `APP_KEY`, plus a connected Blob store (`BLOB_STORE_ID`, OIDC).

## Setup notes

- Connector: claude.ai → Settings → Connectors → Add custom connector, URL `https://nick-tasks-nickcoronas-projects.vercel.app/mcp/<APP_KEY>`. After changing tool metadata (e.g. the MCP App link), reconnect so Claude reloads the tool list.
- Deploys: the Vercel project is linked to this repo, so pushes to `main` deploy to production and PRs get preview deployments.
- Pings: timed routines and habits are recurring Google Calendar events; a scheduled Claude task (7:47am and 4:47pm Toronto) reads `get_queue` and `review` and pushes only when something needs attention.
- Phone: open the long `/app/<APP_KEY>` link once in Chrome, then menu → Install app (or Add to Home screen) for a full-screen app icon. For a live home-screen widget, point a web-widget app at `https://nick-tasks.vercel.app/w`.
