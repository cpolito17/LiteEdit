# Deployment runbook

The production hostname is `liteedit.charliepolito.com`.

## Local validation

```bash
npm ci
npm run verify
npm run test:e2e
npm run cf:dry-run
```

The dry run must not deploy or write production state. Confirm that no secrets, account IDs, approved-photo fixtures, or personal paths exist in the repository before publishing a release.

## Cloudflare Workers Builds

Connect `cpolito17/LiteEdit` to a Worker named `liteedit`. Use `main` as the production branch, `npm run build` as the build command, and `npx wrangler deploy --strict` as the deploy command. The input `wrangler.jsonc` intentionally does not define `assets.directory`; the Cloudflare Vite plugin writes the output asset path during the build.

Before creating the Custom Domain, check for a conflicting `liteedit` DNS record. Stop if one exists until the owner decides whether to remove or reuse it.

## Release verification

After a verified commit reaches `main`, watch the GitHub `CI` workflow and the connected Cloudflare Workers Build. Record the commit SHA. In a private window at `https://liteedit.charliepolito.com`, create a blank document, paint, undo/redo, crop, export PNG and JPEG, reload and restore recovery, then confirm the Network panel contains no document or image upload.

If CI or the production smoke test fails, use Cloudflare version rollback for immediate service recovery and revert the Git commit on `main`. Do not patch the deployed Worker independently of Git.
