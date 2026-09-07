# Changelog

All notable changes to BIM Trace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Railings and curtain walls in AI generation** — both have had geometry builders, params, and materials in the app all along, but were missing from `BIM_OUTPUT_SCHEMA`, so a balcony guard came back as a row of columns and a fully glazed gable as a grid of ordinary windows. Those were the closest shapes the model was permitted to name. Both are now in the schema, the validator, and the prompt
- **Material inference** — elements can now carry a `material` (concrete, wood, steel, glass, brick, stone, drywall, aluminum), read from the image rather than falling back to the type default for everything. This is why a dark tiled roof and a timber-clad gable both rendered in the same stock brown. An unrecognised value is dropped rather than passed on, since `getMaterialForElement` would otherwise resolve it to concrete and disguise a bad value as a deliberate one. Measured drawings are told to leave it null unless the drawing labels a material
- **Roof ridge direction** — `buildRoofMesh` extrudes its gable profile along one axis, so the ridge could only ever run one way and a building whose roof sloped the other direction came out turned ninety degrees. It now honours `rotation`, and swaps the span and extrusion on a quarter turn so a rectangular roof still covers its footprint instead of overhanging one pair of walls and falling short of the other
- **Vitest unit suite** — 39 tests over the pure helpers whose failure modes are invisible in the viewport: `computeWallOpenings` (a hole placed wrong renders as a door embedded in solid wall), `snapWallEndpoints` (unsnapped corners leave rooms unenclosed), `salvageTruncatedElements` (a mis-parsed brace silently loses elements), and `resolveApiKey` / `validateGenerateRequest`, which guard an unauthenticated endpoint. Mutation-checked rather than assumed: tightening the opening tolerance or breaking the string walker fails the matching test instead of passing quietly. Run with `npm test`
- **`ALLOW_SHARED_API_KEY`** — opt-in required for `ANTHROPIC_API_KEY` to serve as the fallback in production; see the fix below
- **`floorsRange` eval expectation** — a fixture can assert an inclusive band of storey counts instead of an exact number, for drawings where the count genuinely admits more than one reading
- **Playwright end-to-end suite** — `e2e/smoke.spec.ts` drives the real app through ribbon tab switching, the `Shift+W`/`Escape`/`G` keyboard shortcuts, and the metric/imperial toggle, with nothing stubbed; `playwright.config.ts` starts the dev server itself. Run with `npm run test:e2e`. Salvaged from the abandoned `claude/optimize-depth-estimation-YyIKU` branch, whose depth-estimation feature was left parked but whose test harness was the only test infrastructure this repo had
- **Vertical gridlines** — Gridlines now extend vertically as semi-transparent planes, making them visible in elevation and section views (not just plan view); vertical dashed lines mark gridline positions in all orthographic views
- **Level indicators in 3D views** — Levels are now rendered as horizontal dashed green lines with Revit-style triangle markers and labels; visible in elevation and section views to help align elements to story heights
- **Viewer3D init error handling** — 3D viewport initialization is now wrapped in try-catch to prevent full-app crashes (e.g. when opening 4-up layout with multiple WebGL contexts)
- **Unit system toggle (metric/imperial)** — Click the `m`/`ft` button in the status bar to switch between meters and feet; all level heights, ribbon level selector, and 3D level labels update accordingly; internal storage remains in meters with conversion on display/input
- **2D CAD rendering for orthographic views** — Plan, elevation, and section views now render elements as clean line drawings with faint fills instead of solid 3D meshes; only the perspective 3D view shows full materials; gives a Revit-style CAD look to architectural drawings
- **AI model selector** — users can now toggle between Claude Opus 5 and Claude Sonnet 5 in the AI Image to BIM modal; Opus is the default
- **Image-to-BIM eval harness** — `evals/` captures AI responses for a stratified fixture corpus and scores them against 12 internal-consistency checks (host resolution, opening placement, wall loop closure, level/slab coherence, and more) plus optional ground-truth counts; checks run on the raw model output rather than the repaired output, so they measure the model instead of the validator; `npm run eval:run`, `eval:score`, `eval:selftest`
- **Eval cost visibility** — both proxies now return the API `usage` block, the eval runner prints an estimated cost before starting and the actual tokens and spend per request as it goes, and `evals/pricing.mjs` holds the per-model rates; previously a capture's cost was unknowable until the credit balance ran out
- **Eval fixture corpus** — `evals/fixtures/` ships 10 openly-licensed images covering 7 stratified fixtures: a dimensioned CAD floor plan (the control case), an L-shaped plan, a hand-drawn historical plan with a curved apse, a house photographed straight-on, the HABS measured elevations of that same house, a four-angle photo set of one building, and an adversarial interior with no architecture; licences and creators are recorded in `evals/fixtures/ATTRIBUTION.md`
- **Generation warnings in the AI modal** — elements the validator discards are now listed in the preview instead of vanishing silently

