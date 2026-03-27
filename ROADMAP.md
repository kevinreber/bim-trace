# BIM Trace - Feature Roadmap

> **Goal:** Build a web-native Revit + Bluebeam clone with bi-directional 2D/3D linking.
> Each section below is scoped to roughly one PR. Check items off as they ship.

---

## Current State (Shipped)

- [x] 3D IFC viewer with spatial tree navigation
- [x] 2D PDF viewer with page navigation and zoom
- [x] Annotation tools: Cloud, Arrow, Callout, Text
- [x] Markup management with status tracking (Open/Pending/Resolved)
- [x] Split-pane layout with view mode toggle (Split/3D/2D)
- [x] Trace Engine: bi-directional 2D markup ↔ 3D element linking
- [x] BIM authoring: Wall, Column, Slab, Door with parametric editing
- [x] Ghost preview + snap indicator for element placement
- [x] Element editor (name, params, level, delete)

---

## PR 1 — More Architectural Elements

### New Element Types
- [ ] **Window** — glass pane with frame, placed on existing wall face
- [ ] **Beam** — rectangular/I-profile between two points (horizontal)
- [ ] **Roof** — pitched or flat roof from polygon outline (multi-click perimeter)
- [ ] **Stair** — stepped geometry between two levels (rise/run params)
- [ ] **Railing** — posts + top rail along a path or attached to stair
- [ ] **Ceiling** — flat panel at room height (like inverted slab)
- [ ] **Curtain Wall** — glass panel grid with mullion subdivisions

### Element Presets / Furniture
- [ ] **Table** — rectangular surface on four legs
- [ ] **Chair** — seat + back + four legs
- [ ] **Desk** — L-shaped or straight desk preset
- [ ] **Shelving** — rectangular unit with shelves
- [ ] **Toilet/Sink** — basic bathroom fixtures
- [ ] **Preset library UI** — categorized panel to pick from (Furniture, Fixtures, MEP)

---

## PR 2 — Authoring UX Improvements

### Snap & Alignment
- [ ] **Snap-to-grid** — configurable grid (0.25m / 0.5m / 1m) with toggle
- [ ] **Snap-to-element** — endpoints snap to existing walls/columns/edges
- [ ] **Snap-to-axis** — constrain to X or Z axis while drawing (hold Shift)
- [ ] **Grid overlay** — visible ground grid with adjustable spacing

### Manipulation Tools
- [ ] **Move tool** — drag elements to reposition on the ground plane
- [ ] **Rotate tool** — rotate elements around Y axis (free or 15° snaps)
- [ ] **Copy/Duplicate** — clone element with its params at a new position
- [ ] **Mirror** — flip element across an axis

### Editing
- [ ] **Undo/Redo** — command stack for all authoring actions
- [ ] **Multi-select** — box select or Ctrl+click to select multiple elements
- [ ] **Bulk delete** — delete all selected elements
- [ ] **Dimension labels** — show length/height on hover/selection in 3D

### Multi-Level Support
- [ ] **Level manager** — define levels (Ground, Level 1, Level 2, Roof) with heights
- [ ] **Level selector** — dropdown to set active level (new elements placed at that Y)
- [ ] **Level visibility toggle** — show/hide elements per level
- [ ] **Story navigation** — click level in sidebar to fly camera to that story

---

## PR 3 — Advanced 2D Annotation (Bluebeam Parity)

### Drawing Tools
- [ ] **Freehand pen** — pressure-sensitive freehand drawing
- [ ] **Rectangle** — simple rectangle markup
- [ ] **Circle/Ellipse** — circular markup
- [ ] **Polyline** — multi-point connected line
- [ ] **Polygon** — closed multi-point shape
- [ ] **Highlight** — semi-transparent rectangular highlight
- [ ] **Strikethrough** — line through text regions

### Measurement Tools
- [ ] **Scale calibration** — set known distance on PDF to calibrate
- [ ] **Linear measurement** — measure distance between two points
- [ ] **Area measurement** — measure area of a polygon
- [ ] **Perimeter measurement** — measure perimeter of a shape
- [ ] **Angle measurement** — measure angle between two lines
- [ ] **Measurement display** — show values in calibrated units (ft, m)

### Markup Enhancements
- [ ] **Comment threads** — reply to markups with threaded discussion
- [ ] **Markup editing** — edit comment text after creation
- [ ] **Markup color picker** — choose color per markup
- [ ] **Markup layers** — organize markups into named layers
- [ ] **Markup filtering** — filter by status, type, author, layer
- [ ] **Markup search** — search markups by comment text

### PDF Features
- [ ] **Version overlay** — compare two versions of a PDF side-by-side or overlaid
- [ ] **Multi-sheet support** — load multiple PDFs as sheets within a project
- [ ] **Sheet index** — sidebar list of all loaded sheets
- [ ] **Thumbnail navigation** — page thumbnail strip for quick navigation

---

## PR 4 — Data Persistence & Backend

