# nick-tasks

Single-user personal app. Commit and push straight to `main`: no feature branches or PRs. Vercel deploys `main` to production on push, so validate locally first (mock the handlers or run a local server) and check the live endpoint after the deploy.

Never commit the APP_KEY; it lives only in Vercel env vars.
