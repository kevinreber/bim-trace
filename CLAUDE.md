# CLAUDE.md - BIM Trace Development Guide

## Project Overview
BIM Trace is a web-native BIM authoring and review platform combining 3D parametric modeling (Revit-style) with 2D PDF annotation (Bluebeam-style) and bi-directional linking. The UI follows Autodesk Revit's design patterns with a ribbon toolbar, Project Browser, and Properties panel.

## Tech Stack
- **Framework**: Vite + React 18 + TypeScript 5
- **Routing**: TanStack Router (file-based)
- **3D Engine**: @thatopen/components (IFC.js) + Three.js
- **2D PDF**: pdfjs-dist
- **2D Annotation**: Fabric.js
- **Styling**: Tailwind CSS + custom CSS (Revit-inspired theme)
- **Linting**: Biome
- **AI**: Anthropic Claude API (server-side proxy via Vite plugin)

## Environment Variables
Copy `.env.example` to `.env` and fill in the values:
- `ANTHROPIC_API_KEY` — Optional fallback for the AI Image to BIM feature. Users provide their own key via the UI (BYOK pattern). Only needed if you want a default key locally. Get a key at https://console.anthropic.com/settings/keys
- `ALLOW_SHARED_API_KEY` — Set to exactly `"true"` to let `ANTHROPIC_API_KEY` serve as the fallback **in production**. It is ignored there by default: the generation endpoint is unauthenticated, so a shared key lets anyone who finds the URL spend your credits at roughly $0.85 a request. Only opt in behind access control. See `resolveApiKey()` in `server/aiConfig.ts`.

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npx @biomejs/biome check src/` — Lint and format check
- `npx @biomejs/biome check --write src/` — Auto-fix lint/format issues
- `npm run eval:run` — Capture AI generation responses for the eval fixtures (needs `npm run dev` running)
- `npm run eval:score` — Score the newest captured eval run
- `npm run eval:selftest` — Verify the eval checks themselves still fire
- `npm test` — Vitest unit suite (geometry, salvage parsing, request validation)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:e2e` — Playwright end-to-end suite (starts the dev server itself)
- `npm run test:e2e:ui` — Same suite in Playwright's interactive UI mode

## Key Architecture

### Layout (Revit-inspired)
```
┌─ Quick Access Bar (undo/redo, app title) ──────────────────────┐
├─ Ribbon Tabs (Modify | Architecture | Annotate | View | Manage) ┤
├─ Ribbon Panel (grouped tools with SVG icons) ──────────────────┤
├─────────────┬──────────────────────────────┬───────────────────┤
│ Project     │  3D Viewport  │  2D Sheet    │ Properties Panel  │
│ Browser     │  (Three.js)   │  (PDF.js)    │ (element editor)  │
│ (tree,      │               │              │                   │
│  markups,   │               │              │ Identity Data     │
│  levels)    │               │              │ Dimensions        │
│             │               │              │ Constraints       │
│             │               │              │ Location          │
├─────────────┴──────────────────────────────┴───────────────────┤
└─ Status Bar (active tool, snap, level, element count) ─────────┘
```

### Core Files
- **`src/routes/index.tsx`** — Main app state, layout composition, keyboard shortcuts, undo/redo
- **`src/types.ts`** — All BIM element types (BimElementType, BimElementParams, DEFAULT_PARAMS)
- **`src/globals.css`** — Revit-inspired theme with CSS custom properties and ribbon/panel styles
- **`server/prompt.ts`** — Shared AI system prompt for floor plan generation
- **`server/aiConfig.ts`** — Shared request config for both proxies: allowed models, default model, `BIM_OUTPUT_SCHEMA` (structured-output JSON schema), `buildUserText()`; also the source of the client-side model dropdown so the two paths cannot drift
- **`server/apiProxy.ts`** — Vite dev server plugin that proxies `/api/generate-floor-plan` to Anthropic API (keeps API key server-side)
- **`api/generate-floor-plan.ts`** — Vercel serverless edge function for the same endpoint in production