### Supabase Setup
- [ ] **Supabase project** — initialize with PostgreSQL database
- [ ] **Database schema** — projects, markups, bim_elements, sheets tables
- [ ] **Row-level security** — per-user data isolation policies
- [ ] **Supabase client** — configure client with env vars

### Save / Load
- [ ] **Auto-save** — debounced save of workspace state on changes
- [ ] **Manual save** — explicit save button with confirmation
- [ ] **Load project** — open existing project from saved state
- [ ] **Project list** — dashboard showing all user projects
- [ ] **Project metadata** — name, description, created/updated timestamps

### File Storage
- [ ] **IFC upload** — upload .ifc files to Supabase Storage
- [ ] **PDF upload** — upload .pdf files to Supabase Storage
- [ ] **File size limits** — enforce max file size (e.g. 100MB)
- [ ] **File versioning** — track uploaded file versions

---

## PR 5 — User Authentication & Profiles

### Auth
- [ ] **Sign up** — email/password registration
- [ ] **Sign in** — email/password login
- [ ] **OAuth** — Google and GitHub sign-in
- [ ] **Password reset** — forgot password flow
- [ ] **Session management** — token refresh, logout
- [ ] **Auth guard** — redirect unauthenticated users to login

### User Profile
- [ ] **Profile page** — display name, email, avatar
- [ ] **Edit profile** — update name, avatar
- [ ] **User settings** — default units (metric/imperial), theme preference
- [ ] **Account deletion** — delete account and all associated data

### Project Permissions
- [ ] **Project ownership** — creator is owner
- [ ] **Share project** — invite by email with role (viewer/editor)
- [ ] **Role-based access** — viewers can comment, editors can modify
- [ ] **Public/private toggle** — make project publicly viewable via link

---

## PR 6 — Real-Time Collaboration

### WebSocket Infrastructure
- [ ] **Convex or Supabase Realtime** — evaluate and pick a real-time backend
- [ ] **Presence system** — show who's online in a project (avatar + cursor)
- [ ] **Cursor sharing** — show collaborator cursors in 2D and 3D views
- [ ] **Conflict resolution** — last-write-wins or CRDT for concurrent edits

### Collaborative Editing
- [ ] **Live markup updates** — see other users' markups appear in real-time
- [ ] **Live element updates** — see authored element changes in real-time
- [ ] **Selection awareness** — see what elements other users have selected
- [ ] **Activity feed** — sidebar feed of recent actions by collaborators
- [ ] **Notifications** — in-app alerts for comments, status changes, mentions

---

## PR 7 — Export & Import

### Export
- [ ] **Export to PDF** — generate summary report of all markups with screenshots
- [ ] **Export to BCF** — BIM Collaboration Format for Revit round-tripping
- [ ] **Export to IFC** — save authored elements as valid .ifc file
- [ ] **Export markups CSV** — tabular export of all markups
- [ ] **Export element schedule** — quantity takeoff table (walls, doors, etc.)
- [ ] **Print view** — print-optimized layout for PDF sheets with markups

### Import
- [ ] **Import BCF** — load BCF issues as markups linked to 3D elements
- [ ] **Import CSV markups** — bulk import markups from spreadsheet
- [ ] **Multiple IFC files** — load multiple .ifc models into one scene
- [ ] **DWG/DXF support** — basic 2D CAD file viewing (stretch goal)

---

## PR 8 — 3D Viewer Enhancements

### Visualization
- [ ] **Section plane** — clip model with a movable section plane
- [ ] **X-ray / transparency mode** — make all elements semi-transparent
- [ ] **Wireframe mode** — toggle wireframe rendering
- [ ] **Element visibility** — hide/show by IFC category (walls, doors, etc.)
- [ ] **Color-by-property** — color elements by status, material, or custom property
- [ ] **Shadow mapping** — toggle realistic shadows
- [ ] **Ambient occlusion** — SSAO for depth perception

### Camera & Navigation
- [ ] **Named views** — save and restore camera positions (e.g. "North Elevation")
- [ ] **Orbit/Pan/Zoom presets** — top, front, left, right, isometric views
- [ ] **First-person walkthrough** — WASD navigation at eye height
- [ ] **Fit-to-selection** — zoom to fit selected element(s)
- [ ] **Section box** — define a 3D bounding box to isolate a region

### Model Intelligence
- [ ] **Clash detection** — highlight overlapping elements
- [ ] **Distance measurement** — measure between two 3D points
- [ ] **Volume calculation** — calculate volume of selected elements
- [ ] **Surface area** — calculate area of selected faces

---

## PR 9 — Performance & Caching

### Rendering Performance
- [ ] **Level-of-detail (LOD)** — simplify distant geometry
- [ ] **Frustum culling** — skip rendering off-screen elements
- [ ] **Instanced rendering** — batch identical geometries (e.g. repeated columns)
- [ ] **Web Worker parsing** — offload IFC parsing to worker thread
- [ ] **Progressive loading** — stream large IFC files incrementally

### Caching
- [ ] **IndexedDB cache** — cache parsed IFC models locally for fast reload
- [ ] **Service Worker** — offline support for cached projects
- [ ] **Thumbnail cache** — pre-render 3D thumbnails for project list
- [ ] **PDF page cache** — cache rendered PDF pages as images

