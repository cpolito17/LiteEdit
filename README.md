# LiteEdit

LiteEdit is a private, local-first photo and graphics editor that runs entirely in the browser. Open an image, combine raster and vector layers, make precise edits, and export the result without uploading source files to a server.

**Live editor:** https://liteedit.charliepolito.com/

**Portfolio:** [charliepolito.com](https://charliepolito.com/)

**Source:** [github.com/cpolito17/LiteEdit](https://github.com/cpolito17/LiteEdit)

## Features

- Local PNG, JPEG, and WebP import with validation
- Raster painting, selections, transforms, crop, resize, and warp
- Vector shapes and hierarchical layer management
- Undo/redo history, document recovery, swatches, and export controls
- Keyboard shortcuts and accessible application controls

## Architecture and technology

This is a client-only React and TypeScript app. Fabric.js drives canvas rendering, Zustand supports focused state, and dedicated modules handle imports, raster sources, selections, transforms, history, recovery, and exports. Vitest covers domain logic and Playwright covers browser workflows. It is built with Vite and deployed on Cloudflare Workers.

## Local setup and scripts

Requires Node.js 24 (see `.nvmrc`) and npm.

```bash
npm ci
npm run dev
npm run verify       # format, lint, types, tests, and build
npm run test:e2e     # Playwright browser tests
npm run cf:dry-run   # validate the Cloudflare bundle
npm run preview
```

## Environment variables

None are required. The editor has no authenticated API integration. Do not add secrets to Vite client variables or committed environment files.

## Deployment

`npm run deploy` verifies and publishes the static Vite app using `wrangler.jsonc`. The custom production domain is `liteedit.charliepolito.com`.

## Security and privacy

Images and edits remain on the device; there is no upload endpoint. Recovery data and swatches use browser storage. Image imports are constrained by the validation layer, while `public/_headers` limits scripts, network access, framing, and browser capabilities. Run `npm audit` and the complete verification suite before releases. On shared devices, clear site storage to remove recovery information.

## Status and license

This is an active v1 personal project. No license file is included, so reuse rights are reserved by default.