### Changed
- **Migrated AI generation to Claude 5** — `claude-opus-5` (default) and `claude-sonnet-5` replace the Claude 4 models; `budget_tokens` is rejected on Claude 5, so extended thinking is now `thinking: { type: "adaptive" }` with `output_config: { effort: "high" }`; requests are streamed so a 32k output ceiling cannot trip an HTTP timeout
- **Structured outputs for floor plan generation** — the response is now constrained by a JSON schema (`BIM_OUTPUT_SCHEMA`) to `{ "elements": [...] }` rather than parsed out of free text; the tolerant fence-stripping and regex fallback remain as a safety net
- **Shared AI request config** — `server/aiConfig.ts` holds the model list, output schema, and user-text builder used by the dev proxy, the Vercel function, and the client model dropdown, replacing three copies that had to be kept in sync by hand
- **Server-side API proxy for AI Image to BIM** — Anthropic API calls now route through a server-side proxy (`/api/generate-floor-plan`) instead of calling Anthropic directly from the browser; eliminates `dangerouslyAllowBrowser` usage
- **BYOK (Bring Your Own Key) pattern** — users enter their Anthropic API key in the modal, key is stored in localStorage and sent per-request to the server proxy; the server never logs or persists the key; optional `ANTHROPIC_API_KEY` env var serves as fallback
- **AI Image to BIM — optimized depth & detail analysis** — significantly improved 3D inference from 2D exterior photos; added depth estimation guidance using roof slopes, perspective cues, and architectural proportions; enhanced prompt to detect non-rectangular footprints (L-shapes, wings, porches), varied window sizes (picture windows vs standard), porch columns/posts, and multi-section roofs; added JSON extraction fallback for robustness; fixed prompt contradiction that caused JSON parsing failures; replaced simple rectangle example with complex residential L-shaped home example
- **AI Image to BIM — improved multi-story detection** — enabled extended thinking (chain-of-thought reasoning) for better building analysis; enhanced prompt with step-by-step reasoning strategy that explicitly identifies floor count from window rows, floor lines, and roof structure before generating elements
- **AI Image to BIM — full building generation** — extended AI generation to produce complete multi-story buildings instead of just ground-floor walls; now generates walls, doors, windows, columns, slabs, roofs, stairs, ceilings, and beams across multiple levels; updated prompt with multi-story analysis strategy; preview modal shows counts for all element types and number of levels; increased max token output for larger buildings

