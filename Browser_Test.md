# LiteEdit Browser Test Plan

This document covers the browser checks for the implemented Phase 0-4 work, the unresolved Phase 1 technical gate, the Phase 3 local document workflow, and Phase 4 layers and structural history.

Do not mark a check as `PASS` when the feature is only covered by a jsdom or unit test. Use `BLOCKED` when the required browser or test harness is not available.

## 1. Test setup

Run these commands from a clean checkout of `main`:

```bash
npm ci
npm run verify
npm run test:e2e
```

For manual checks, use both modes:

```bash
npm run dev
```

Open the development server URL, then test the component gallery at `/__gallery`.

```bash
npm run build
npx vite preview --host 127.0.0.1
```

Open the preview URL for production-shell checks. The gallery must not be available in this mode.

Record the following environment details before testing:

- Operating system:
- Browser and version:
- Browser engine: Chromium, Firefox, or WebKit
- Viewport and device-pixel ratio:
- LiteEdit commit or branch:
- Test date:

Use these result values:

- `PASS`: expected behavior confirmed.
- `FAIL`: behavior differs from the expected outcome.
- `BLOCKED`: the check could not run because of a missing browser, fixture, permission, or harness.
- `NOT RUN`: intentionally skipped.

## 2. Phase 0 smoke and local boundary

| ID     | Action                                                       | Expected outcome                                                                                                       |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| ENV-01 | Run `npm run verify`.                                        | Format, lint, strict typecheck, unit tests, and production build pass.                                                 |
| ENV-02 | Run `npm run test:e2e` with a supported browser installed.   | The existing smoke test passes and the shell loads at the preview URL.                                                 |
| ENV-03 | Open the production preview and inspect the browser console. | No uncaught errors or failed application requests appear during initial load.                                          |
| ENV-04 | Inspect the Network panel while loading the shell.           | No image bytes or document data leave the browser. Font requests, if present, resolve to local application assets.     |
| ENV-05 | Inspect the response headers for the preview.                | The configured Content Security Policy and security headers are present. No external font or image origin is required. |

## 3. Shell visual checks

Run each check at `1024 x 768`, `1440 x 900`, and `1920 x 1080`.

| ID       | Action                                            | Expected outcome                                                                                                                                                                                         |
| -------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHELL-01 | Resize the viewport to each required size.        | The command bar, tool rail, canvas zone, inspector, and status bar remain visible. No horizontal scrollbar or clipped primary control appears.                                                           |
| SHELL-02 | Inspect the canvas zone and all shell surfaces.   | The canvas uses a deterministic low-contrast square grid. The shell uses modest corner radii and soft elevation where appropriate. It has no CSS gradients, scanline overlay, or animated visual effect. |
| SHELL-03 | Inspect the top command bar.                      | LiteEdit branding, `OPEN`, `EXPORT`, `UNDO`, `NEW`, and `LOCAL / READY` are visible. `OPEN` and `NEW` are enabled. `EXPORT` and `UNDO` are disabled until a document is loaded.                          |
| SHELL-04 | Inspect the left tool rail.                       | All ten tools are visible: Move, Marquee, Lasso, Select, Brush, Shape, Eraser, Crop, Picker, and Hand. Each is a button with an accessible name, shortcut text, visible focus state, and `aria-pressed`. |
| SHELL-05 | Inspect the empty canvas state.                   | `LOCAL IMAGE WORKBENCH`, the no-document message, the local-processing notice, viewport rulers, and zoom status are visible. `OPEN IMAGE // LOCAL` is enabled.                                           |
| SHELL-06 | Inspect the right inspector.                      | The four tabs `LAYERS`, `HISTORY`, `PROPERTIES`, and `SWATCHES` are visible. The active tab is clear without relying on color alone.                                                                     |
| SHELL-07 | Inspect the bottom status bar.                    | Document, size, pointer, active-tool, history, and `BUILD / PHASE 4` status text are visible and readable.                                                                                               |
| SHELL-08 | Inspect the shell at normal and high-DPI scaling. | Text remains legible. Controls remain at least 32 px high where applicable. No control overlaps another.                                                                                                 |

## 4. Keyboard and focus checks

Perform these checks without using the mouse after the initial page load.