### UI Components
- **`src/components/RibbonToolbar.tsx`** — Tabbed ribbon toolbar (Modify/Architecture/Annotate/View/Manage) with SVG icons and grouped tool panels
- **`src/components/Sidebar.tsx`** — Project Browser (left panel) + Properties Panel (right panel), exported as `ProjectBrowser` and `PropertiesPanel`
- **`src/components/ElementEditor.tsx`** — Revit-style property grid with collapsible sections (Identity Data, Dimensions, Material, Constraints, Location)
- **`src/components/ViewportPane.tsx`** — Multi-pane viewport wrapper supporting 3D, Plan, Elevation, Section, and 2D Sheet view types
- **`src/components/ContextMenu.tsx`** — Right-click context menus on 3D elements (Select, Copy, Hide Category, Delete)
- **`src/components/ScheduleModal.tsx`** — Auto-generated tabular schedules for element types (Door, Window, Room, Wall, All)
- **`src/components/AiGenerateModal.tsx`** — AI Image to BIM modal with multi-image upload and generation preview
- **`src/components/ViewCube.tsx`** — Revit-style 3D navigation cube overlay (top-right of perspective 3D viewports); mini Three.js scene that mirrors main camera orientation; click faces/edges/corners to snap the camera via `Viewer3DHandle.setViewDirection`; hidden in orthographic views (plan/elevation/section)

### 3D Engine
- **`src/components/geometryBuilders.ts`** — All geometry builder functions (`buildWallMesh`, `buildDoorMesh`, etc.), materials, and wall opening computation (`computeWallOpenings`); extracted from Viewer3D
- **`src/components/Viewer3D.tsx`** — Three.js viewer with:
  - Element creation (two-click and single-click tools)
  - Raycast selection with door/window priority over host walls
  - Ghost preview system for element placement
  - Wall-snapping for doors/windows (`raycastWalls`)
  - Scene sync dispatching to geometry builders
  - Camera control (flyToElement, zoomIn/Out, zoomToFit)

### 2D Engine
- **`src/components/PdfViewer.tsx`** — PDF.js rendering with page navigation and zoom
- **`src/components/AnnotationLayer.tsx`** — Fabric.js canvas overlay for 2D markup drawing
- **`src/components/AnnotationToolbar.tsx`** — Annotation tool selector (legacy, now integrated into ribbon)

### Supporting Components
- **`src/components/PropertyPanel.tsx`** — Read-only IFC element property display
- **`src/components/MarkupList.tsx`** — Markup management with status tracking and 3D linking
- **`src/components/CreationToolbar.tsx`** — Legacy creation toolbar (replaced by RibbonToolbar)

### AI Services
- **`src/services/aiFloorPlanService.ts`** — Claude API integration for Image-to-BIM generation with adaptive thinking and multi-image support; `validateAndFixElements` returns `{ elements, warnings }` so discarded elements are reported rather than dropped silently
- **`src/services/aiApiKeyStore.ts`** — Browser-local API key persistence

### AI Request Configuration
Both `server/apiProxy.ts` (dev) and `api/generate-floor-plan.ts` (production) build an identical request from `server/aiConfig.ts`:
- Models are Claude 5 (`claude-opus-5` default, `claude-sonnet-5`). **`budget_tokens` is rejected on Claude 5** — use `thinking: { type: "adaptive" }` with `output_config: { effort }` instead.
- Structured outputs (`output_config.format`) constrain the response to `{ "elements": [...] }`, so the model cannot return prose around the JSON. The API rejects `additionalProperties` as an object and rejects `minimum`/`maximum` on numeric schemas, so `params` enumerates every type's keys explicitly and values cannot be bounded. `numRisers` is typed `integer` because an unbounded number grammar let constrained decoding fall into a runaway literal that consumed the whole token budget.
- The system prompt classifies the input as a MEASURED DRAWING or a PICTORIAL image before anything else, and applies a different ruleset to each. Drawings are modelled literally — no inferred storeys, no inferred windows. Photographs get the depth-inference guidance. Getting this branch wrong is the single largest source of bad output.
- Requests are streamed (`.stream().finalMessage()`) because a 32k `max_tokens` on a non-streaming request risks an HTTP timeout.
- `validateGenerateRequest()` runs before anything touches the body, rejecting a missing or empty `images` array, more than `MAX_IMAGES` (5) images, and unsupported media types with a 400. Both proxies must call it: they read `body.images.length` immediately after, which throws on a malformed body. **The endpoint is unauthenticated**, which is safe under BYOK because every caller spends their own credits. `resolveApiKey()` protects that property: it prefers the caller's key, and ignores the `ANTHROPIC_API_KEY` fallback entirely when `NODE_ENV` or `VERCEL_ENV` is `production` unless `ALLOW_SHARED_API_KEY` is exactly `"true"`. Without that gate a production deploy with a key set is an open paid endpoint at roughly $0.85 a request.