### Fixed
- **Abandoned generations kept billing** — a generation runs for minutes and bills on completion, but nothing cancelled it when the caller went away, so closing the modal or the tab left the request running and paid roughly $0.85 for a response nobody would read. The modal now aborts on close, the abort reaches the endpoint, and both proxies pass the signal to the Anthropic call. A cancelled generation is no longer reported as a failure
- **A dropped connection could take the dev server with it** — the heartbeat wrote to the response without checking whether the caller was still there. Writing to a destroyed response emits an unhandled `error`, which is fatal to the process, and the equivalent unguarded `enqueue` in the edge function rejected inside the stream's `start`. Both now check before writing. Verified by dropping five connections mid-request: the server stayed up with a clean log
- **Extra images were dropped silently and leaked** — selecting more than `MAX_IMAGES` truncated the list with no message, and object URLs were created for the discarded files and never revoked, so they lived until the page was closed. The modal now decides what fits before creating anything and says how many were not added
- **Supported image formats were stated three different ways** — the dropzone hint and the file picker's `accept` list both said PNG, JPG and WebP, the server also accepted GIF, and the runtime check accepted any `image/*` file at all. A HEIC photo (the iPhone default) therefore passed the modal, uploaded, and was rejected minutes later by the server in terms the user could not act on. All three now derive from `ALLOWED_MEDIA_TYPES` in `server/aiConfig.ts`, so the hint reads `PNG, JPEG, WEBP, GIF · up to 20MB each`, the picker offers the same four, and an unsupported file is refused immediately by name and type with the supported list in the message. The `up to 5` copy and the image-count cap now come from `MAX_IMAGES` rather than a repeated literal
- **AI generation always failed on the Vercel deployment** — the edge function awaited the complete model response before returning, sending no bytes for the 2-4 minutes a generation takes, so Vercel killed the invocation at its ~25 second limit and substituted its own plain-text error page. The client parsed that as JSON and reported ``Unexpected token 'A', "An error o"...``, which named neither the timeout nor the cause. Both proxies now emit a keep-alive space immediately and every 5 seconds before writing the payload; whitespace is legal JSON ahead of the value, so the body is still a plain JSON document. Measured against the dev server, the first byte now leaves in 4ms against a 186ms total. Local development was never affected, which is why every automated check passed
- **Server errors surfaced as JSON syntax errors** — the client called `response.json()` before checking `response.ok`, so any non-JSON error body (a gateway timeout page, most importantly) produced a parse error instead of the real cause, after the user had already waited several minutes. `readServerPayload()` reads the body as text, reports a non-JSON response as a probable timeout with a preview, and checks the `error` field regardless of status
- **Shared API key was live on public deployments** — the generation endpoint has no authentication, which is fine under BYOK because every caller spends their own credits, but the `ANTHROPIC_API_KEY` fallback broke that property: a production deploy with a key set was an open paid endpoint that anyone who found the URL could drive at roughly $0.85 a request. `resolveApiKey()` now ignores the fallback when `NODE_ENV` or `VERCEL_ENV` is `production` unless `ALLOW_SHARED_API_KEY` is exactly `"true"`. Local development is unaffected, and the eval runner passes its key explicitly so it never relied on the fallback
- **`no_origin_cluster` could fire on correct output** — the check flags two or more elements with both endpoints at (0,0), the signature of coordinates that failed to parse upstream, but columns legitimately carry `start === end` and the prompt asks for the layout centred on the origin, so a plan with two columns at the exact centre tripped it. Columns are now excluded
- **`has_roof` penalised the correct answer on floor plans** — the MEASURED DRAWING ruleset tells the model to add a roof only when the drawing shows one, and a bare CAD plan does not, but `has_roof` scored every roofless building as a failure. The captured runs show the signal fully inverted: the run that obeyed the prompt and emitted no roof was marked FAIL, while the two runs that invented a roof passed. The `orthographic-plan` fixtures now skip the check, so it is reported as informational rather than steering prompt tuning toward disobeying the prompt
- **Eval scoring read its own output back in** — `score.mjs` globbed `*.json` in the run directory and wrote `summary.json` into that same directory, so every re-score ingested the previous summary as if it were a model response. It has no `ok` field, so each pass reported a phantom request failure and nested the entire previous summary inside the new one: one run's summary grew from 3.3 KB to 23.7 KB over three scoring passes. Since the harness advertises re-scoring as free and repeatable, this corrupted the exact output it exists to produce. Only capture records (`<fixtureId>.<n>.json`) are read now, and a file that is not a capture record is skipped with a warning rather than counted as a failure
- **Malformed generation requests returned 500** — both proxies read `body.images.length` before validating anything, so a request without an `images` array threw a `TypeError` and surfaced as a 500 carrying a raw JavaScript message. `validateGenerateRequest` in `server/aiConfig.ts` now rejects a missing or empty `images` array, more than `MAX_IMAGES` (5) images, and unsupported media types with a 400 and a specific message. The image cap also bounds what a single direct request can bill when a deployment sets the `ANTHROPIC_API_KEY` fallback
- **Corner doors lost their wall opening** — the guard added alongside the misplaced-opening fix required an opening to fit the wall span within 1cm, but a door hard against a corner legitimately overhangs the wall centerline: the eval corpus shows overhangs of 4–10cm on doors that are otherwise correct, and `computeWallJoins` extends the drawn wall past that length anyway. Those doors rendered embedded in solid wall. An overhang within `max(thickness, 0.15)` is now nudged back inside the span, and only an opening that misses the wall outright, or is wider than it, is dropped
- **`opening_within_span` reported false failures** — the eval check used a 1cm tolerance where the renderer now absorbs a small overhang, so it flagged three captures across two fixtures for overhangs of 5–10cm that render correctly. It mirrors the renderer's tolerance, and every capture taken after the MEASURED DRAWING prompt fix now scores clean
- **`hand-sketch` fixture asserted a contested storey count** — the fixture demanded exactly 1 floor, but the drawing shows a columned belvedere raised above the roof balustrade and a staircase drawn in the plan to serve it, so the model's answer of 2 was defensible. Scoring the ambiguity told you nothing about the model; the fixture now asserts `floorsRange: [1, 2]` and the note records why
- **AI fabricated storeys and windows from floor plans** — the system prompt was written for the "photograph of a house" case and applied the same inference to every input, so a single-storey CAD plan with no windows drawn produced a three-storey building with 18 windows; the prompt now classifies the input as a MEASURED DRAWING or a PICTORIAL image first and models drawings literally — same fixture now returns one storey, nine doors, zero windows, and a footprint accurate to the millimetre
- **Runaway numbers truncated whole responses** — structured-output constrained decoding could fall into an unbounded numeric literal (observed: `"numRisers":16.00000000000000041e-1100000…`) and burn the entire token budget, discarding an otherwise valid building; `numRisers` is now typed `integer`, which the number grammar cannot escape, and `salvageTruncatedElements` recovers the complete leading elements from any response that is still cut off
- **Truncated responses reported as total failures** — a cut-off response threw "AI did not return valid JSON" and lost every element; the leading complete elements are now salvaged and the modal says the building is partial. `stop_reason` is returned by both proxies so hitting the output limit is visible rather than a mystery
- **Unclosed wall corners** — near-coincident wall endpoints are snapped to a shared point per level before openings are placed, since models place corners within centimetres but rarely emit identical floats
- **Silently discarded doors and windows** — `validateAndFixElements` dropped every opening whose `hostWallId` did not resolve to a generated wall, with no warning, and then reported the reduced count as if it were the model's output; discarded elements are now counted and surfaced in the AI modal
- **Wall openings cut at bogus positions** — `computeWallOpenings` projected an opening onto its host wall using only the parallel component, so a door positioned metres away from its wall still cut a hole there, and an opening past the wall's end produced a hole outside the wall outline; openings are now rejected unless they sit on the wall and fit within its span
- **Tee fittings rendered as cubes** — `buildFittingMesh` built two cylinders for a tee, rotated one, then discarded both and rendered a plain `BoxGeometry`; the two geometries were allocated on every call and never disposed. A tee is now a run cylinder with a rotated branch mesh, matching how `buildWindowMesh` assembles its frame bars
- **Leaked window frame materials** — `buildWindowMesh` allocated a fresh `MeshStandardMaterial` for the frame on every call and never disposed it, so GPU memory grew with each scene sync; the material is now a shared module-level constant
- **Unknown material keys rendered invisible meshes** — `getMaterialForElement` indexed `MATERIAL_LIBRARY` directly and returned `undefined` for an unrecognised key; it now falls back to `concrete`
- **Undiagnosable persistence failures** — `loadProject`, the debounced auto-save, and `clearProject` all swallowed rejections with an empty `.catch(() => {})`, so an IndexedDB failure discarded the user's project with no trace; all three now log a warning