| ID     | Action                                                                                  | Expected outcome                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| KEY-01 | Press `V`, `M`, `L`, `W`, `B`, `U`, `E`, `C`, `I`, and `H`.                             | The matching tool becomes active. Its `aria-pressed` state changes. A status toast identifies the active tool.                             |
| KEY-02 | Press `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Cmd/Ctrl+D`, and `Cmd/Ctrl+T`.                 | Each shortcut is captured by the editor and shows the correct status message. No document mutation occurs because no document is loaded.   |
| KEY-03 | Focus the rotation field or another text-entry control and press a tool key.            | The field keeps the key event. The active tool does not change while typing.                                                               |
| KEY-04 | Tab through the page from the address-bar return point.                                 | Focus moves through meaningful interactive controls in a predictable order. Disabled controls are not usable. Focus is always visible.     |
| KEY-05 | Focus an inspector tab and press `ArrowRight`, `ArrowLeft`, `Home`, and `End`.          | The selected tab changes correctly. Only the selected tab has tab-stop behavior. Focus follows the selected tab.                           |
| KEY-06 | Focus the slider and numeric input. Use arrow keys, `Home`, `End`, and numeric editing. | Values change by the declared step. Units remain visible. The updated values appear in the inspector and viewport status where applicable. |
| KEY-07 | Press `Escape` during any open dialog or transient UI state.                            | The transient state closes or cancels without changing document state.                                                                     |

## 5. Shell components and development gallery

Use the development server and open `/__gallery`.

| ID    | Action                                                                                                     | Expected outcome                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01 | Open the gallery and switch between `CONTROLS` and `FEEDBACK`.                                             | Tabs use correct tab semantics. Click and arrow-key navigation both work.                                                             |
| UI-02 | Hover and keyboard-focus `TOOLTIP TARGET`.                                                                 | A tooltip appears on hover and focus. It does not block keyboard access to the target.                                                |
| UI-03 | Open `VIEW STATUS`. Press `Escape`, then open it again and click its trigger.                              | The popover opens, closes with `Escape`, and toggles without page navigation.                                                         |
| UI-04 | Change `OFFSET` and `OPACITY`.                                                                             | Numeric and slider controls update their displayed values. Keyboard increments work.                                                  |
| UI-05 | Open `GALLERY DIALOG`.                                                                                     | A dialog with a heading opens. Focus moves into the dialog. The close button works. `Escape` closes it. Focus returns to the trigger. |
| UI-06 | Toggle the gallery toast.                                                                                  | The toast appears with `role=status`, readable text, and a visible status indicator.                                                  |
| UI-07 | Open `/__gallery` in the production preview.                                                               | The development-only gallery is not rendered. The normal editor shell is rendered instead.                                            |
| UI-08 | Enable the browser preference `prefers-reduced-motion: reduce` and repeat hover, dialog, and toast checks. | No decorative animation is visible. State changes remain functional and readable.                                                     |

## 6. Accessibility audit

Run an axe audit in the development page and the production preview page.

| ID      | Action                                                                                                      | Expected outcome                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A11Y-01 | Run axe against `/`.                                                                                        | Zero serious or critical violations. Any moderate or minor finding is recorded with its selector and disposition.     |
| A11Y-02 | Run axe against `/__gallery` in development.                                                                | Zero serious or critical violations.                                                                                  |
| A11Y-03 | Inspect the accessibility tree for tools, tabs, dialog, slider, numeric input, tooltip, popover, and toast. | Each control has a useful name, state, role, and relationship to its label or panel. No state depends on color alone. |

## 7. Phase 1 technical gate

These checks are required before later raster and selection tools depend on the selected editor architecture. Do not use the existing synthetic Vitest fixtures as a substitute for the real-browser checks.

Open the development-only browser harness at `/__spikes/phase1`. It renders the Fabric scene, raster bridge, warp mesh, tile-history, and real JPEG encoder checks. Use the confirmation controls only after inspecting the rendered result. The Object Selection card remains blocked until the owner supplies five approved local photos and a second candidate with a quantized lazy-loaded segmentation model.