### Evals
`evals/` scores AI generation against fixture images instead of judging it by eye. Checks run on the **raw model response**, before `validateAndFixElements` repairs anything, so they measure the model rather than the validator. See `evals/README.md` for the check list. A 10-image corpus covering 7 stratified fixtures ships in `evals/fixtures/` (licences in `ATTRIBUTION.md`); `cad-plan-clean` is the control case — if it fails, the prompt or schema is at fault rather than model vision. Captured runs live in `evals/runs/` (gitignored). Scoring reads only from disk, so re-score after changing a check instead of spending another capture. Where a drawing genuinely admits more than one storey count, the fixture asserts `floorsRange: [min, max]` rather than an exact `floors` — `hand-sketch` has a roof belvedere served by a stair drawn in the plan, so both 1 and 2 are defensible and an exact assertion would score the ambiguity rather than the model.

### Unit tests
`vitest.config.ts` is standalone rather than extending `vite.config.ts`, because that config registers the API proxy plugin, which pulls in the Anthropic SDK and reads `.env`. Tests live next to their source as `*.test.ts` under `src/` and `server/`; Playwright owns `e2e/` and the two runners do not overlap.

Coverage is deliberately narrow — the pure functions whose failure modes are invisible in the viewport. `computeWallOpenings` (a hole placed wrong renders as a door embedded in solid wall), `snapWallEndpoints` (unsnapped corners leave rooms unenclosed), `salvageTruncatedElements` (a mis-parsed brace silently loses elements), and `resolveApiKey` / `validateGenerateRequest` (both guard an unauthenticated endpoint). All three geometry helpers were mutation-checked: breaking the tolerance or the string walker fails the matching test rather than passing quietly.

### End-to-end tests
`e2e/` holds the Playwright suite; `playwright.config.ts` starts `npm run dev` automatically and reuses an already-running server outside CI. `e2e/smoke.spec.ts` covers the shell — ribbon tab switching, the `Shift+W` / `Escape` / `G` keyboard shortcuts, and the metric/imperial toggle — by driving real state transitions with nothing stubbed.

Two selector traps to know about. `Sidebar.tsx` reuses the `.status-bar` class for its own footer, so tests scope to the application status bar by filtering on the `Level:` readout. Ribbon tab and tool names collide with button labels elsewhere in the app, so tab queries are scoped to `.ribbon-tabs` and tool queries to `.ribbon-panel`.

Biome only lints `src/`, so `e2e/` and `playwright.config.ts` are outside the lint scope but are still type-checked by `tsc -b` during `npm run build`.

## Documentation Policy
**Every commit MUST include documentation updates for all affected docs.**

A PreToolUse hook in `.claude/settings.json` enforces this by blocking `git commit` when:
- CHANGELOG.md hasn't been updated (always required)
- Core files changed (types, viewer, ribbon, editor, routes) but CLAUDE.md wasn't updated

### Slash Commands
- **`/validate-docs`** — Comprehensive documentation validation. Checks README.md, CLAUDE.md, CHANGELOG.md, and ROADMAP.md against the actual codebase and fixes any drift. **Run this before every commit.**
- **`/update-changelog`** — Quick changelog update from current git diff.

### Changelog Policy
When making changes:
1. Add entries under the `## [Unreleased]` section in `CHANGELOG.md`
2. Use the appropriate subsection: `### Added`, `### Changed`, `### Fixed`, `### Removed`
3. Each entry should start with `- **Feature name** —` followed by a brief description
4. Stage CHANGELOG.md along with your code changes before committing

