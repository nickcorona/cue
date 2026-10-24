# nick-tasks

Personal task, habit and routine manager that lives behind a Claude connector.

- `api/mcp.js`: MCP server (Streamable HTTP, stateless JSON). Auth is a secret path segment: `/mcp/<APP_KEY>`.
- `api/web.js`: standalone web view at `/app/<APP_KEY>`.
- `lib/tools.js`: tool definitions, server instructions, handlers.
- `lib/logic.js`: ranking (Apparent Tardiness Cost with Smith's-rule baseline), planning-fallacy correction, habit and routine status.
- `lib/ui.js`: the queue UI, served both as an MCP App (`ui://nick-tasks/queue.html`, rendered inline in Claude) and as the web view.
- `lib/store.js`: one JSON document in a private Vercel Blob, ETag-guarded writes, daily backups.

Deployed on Vercel (project `nick-tasks`). Env: `APP_KEY`, plus a connected Blob store (`BLOB_STORE_ID`, OIDC).
