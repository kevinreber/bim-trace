# Changelog

All notable changes to BIM Trace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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
