# CLAUDE.md - BIM Trace Development Guide

## Project Overview
BIM Trace is a web-native BIM authoring and review platform combining 3D parametric modeling (Revit-style) with 2D PDF annotation (Bluebeam-style) and bi-directional linking.

## Tech Stack
- **Framework**: Vite + React 18 + TypeScript 5
- **Routing**: TanStack Router (file-based)
- **3D Engine**: @thatopen/components (IFC.js) + Three.js
- **2D PDF**: pdfjs-dist
- **2D Annotation**: Fabric.js
- **Styling**: Tailwind CSS
- **Linting**: Biome

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npx @biomejs/biome check src/` — Lint and format check
- `npx @biomejs/biome check --write src/` — Auto-fix lint/format issues

## Key Architecture
- All BIM element types defined in `src/types.ts` (BimElementType, BimElementParams, DEFAULT_PARAMS)
- 3D geometry builders in `src/components/Viewer3D.tsx` (buildWallMesh, buildColumnMesh, etc.)
- Element creation toolbar in `src/components/CreationToolbar.tsx`
- Element editing panel in `src/components/ElementEditor.tsx`
- Main app state managed in `src/routes/index.tsx`

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
9. Add tool entry to `CreationToolbar.tsx`
10. Add type label to `TYPE_LABELS` in `ElementEditor.tsx`
11. Add param fields to `PARAM_FIELDS` in `ElementEditor.tsx`
12. Update CHANGELOG.md

## Conventions
- Use Biome for formatting (not Prettier)
- TypeScript strict mode
- Functional React components with hooks
- No external state management library (React state + props)
- Three.js materials defined as module-level constants
- Element IDs use `crypto.randomUUID()`