### Docs
- **README corrected and expanded** — the Build Plan told readers to "Initialize Next.js", contradicting the tech stack table in the same file three sections above; the project has always been Vite. Phases 1 and 2 were also entirely unchecked despite being shipped (the IFC drag-and-drop zone, the PDF.js viewer, the Fabric.js markup layer, and the Cloud and Callout tools all exist), and Phase 3 conflated Supabase with save/load, which ships today against IndexedDB. Added a Getting Started section with the command table, since `test:e2e` and the eval commands were documented nowhere a newcomer would look, and flagged that `eval:run` spends real credits while `eval:score` does not. Tech stack table gained Testing (Playwright) and Persistence (IndexedDB) rows

### Removed
- **Dead `ELEMENT_MATERIALS` export** — roughly 80 lines of `MeshStandardMaterial` instances left over from the `MATERIAL_LIBRARY` refactor, constructed at module load and referenced nowhere; per-type defaults live in `DEFAULT_ELEMENT_MATERIAL` in `src/types.ts`, and `CLAUDE.md` step 4 pointed at the dead export until now

### Added
- **`.env.example`** — documents the optional `ANTHROPIC_API_KEY` environment variable (fallback when no user key provided)
- **Vite API proxy plugin** — `server/apiProxy.ts` adds a `/api/generate-floor-plan` middleware endpoint for development
- **Vercel serverless function** — `api/generate-floor-plan.ts` handles the same endpoint in production on Vercel
- **Shared system prompt** — `server/prompt.ts` extracts the AI system prompt used by both dev proxy and Vercel function
- **3D ViewCube** — Revit-style navigation cube overlay in the top-right of 3D viewports; click faces to snap to axial views (Top/Bottom/Front/Back/Left/Right), edges for 2-axis diagonal views, or corners for isometric views; cube orientation mirrors the main camera in real-time, and a Home button resets to the default 3D perspective
- **Multi-image AI generation** — AI Image to BIM modal now supports uploading up to 5 images of the same building from different angles; cross-references all images for more accurate and complete building models
- **Navigation toolbar** — View ribbon tab now includes Zoom In, Zoom Out, and Fit All buttons for easier viewport navigation, especially on trackpads
- **Z key zoom-to-selection** — pressing Z with a selected element zooms/flies the camera to that element (like Revit's zoom-to-selection)

### Added
- **Documentation validation hook** — PreToolUse hook in `.claude/settings.json` now blocks commits when documentation is outdated; checks CHANGELOG.md on every commit, and checks CLAUDE.md when core files (types, viewer, ribbon, editor, routes) are changed
- **`/validate-docs` slash command** — comprehensive documentation validator that checks README.md, CLAUDE.md, CHANGELOG.md, and ROADMAP.md against the actual codebase and auto-fixes drift

### Changed
- **CLAUDE.md documentation policy** — expanded from changelog-only policy to cover all documentation files; added table of docs with update triggers and slash command reference

### Added
- **Room element** — new two-click Room element type for defining enclosed spaces; displays a semi-transparent blue floor area with wireframe volume outline; Properties panel shows computed Area (m²), Perimeter (m), and Volume (m³); accessible from Architecture ribbon's "Room & Area" group or Shift+M shortcut
- **3D Dimension tool** — two-click linear measurement tool in the 3D viewport; creates persistent yellow dimension lines with distance labels, extension ticks at endpoints, and midpoint measurement text; accessible from Annotate ribbon's "3D Measure" group
- **Visibility/Graphics overrides** — per-category show/hide toggles in the new Manage ribbon tab; click any element type badge to toggle visibility; supports wireframe and transparency control; hidden categories are reflected in real-time in the 3D viewport
- **Right-click context menus** — context-sensitive right-click menus on 3D elements with Select, Copy, Select All (by type), Hide Category, and Delete actions; includes keyboard shortcut hints and danger styling for destructive actions
- **Revit-style tooltips** — hover tooltips on all ribbon toolbar buttons showing the tool name and keyboard shortcut; styled to match Revit's tooltip appearance with title and shortcut hint
- **Saved/Named camera views** — save and restore camera positions via the Manage ribbon tab; saved views appear as clickable buttons; right-click to delete a saved view
- **Element grouping** — group multiple selected elements together via the Modify ribbon tab; grouped elements share a groupId; ungroup to remove the association; Group button requires 2+ selected elements
- **Schedule views** — auto-generated tabular schedules for Door, Window, Room, Wall, and All element types; accessible from the Manage ribbon tab; shows element properties in a sortable table with type-specific columns (area for rooms, length for walls, host wall for doors/windows)
- **Manage ribbon tab** — new 5th ribbon tab housing Visibility/Graphics, Saved Views, and Schedules tool groups
- **Room shortcuts** — Shift+M keyboard shortcut for room creation tool

### Fixed
- **AI Image to BIM generation** — fixed JSON parse failure when AI returns explanatory text instead of element data; strengthened system prompt to always return JSON; improved error messages to show the actual AI response; added support for generating BIM elements from exterior photos and non-floor-plan images
- **Plan View projection** — Plan View now uses true orthographic projection instead of perspective, making elements appear flat/2D as expected in architectural plan views
- **Elevation view projection** — All elevation views (Front, Back, Left, Right) now use orthographic projection for accurate 2D representation

### Added
- **Material options** — elements now support per-element material assignment with 8 basic materials (Concrete, Wood, Steel, Glass, Brick, Stone, Drywall, Aluminum); editable via a dropdown in the Properties Panel's new Material section
- **Section view** — new Section view type with a clipping plane that cuts through the model; accessible from the View ribbon tab's "Add View" group and the pane type dropdown
- **2D navigation mode** — Plan and Elevation views now lock camera rotation, allowing only pan and zoom for a true 2D drafting experience

### Changed
- **Camera system** — upgraded from SimpleCamera to OrthoPerspectiveCamera for proper orthographic/perspective switching and navigation mode support
- **Grid rendering** — grid fade effect is disabled in orthographic views for cleaner appearance

### Added
- **Gridlines** — user-created reference lines for design alignment; two-click placement via the Architecture ribbon's Reference group; gridlines render as dashed cyan lines with labeled bubbles extending across the viewport
- **Snap to gridlines** — when snap is enabled, elements automatically snap to nearby gridlines (takes priority over regular grid snap); works with all element types during creation
- **Wall alignment mode** — press Tab during wall creation to cycle alignment (left / center / right) relative to gridlines; offsets the wall by half its thickness so the chosen face aligns with the gridline
- **Gridline persistence** — gridlines are saved/restored with auto-save and project export/import
- **Ortho constraint (Shift)** — hold Shift during two-click placement (walls, gridlines, beams, etc.) to constrain the line to be perfectly horizontal or vertical based on the dominant direction

### Added
- **Multi-select** — Ctrl+click to add/remove elements from selection; box/marquee select by click-dragging in the 3D viewport to select all elements within the rectangle; multi-select highlights all selected elements in the Project Browser tree and shows a selection summary with type counts in the Properties panel
- **Bulk delete** — delete all selected elements at once via Delete/Backspace key or the bulk delete button in the Properties panel; arrow key movement now applies to all selected elements simultaneously
- **Dimension labels** — selected elements display floating dimension labels in the 3D viewport showing key measurements (length, height, width, depth) as canvas-textured sprites positioned above each element
- **Story navigation** — click the arrow icon next to any level in the Levels tab of the Project Browser to fly the 3D camera to that story's height

### Changed
- **Status bar** — updated keyboard shortcuts hint to show multi-select shortcut (Ctrl+Click); shows count of selected elements when more than one is selected

### Added
- **AI Image-to-BIM** — Upload a floor plan image (photo, sketch, or CAD drawing) and generate walls, doors, and windows using Claude's vision API; includes API key management, image preview, scale hints, element preview before applying, and full batch undo/redo support; accessible from the "AI" group in the Architecture ribbon tab
- **Multi-window views** — Revit-style multi-pane viewport system supporting up to 4 simultaneous views; layout presets (Single, 2-Up, 3-Up, 4-Up) accessible from the View ribbon tab or keyboard shortcuts 1-4; each pane can independently be set to 3D View, Plan View, Front/Back/Left/Right Elevation, or 2D Sheet via a dropdown in the pane header; panes can be closed individually and new views added from the "Add View" ribbon group
- **Project persistence (auto-save)** — all BIM elements, markups, and levels are automatically saved to IndexedDB and restored on page load; no more losing work on browser refresh
- **Project export/import** — export projects as JSON files and re-import them; New/Open/Save buttons in the Quick Access bar
- **Element manipulation tools** — Move (+/-X, +/-Z), Rotate (+/-45°), Copy, and Mirror tools in the Modify ribbon tab for transforming placed elements
- **Arrow key movement** — move selected elements with arrow keys (step size follows snap grid setting)
- **Wall boolean cutouts** — doors and windows now cut proper openings in their host wall geometry using ExtrudeGeometry with Shape holes, making them visible from the front of the wall
- **Project Browser element selection** — clicking an authored element in the Project Browser tree now selects it, shows its properties in the Properties panel, and flies the 3D camera to it

### Changed
- **Redesigned PDF/2D Sheet layout** — replaced side-by-side split view default with tabbed viewport; 3D View is now the default with "3D View" / "2D Sheet" tabs for switching; split view remains available via the View ribbon tab
- **Viewer3D refactored** — extracted all geometry builders (20 build functions, materials, wall openings) into `src/components/geometryBuilders.ts`, reducing Viewer3D from ~2,325 to ~1,210 lines

### Fixed
- **Selection highlight offset** — highlight mesh now copies position/rotation/scale directly for scene-root meshes and decomposes matrixWorld for nested IFC children, fixing the offset rendering
- **Door/window selection inside walls** — raycast now prefers doors and windows over their host wall when both are hit at similar distances, so clicking on a door actually selects the door instead of the wall behind it

### Docs
- **CLAUDE.md rewrite** — updated development guide to reflect the Revit-style architecture: ribbon toolbar, Project Browser/Properties panels, wall boolean system, element selection flow, and keyboard shortcuts reference

### Changed
- **Revit-inspired UI redesign** — complete overhaul of the application layout and styling to match Autodesk Revit's UX patterns
- **Ribbon toolbar** — replaced flat creation toolbar with a tabbed ribbon (Modify, Architecture, Annotate, View tabs) featuring SVG icons and grouped tool panels like Revit
- **Quick Access bar** — added Revit-style quick access toolbar above the ribbon with app title, undo/redo buttons
- **Project Browser panel** — redesigned left sidebar as a Revit-style Project Browser with Elements, Markups, and Levels tabs
- **Properties panel** — added dedicated right-side Properties panel with collapsible sections (Identity Data, Dimensions, Constraints, Location) matching Revit's property grid layout
- **Status bar** — added bottom status bar showing active tool, snap state, current level, element count, and keyboard shortcuts
- **Viewport labels** — added floating "3D View" and "2D Sheet" labels on viewports like Revit's viewport titles
- **Updated color scheme** — shifted from flat slate to a Revit-inspired dark theme with better visual hierarchy using CSS custom properties
- **Typography** — switched to Segoe UI font family to match Revit's interface feel
- **Property grid inputs** — Revit-style row-based property editing with label/value columns and unit suffixes
- **Custom scrollbars** — thin scrollbars matching the dark theme
- **Annotation tools in ribbon** — moved 2D annotation tools from separate toolbar into the Annotate ribbon tab

### Added
- **Roof element** — pitched roof from two-click rectangular outline with ridge height, thickness, and overhang parameters
- **Stair element** — stepped geometry between two points with configurable riser height, tread depth, width, and number of risers
- **Railing element** — posts with top and mid rails along a path (two-click), adjustable height and post spacing
- **Curtain Wall element** — glass panel grid with aluminum mullions (two-click), parametric panel size and mullion thickness
- **Window element** — glass pane with frame, snaps to existing walls (with sill height parameter)
- **Beam element** — horizontal structural member between two points (height/width params)
- **Ceiling element** — flat panel placed at room height from two-click perimeter (like inverted slab)
- **Table preset** — rectangular surface with four legs (height/width/depth params)
- **Chair preset** — seat with backrest and four legs (parametric dimensions)
- **Shelving preset** — multi-shelf unit with side panels and back (parametric dimensions)
- **Desk element** — straight or L-shaped desk with legs (height/width/depth params)
- **Toilet fixture** — basic toilet geometry with bowl and tank (bathroom fixtures)
- **Sink fixture** — pedestal sink with basin and faucet (bathroom fixtures)
- **Duct element** — rectangular cross-section duct between two points (MEP)
- **Pipe element** — cylindrical pipe between two points with diameter param (MEP)
- **Light Fixture element** — ceiling-mounted panel light with emissive glow (MEP)
- **Categorized creation toolbar** — tools organized into Structure, Openings, Furniture, Fixtures, and MEP groups
- **Fixtures tool group** — toilet and sink in dedicated Fixtures category
- **MEP tool group** — duct, pipe, and light fixture in dedicated MEP category
- **Undo/Redo system** — full command stack for element creation, deletion, and parameter updates (Ctrl+Z / Ctrl+Y)
- **Snap-to-grid** — configurable grid snapping (0.25m / 0.5m / 1m) with toggle button and G hotkey
- **Level manager** — define named levels (Ground, Level 1, Level 2, Roof) with adjustable heights
- **Level selector** — dropdown to set active level (new elements placed at that height)
- **Level visibility toggle** — show/hide elements per level
- **Add/remove levels** — dynamically add or remove building levels
- **Keyboard shortcuts** — Shift+key for all creation tools, 1/2/3 for view modes, Delete for element removal, Escape to deselect
- **Freehand annotation** — pressure-sensitive freehand drawing tool for PDF markup
- **Rectangle annotation** — rectangle shape markup tool
- **Circle annotation** — circle/ellipse shape markup tool
- **Polyline annotation** — multi-point connected line markup tool
- **Highlight annotation** — semi-transparent rectangular highlight for text emphasis
- **Measurement annotation** — distance measurement tool with dashed line and label
- **Grouped annotation toolbar** — tools organized into Draw, Shapes, and Measure groups
- **Toast notifications** — success/error/info messages for element creation and deletion
- **Keyboard shortcuts hint** — persistent hint bar showing available shortcuts
- **CHANGELOG.md** — project changelog following Keep a Changelog format
- **Claude Code changelog hook** — automatic reminder to update changelog on every commit

### Fixed
- **Window rendering** — frame bars now render as child meshes of the glass pane (previously dead code)
- **Sidebar icons** — added TYPE_ICONS entries for all element types including new MEP and fixture types
- **Door visibility** — darker wood color (0x5c3317) and thicker geometry (0.12m) so doors stand out against walls

---

## [0.4.0] - 2025-06-15

### Added
- **Smart door placement** — doors auto-snap to wall faces like Revit
- Door position constrained to wall bounds (accounting for door width)
- Wall-face raycasting for precise door positioning
- Door rotation auto-aligned with host wall direction
- Invalid placement ghost (red tint) when not hovering over a wall
- `hostWallId` tracking for door-to-wall relationships

---

## [0.3.0] - 2025-06-14

### Added
- **BIM authoring engine** — create parametric building elements in 3D
- Wall creation (two-click, with height/thickness params)
- Column creation (single-click, with height/radius params)
- Slab creation (two-click rectangular, with thickness param)
- Door creation (single-click, with height/width params)
- **Ghost preview** — semi-transparent preview mesh follows cursor during placement
- **Snap indicator** — green sphere shows precise placement point on ground plane
- **Element editor** — sidebar panel for editing name, parameters, level, and deletion
- **Creation toolbar** — top toolbar for selecting element type to place
- Default parametric values for all element types
- Per-element-type materials (wall=off-white, column=silver, slab=concrete, door=wood)

---

## [0.2.0] - 2025-06-13

### Added
- **Trace Engine** — bi-directional 2D markup to 3D element linking
- Click 2D markup to fly camera to linked 3D element
- Click 3D element to highlight linked 2D markups
- Auto-link new markups to currently selected 3D element
- Markup-to-element GUID linking with `linkedBimGuid` field
- **2D annotation tools** — Cloud, Arrow, Callout, Text tools via Fabric.js
- **Markup management** — status tracking (Open/Pending/Resolved), search, delete
- **Split-pane layout** — 3D + 2D side-by-side with view mode toggle (Split/3D/2D)
- **PDF viewer** — PDF.js integration with page navigation and zoom
- **3D element selection** — click to select, highlight, and inspect properties
- **Spatial tree sidebar** — navigate IFC model hierarchy

---

## [0.1.0] - 2025-06-12

### Added
- **3D IFC viewer** — load and render IFC files using @thatopen/components + Three.js
- Drag-and-drop IFC file loading
- Camera auto-fit to model bounds
- Ground grid overlay
- **Project scaffolding** — Vite + React + TypeScript + TanStack Router
- Tailwind CSS styling with dark theme
- Biome linter/formatter configuration
- File-based routing with TanStack Router
