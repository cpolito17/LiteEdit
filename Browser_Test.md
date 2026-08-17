# LiteEdit Browser Test Plan

This document covers the browser checks for the merged Phase 0-2 work and the remaining Phase 1 technical gate.

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
| SHELL-03 | Inspect the top command bar.                      | LiteEdit branding, `OPEN`, `EXPORT`, `UNDO`, `NEW`, and `LOCAL / READY` are visible. `OPEN`, `EXPORT`, and `UNDO` are disabled. `NEW` is enabled.                                                        |
| SHELL-04 | Inspect the left tool rail.                       | All ten tools are visible: Move, Marquee, Lasso, Select, Brush, Shape, Eraser, Crop, Picker, and Hand. Each is a button with an accessible name, shortcut text, visible focus state, and `aria-pressed`. |
| SHELL-05 | Inspect the empty canvas state.                   | `LOCAL IMAGE WORKBENCH`, the no-document message, the local-processing notice, viewport rulers, and zoom status are visible. `OPEN IMAGE // PHASE 3` is disabled.                                        |
| SHELL-06 | Inspect the right inspector.                      | The four tabs `LAYERS`, `HISTORY`, `PROPERTIES`, and `SWATCHES` are visible. The active tab is clear without relying on color alone.                                                                     |
| SHELL-07 | Inspect the bottom status bar.                    | Document, size, active-tool, and `BUILD / PHASE 2` status text are visible and readable.                                                                                                                 |
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

These checks are required before Phase 3 work depends on the selected editor architecture. Do not use the existing synthetic Vitest fixtures as a substitute for the real-browser checks.

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

## 8. Feedback format

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