### Bundle & Load Time
- [ ] **Code splitting** — dynamic import for PDF.js, Three.js, Fabric.js
- [ ] **Tree shaking** — ensure unused Three.js modules are excluded
- [ ] **Lazy loading** — load 2D/3D engines only when pane is visible
- [ ] **Asset CDN** — serve static assets from edge CDN

---

## PR 10 — UI/UX Polish

### Layout & Navigation
- [ ] **Responsive design** — tablet-friendly layout
- [ ] **Keyboard shortcuts** — hotkeys for all tools (W=wall, C=column, etc.)
- [ ] **Command palette** — Ctrl+K search for actions, elements, markups
- [ ] **Context menus** — right-click menus on elements and markups
- [ ] **Drag-to-resize panes** — adjustable split-pane widths
- [ ] **Dark/light theme** — theme toggle with system preference detection

### Feedback & Discoverability
- [ ] **Toast notifications** — success/error messages for actions
- [ ] **Onboarding tour** — guided walkthrough for first-time users
- [ ] **Tooltips** — hover tooltips on all toolbar buttons
- [ ] **Loading skeletons** — skeleton states for sidebar content
- [ ] **Empty states** — helpful illustrations and CTAs when no data

### Accessibility
- [ ] **ARIA labels** — screen reader support for all interactive elements
- [ ] **Focus management** — keyboard navigation through all UI
- [ ] **Color contrast** — WCAG AA compliance
- [ ] **Reduced motion** — respect prefers-reduced-motion

---

## PR 11 — MEP (Mechanical, Electrical, Plumbing)

### Mechanical
- [ ] **Duct** — rectangular or circular duct between two points
- [ ] **Duct fitting** — elbow, tee, reducer connectors
- [ ] **Air terminal** — diffuser/grille placed on ceiling

### Plumbing
- [ ] **Pipe** — cylindrical pipe between two points with diameter param
- [ ] **Pipe fitting** — elbow, tee, valve connectors
- [ ] **Fixtures** — sink, toilet, urinal presets

### Electrical
- [ ] **Cable tray** — rectangular tray between two points
- [ ] **Conduit** — small-diameter pipe for wiring
- [ ] **Electrical panel** — wall-mounted box
- [ ] **Light fixture** — ceiling-mounted preset
- [ ] **Switch/Outlet** — wall-mounted presets

### MEP Visualization
- [ ] **System color-coding** — color by system (HVAC=blue, plumbing=green, elec=red)
- [ ] **MEP layer toggle** — show/hide entire MEP discipline
- [ ] **Clash detection** — highlight MEP vs structural clashes

---

## PR 12 — Advanced Collaboration & Workflows

### Issue Tracking
- [ ] **Issue creation** — create issues from markups with assignee + priority
- [ ] **Issue board** — Kanban-style board (Open → In Progress → Resolved)
- [ ] **Due dates** — set deadlines on issues
- [ ] **Labels/tags** — categorize issues (structural, MEP, architectural)
- [ ] **Issue linking** — link issues to specific 3D elements and 2D markups

### Review Workflows
- [ ] **Review sessions** — create a named review session with invited reviewers
- [ ] **Review status** — track review completion per reviewer
- [ ] **Approval flow** — submit for review → approve/reject → revise cycle
- [ ] **Change log** — auto-generated log of all changes between reviews

### Integrations
- [ ] **Slack notifications** — post updates to Slack channel
- [ ] **Email digests** — daily/weekly summary of project activity
- [ ] **Webhook API** — fire webhooks on markup/issue events
- [ ] **REST API** — public API for third-party integrations

---

## PR 13 — Mobile & Tablet Support

- [ ] **Touch gestures** — pinch-to-zoom, two-finger pan in 3D and 2D
- [ ] **Mobile layout** — stacked (not split) view for small screens
- [ ] **Bottom sheet navigation** — mobile-friendly tab navigation
- [ ] **Offline mode** — cache project locally, sync when back online
- [ ] **PWA** — installable progressive web app with app icon
- [ ] **Camera capture** — take photos from device camera and attach to markups

---

## Technical Debt & Infrastructure (Ongoing)

- [ ] **Testing** — unit tests (Vitest), component tests (Testing Library), E2E (Playwright)
- [ ] **CI/CD** — GitHub Actions for lint, type-check, test, build, deploy
- [ ] **Error tracking** — Sentry integration for runtime errors
- [ ] **Analytics** — basic usage tracking (page views, feature usage)
- [ ] **Logging** — structured logging for debugging
- [ ] **Documentation** — JSDoc on public APIs, architecture decision records
- [ ] **Monorepo** — extract shared types/utils if backend is added
- [ ] **API rate limiting** — protect backend endpoints
- [ ] **File validation** — validate uploaded IFC/PDF files server-side
- [ ] **Database migrations** — versioned schema migrations
- [ ] **Backup strategy** — automated database backups
- [ ] **Environment management** — dev/staging/prod environment configs
