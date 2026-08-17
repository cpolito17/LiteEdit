# Deployment runbook

The production hostname is `liteedit.charliepolito.com`.

## Local validation

```bash
npm ci
npm run verify
npm run test:e2e
npm run cf:dry-run
```

The dry run must not deploy or write production state. Confirm that no secrets or account IDs exist in the repository before opening a release pull request.

## Cloudflare Workers Builds

Connect `cpolito17/LiteEdit` to a Worker named `liteedit`. Use `main` as the production branch, `npm run build` as the build command, and `npx wrangler deploy --strict` as the deploy command. The input `wrangler.jsonc` intentionally does not define `assets.directory`; the Cloudflare Vite plugin writes the output asset path during the build.

Before creating the Custom Domain, check for a conflicting `liteedit` DNS record. Stop if one exists until the owner decides whether to remove or reuse it.
