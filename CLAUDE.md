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

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npx @biomejs/biome check src/` — Lint and format check
- `npx @biomejs/biome check --write src/` — Auto-fix lint/format issues

## Key Architecture

### Layout (Revit-inspired)
```
┌─ Quick Access Bar (undo/redo, app title) ──────────────────────┐
├─ Ribbon Tabs (Modify | Architecture | Annotate | View) ────────┤
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

### UI Components
- **`src/components/RibbonToolbar.tsx`** — Tabbed ribbon toolbar (Modify/Architecture/Annotate/View) with SVG icons and grouped tool panels
- **`src/components/Sidebar.tsx`** — Project Browser (left panel) + Properties Panel (right panel), exported as `ProjectBrowser` and `PropertiesPanel`
- **`src/components/ElementEditor.tsx`** — Revit-style property grid with collapsible sections (Identity Data, Dimensions, Constraints, Location)

### 3D Engine
- **`src/components/Viewer3D.tsx`** — Three.js viewer with:
  - Geometry builders (`buildWallMesh`, `buildDoorMesh`, etc.)
  - Wall boolean cutouts via `ExtrudeGeometry` with Shape holes (`computeWallOpenings`)
  - Element creation (two-click and single-click tools)
  - Raycast selection with door/window priority over host walls
  - Ghost preview system for element placement
  - Wall-snapping for doors/windows (`raycastWalls`)
  - `buildMeshForElement()` dispatch switch

### 2D Engine
- **`src/components/PdfViewer.tsx`** — PDF.js rendering with page navigation and zoom
- **`src/components/AnnotationLayer.tsx`** — Fabric.js canvas overlay for 2D markup drawing
- **`src/components/AnnotationToolbar.tsx`** — Annotation tool selector (legacy, now integrated into ribbon)

### Supporting Components
- **`src/components/PropertyPanel.tsx`** — Read-only IFC element property display
- **`src/components/MarkupList.tsx`** — Markup management with status tracking and 3D linking
- **`src/components/CreationToolbar.tsx`** — Legacy creation toolbar (replaced by RibbonToolbar)

## Changelog Policy
**Every commit MUST include an update to CHANGELOG.md.**

When making changes:
1. Add entries under the `## [Unreleased]` section in `CHANGELOG.md`
2. Use the appropriate subsection: `### Added`, `### Changed`, `### Fixed`, `### Removed`
3. Each entry should start with `- **Feature name** —` followed by a brief description
4. Stage CHANGELOG.md along with your code changes before committing

When releasing a version:
1. Move all `[Unreleased]` entries to a new version section `## [x.y.z] - YYYY-MM-DD`
2. Create a fresh empty `## [Unreleased]` section

## Adding New BIM Elements
1. Add the type to `BimElementType` union in `src/types.ts`
2. Add params interface to `BimElementParams` in `src/types.ts`
3. Add defaults to `DEFAULT_PARAMS` in `src/types.ts`
4. Add material to `ELEMENT_MATERIALS` in `Viewer3D.tsx`
5. Create `buildXxxMesh()` geometry builder in `Viewer3D.tsx`
6. Add case to `buildMeshForElement()` switch in `Viewer3D.tsx`
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
| `Escape` | Deselect tool |
| `Delete` / `Backspace` | Delete selected element |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |

## Conventions
- Use Biome for formatting (not Prettier)
- TypeScript strict mode
- Functional React components with hooks
- No external state management library (React state + props)
- Three.js materials defined as module-level constants
- Element IDs use `crypto.randomUUID()`
- CSS custom properties for theming (defined in `globals.css` `:root`)
- Revit-style UI patterns: ribbon groups with labels, property grid rows, status bar indicators