When releasing a version:
1. Move all `[Unreleased]` entries to a new version section `## [x.y.z] - YYYY-MM-DD`
2. Create a fresh empty `## [Unreleased]` section

### Documentation Files
| File | Purpose | When to update |
|------|---------|----------------|
| `CHANGELOG.md` | User-facing change log | Every commit |
| `CLAUDE.md` | Developer guide for Claude Code | When architecture, files, shortcuts, or conventions change |
| `README.md` | Project overview & tech stack | When tech stack or high-level features change |
| `ROADMAP.md` | Feature tracking with checkboxes | When a planned feature is shipped |

## Adding New BIM Elements
1. Add the type to `BimElementType` union in `src/types.ts`
2. Add params interface to `BimElementParams` in `src/types.ts`
3. Add defaults to `DEFAULT_PARAMS` in `src/types.ts`
4. Add the default material to `DEFAULT_ELEMENT_MATERIAL` in `src/types.ts` (the materials themselves live in `MATERIAL_LIBRARY` in `geometryBuilders.ts`)
5. Create `buildXxxMesh()` geometry builder in `geometryBuilders.ts`
6. Add case to `buildMeshForElement()` switch in `geometryBuilders.ts`
7. Add ghost preview case in `updateGhostPreview()` in `Viewer3D.tsx`
8. Add to click handler logic in `handleClick()` in `Viewer3D.tsx`
9. Add tool entry + SVG icon to `RibbonToolbar.tsx` (in the appropriate group)
10. Add type label to `TYPE_LABELS` in `ElementEditor.tsx`
11. Add param fields to `PARAM_FIELDS` in `ElementEditor.tsx`
12. Update CHANGELOG.md

## Wall Boolean System
When a door or window is hosted on a wall (`hostWallId`), the wall geometry automatically cuts an opening:
- `computeWallOpenings()` finds all doors/windows for a given wall
- Projects each opening's position onto the wall centerline
- `buildWallMesh()` uses `THREE.Shape` with holes + `ExtrudeGeometry` instead of `BoxGeometry`
- Openings are recalculated on every scene sync (when `bimElements` changes)

Two guards keep a bad `hostWallId` from cutting a hole in the wrong place. An opening further than `thickness + 0.1` off the wall centerline is discarded outright, since it names this wall but sits somewhere else. Along the wall axis the rule is deliberately forgiving: a door hard against a corner legitimately overhangs the centerline by a few centimetres (the eval corpus shows 4–10cm on otherwise correct doors, and `computeWallJoins` extends the drawn wall past that length anyway), so an overhang within `max(thickness, 0.15)` is nudged back inside the span rather than rejected. Only an opening that misses the wall by more than that, or is wider than the wall, is dropped. `evals/checks.mjs` mirrors this tolerance in `opening_within_span` — if you change one, change both, or the eval will report failures the renderer handles fine.

## Element Selection
- **3D click**: Raycast through scene meshes; prefers doors/windows over host walls within 0.3m tolerance
- **Project Browser click**: Clicking a leaf node selects the element, shows properties, and flies camera to it
- **Highlight**: Blue transparent overlay mesh matching the selected element's geometry and transform
- Selection flows: `Viewer3D.onElementSelected` → `index.tsx` state → `PropertiesPanel` + `ProjectBrowser`

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Shift+Letter` | Activate creation tool (W=Wall, D=Door, C=Column, etc.) |
| `1` / `2` / `3` / `4` | Single / 2-Up / 3-Up / 4-Up viewport layout |
| `G` | Toggle snap-to-grid |
| `Z` | Zoom to selected element |
| `Tab` | Cycle wall alignment mode (left/center/right) during wall creation |
| `Arrow keys` | Move selected element(s) by grid step |
| `Escape` | Deselect tool and clear selection |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+Click` | Multi-select elements |

## Conventions
- Use Biome for formatting (not Prettier)
- TypeScript strict mode
- Functional React components with hooks
- No external state management library (React state + props)
- Three.js materials defined as module-level constants
- Element IDs use `crypto.randomUUID()`
- CSS custom properties for theming (defined in `globals.css` `:root`)
- Revit-style UI patterns: ribbon groups with labels, property grid rows, status bar indicators
