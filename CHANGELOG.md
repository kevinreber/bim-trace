# Changelog

All notable changes to BIM Trace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Window element** — glass pane with frame, snaps to existing walls (with sill height parameter)
- **Beam element** — horizontal structural member between two points (height/width params)
- **Ceiling element** — flat panel placed at room height from two-click perimeter (like inverted slab)
- **Table preset** — rectangular surface with four legs (height/width/depth params)
- **Chair preset** — seat with backrest and four legs (parametric dimensions)
- **Shelving preset** — multi-shelf unit with side panels and back (parametric dimensions)
- **Categorized creation toolbar** — tools organized into Structure, Openings, and Furniture groups
- **CHANGELOG.md** — project changelog following Keep a Changelog format
- **Claude Code changelog hook** — automatic reminder to update changelog on every commit

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