| ID      | Action                                                                                                                                            | Expected outcome                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GATE-01 | Open `/__spikes/phase1` and inspect the original and restored Fabric scene canvases. Confirm the visual match after the serialized group appears. | The restored scene has the same object structure and group opacity. The rendered result matches the pre-serialization result at 100% zoom.                                                                                           |
| GATE-02 | Open `/__spikes/phase1`, click `PAINT BACKING TILE`, and inspect the raster canvas.                                                               | The visible raster updates. The Fabric image object remains the same renderer and unrelated scene objects remain unchanged.                                                                                                          |
| GATE-03 | Open `/__spikes/phase1`, inspect the checkerboard at `100%` and `400%`, and confirm the visual result.                                            | No visible one-pixel seams appear. Mesh coverage is complete.                                                                                                                                                                        |
| GATE-04 | Run both local Object Selection candidates against five representative photos. Record runtime and subject-isolation result for each photo.        | At least one candidate isolates the intended foreground subject in at least four of five photos within two seconds on the reference computer. The current harness must remain `BLOCKED` until the required model and fixtures exist. |
| GATE-05 | Open `/__spikes/phase1`, draw one pointer stroke, then click `CONFIRM HASH ROUND-TRIP`.                                                           | Undo and redo restore identical pixel hashes. The pointer gesture is represented by one transaction and one dirty tile.                                                                                                              |
| GATE-06 | Open `/__spikes/phase1` and click `RUN 4096 JPEG SEARCH`.                                                                                         | The search uses a real browser JPEG encoder, reaches its reported target tolerance when possible, and does not freeze the browser UI.                                                                                                |
| GATE-07 | Record the Phase 1 result for each of the six spikes.                                                                                             | Each spike has a reproducible result, evidence, and an explicit `PASS`, `FAIL`, or `BLOCKED` state. The Object Selection engine is not considered selected until GATE-04 passes.                                                     |

## 8. Phase 3 local document workflow

Use a small PNG, JPEG, and WebP fixture that is permitted for local testing. Do not commit image fixtures unless their rights and size are approved. Keep the browser Network panel open during import and export checks.

| ID     | Action                                                                                                   | Expected outcome                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-01 | Click `OPEN` or `OPEN IMAGE // LOCAL`, then choose a PNG, JPEG, or WebP file.                            | The image opens in the editor as one visible raster layer. The document name, pixel dimensions, layer name, and `BUILD / PHASE 4` status update.              |
| DOC-02 | Drag a supported PNG, JPEG, or WebP file over the canvas zone and release it.                            | The same local import path opens the document. No page navigation or browser file upload occurs.                                                              |
| DOC-03 | Try a GIF, a file with a mismatched image type, and a file larger than the documented local limit.       | LiteEdit rejects each file before creating a document and shows a readable warning. The existing document, if any, remains unchanged.                         |
| DOC-04 | Click `NEW`, enter valid width and height values, choose Transparent, White, and Black, and create each. | A blank document opens at the requested size. Transparent keeps the canvas alpha; White and Black fill the backing canvas.                                    |
| DOC-05 | Move the pointer over the document and inspect the status bar.                                           | `POINTER / X #### / Y ####` reports document coordinates, not screen coordinates. It clears or shows dashes outside the document bounds.                      |
| NAV-01 | Click `FIT`, click `100%`, change the Properties zoom slider, and use the mouse wheel over the document. | Fit centers the full document, 100% shows one document pixel per canvas pixel, the slider clamps to 5%-3200%, and wheel zoom remains centered on the pointer. |
| NAV-02 | Select `HAND`, drag the document, then hold Space and drag with another active tool.                     | The viewport pans without changing document pixels. The cursor communicates grab/grabbing state.                                                              |
| DOC-06 | With an unchanged imported or blank document, click `EXPORT`, then inspect the downloaded PNG.           | The exported PNG uses document resolution, excludes viewport controls and overlays, and matches the source pixels for an unchanged import.                    |
| DOC-07 | Monitor the Network panel while importing, navigating, and exporting a local image.                      | No image bytes or document data are sent to a server. The import uses a browser-local object URL and export uses a browser download.                          |

For each fixture, record the fixture dimensions, browser, result, and evidence. If a browser cannot decode WebP, mark only that fixture `BLOCKED` and continue with PNG and JPEG.

## 9. Phase 4 layers and structural history

Use a small image with obvious foreground and background colors. Keep the Layers, History, and Network panels visible as needed.

| ID      | Action                                                                                                                         | Expected outcome                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAY-01  | Open an image. Add two paint layers and one group.                                                                             | Each action adds one topmost row. The panel count is correct. The Layers panel shows topmost items first.                                                                        |
| LAY-02  | Rename a paint layer. Hide it, show it, lock it, unlock it, and set opacity to 55%.                                            | The name and state controls update. Each completed change has one readable History row. Opacity input events coalesce instead of flooding History.                               |
| LAY-03  | Use the up and down controls on a layer. Then drag it onto a group and use `OUT` to return it to the root.                     | Sibling order changes predictably. Dropping onto a group nests the layer. `OUT` places it immediately above its former parent. No layer disappears or duplicates.                |
| LAY-04  | Wrap an active layer with `GROUP`. Set the group opacity to 50%. Select the child and inspect its opacity. Then use `UNGROUP`. | The group owns the active layer. Group opacity changes without changing the child's stored opacity. Ungroup preserves child order and opacity.                                   |
| LAY-05  | Create two nested groups. Try to drag the outer group into its own descendant.                                                 | LiteEdit rejects the cycle, shows a warning, and leaves the layer tree unchanged.                                                                                                |
| LAY-06  | Duplicate a group that contains raster children. Hide the original. Delete the duplicate. Undo once, then redo once.           | The duplicate has independent node and raster-buffer IDs but identical pixels. Deleting the group is one transaction. Undo restores the full subtree; redo removes it again.     |
| SYNC-01 | Select `MOVE`. Click a visible raster object, then select another row in the Layers panel.                                     | Canvas selection updates the active Layers row. Panel selection updates the corresponding top-level canvas selection without changing pixels.                                    |
| HIST-01 | Perform at least ten mixed layer operations. Undo to the document start, then redo to the final state.                         | Names, visibility, lock, opacity, hierarchy, active layer, and order match the initial and final states exactly. Undo and redo buttons and keyboard shortcuts stay synchronized. |
| HIST-02 | Undo two operations, then make a new layer edit.                                                                               | The redo branch clears immediately. The History panel marks only applied entries as current.                                                                                     |
| EXP-01  | With nested groups, hidden layers, and an active canvas selection, export PNG and inspect it at document resolution.           | Export respects hierarchy, visibility, and post-composite group opacity. It excludes canvas controls, viewport zoom, panel state, grid detail, and all editor overlays.          |
| PRIV-01 | Keep the Network panel open while creating, duplicating, grouping, undoing, redoing, and exporting layers.                     | No image or document bytes leave the browser.                                                                                                                                    |
| SIZE-01 | Run LAY-01 through HIST-02 at 1024 x 768, 1440 x 900, and 1920 x 1080.                                                         | Layer and History controls stay readable and operable. The layer tree scrolls inside the inspector and does not push the status bar off-screen.                                  |

## 10. Feedback format

Return one row for every ID. Do not omit blocked or not-run checks.

```markdown
## Browser test feedback

- Environment: Windows 11 / Edge 151 / Chromium
- Browser version:
- Viewport sizes tested:
- Device-pixel ratio:
- LiteEdit commit:
- Test date:

| ID       | Result  | Evidence                       | Notes |
| -------- | ------- | ------------------------------ | ----- |
| ENV-01   | PASS    | `npm run verify` output        |       |
| ENV-02   | BLOCKED | Browser executable unavailable |       |
| SHELL-01 | PASS    | Screenshot: 1024x768           |       |
| ...      | ...     | ...                            | ...   |

### Failures

- ID:
- Reproduction steps:
- Expected:
- Actual:
- Console or network evidence:
- Screenshot or recording:

### Phase 1 gate summary

| Spike                        | Result | Runtime | Evidence | Decision or blocker |
| ---------------------------- | ------ | ------- | -------- | ------------------- |
| Fabric scene                 |        |         |          |                     |
| Raster bridge                |        |         |          |                     |
| History tiles                |        |         |          |                     |
| Warp mesh                    |        |         |          |                     |
| Object Selection candidate A |        |         |          |                     |
| Object Selection candidate B |        |         |          |                     |
| JPEG export search           |        |         |          |                     |
```

For screenshots, use filenames that include the test ID, viewport, and browser. Example: `SHELL-01_1440x900_edge.png`.
