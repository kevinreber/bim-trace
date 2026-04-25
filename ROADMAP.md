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
- [x] **Window** — glass pane with frame, placed on existing wall face
- [x] **Beam** — rectangular/I-profile between two points (horizontal)
- [x] **Roof** — pitched or flat roof from polygon outline (multi-click perimeter)
- [x] **Stair** — stepped geometry between two levels (rise/run params)
- [x] **Railing** — posts + top rail along a path or attached to stair
- [x] **Ceiling** — flat panel at room height (like inverted slab)
- [x] **Curtain Wall** — glass panel grid with mullion subdivisions

### Element Presets / Furniture
- [x] **Table** — rectangular surface on four legs
- [x] **Chair** — seat + back + four legs
- [x] **Desk** — L-shaped or straight desk preset
- [x] **Shelving** — rectangular unit with shelves
- [x] **Toilet/Sink** — basic bathroom fixtures
- [x] **Preset library UI** — categorized panel to pick from (Furniture, Fixtures, MEP)

---

## PR 2 — Authoring UX Improvements

### Snap & Alignment
- [x] **Snap-to-grid** — configurable grid (0.25m / 0.5m / 1m) with toggle
- [ ] **Snap-to-element** — endpoints snap to existing walls/columns/edges
- [ ] **Snap-to-axis** — constrain to X or Z axis while drawing (hold Shift)
- [x] **Grid overlay** — visible ground grid with adjustable spacing

### Manipulation Tools
- [ ] **Move tool** — drag elements to reposition on the ground plane
- [ ] **Rotate tool** — rotate elements around Y axis (free or 15° snaps)
- [ ] **Copy/Duplicate** — clone element with its params at a new position
- [ ] **Mirror** — flip element across an axis

### Editing
- [x] **Undo/Redo** — command stack for all authoring actions
- [x] **Multi-select** — box select or Ctrl+click to select multiple elements
- [x] **Bulk delete** — delete all selected elements
- [x] **Dimension labels** — show length/height on hover/selection in 3D

### Multi-Level Support
- [x] **Level manager** — define levels (Ground, Level 1, Level 2, Roof) with heights
- [x] **Level selector** — dropdown to set active level (new elements placed at that Y)
- [x] **Level visibility toggle** — show/hide elements per level
- [x] **Story navigation** — click level in sidebar to fly camera to that story

---

## PR 3 — Advanced 2D Annotation (Bluebeam Parity)

### Drawing Tools
- [x] **Freehand pen** — pressure-sensitive freehand drawing
- [x] **Rectangle** — simple rectangle markup
- [x] **Circle/Ellipse** — circular markup
- [x] **Polyline** — multi-point connected line
- [ ] **Polygon** — closed multi-point shape
- [x] **Highlight** — semi-transparent rectangular highlight
- [ ] **Strikethrough** — line through text regions

### Measurement Tools
- [ ] **Scale calibration** — set known distance on PDF to calibrate
- [x] **Linear measurement** — measure distance between two points
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
- [x] **Section plane** — clip model with a movable section plane
- [ ] **X-ray / transparency mode** — make all elements semi-transparent
- [ ] **Wireframe mode** — toggle wireframe rendering
- [x] **Element visibility** — hide/show by IFC category (walls, doors, etc.)
- [ ] **Color-by-property** — color elements by status, material, or custom property
- [ ] **Shadow mapping** — toggle realistic shadows
- [ ] **Ambient occlusion** — SSAO for depth perception

### Camera & Navigation
- [x] **Named views** — save and restore camera positions (e.g. "North Elevation")
- [x] **Orbit/Pan/Zoom presets** — top, front, left, right, isometric views
- [ ] **First-person walkthrough** — WASD navigation at eye height
- [x] **Fit-to-selection** — zoom to fit selected element(s)
- [ ] **Section box** — define a 3D bounding box to isolate a region

### Model Intelligence
- [x] **Clash detection** — highlight overlapping elements
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
- [x] **Keyboard shortcuts** — hotkeys for all tools (Shift+W=wall, Shift+C=column, etc.)
- [ ] **Command palette** — Ctrl+K search for actions, elements, markups
- [x] **Context menus** — right-click menus on elements and markups
- [ ] **Drag-to-resize panes** — adjustable split-pane widths
- [ ] **Dark/light theme** — theme toggle with system preference detection

### Feedback & Discoverability
- [x] **Toast notifications** — success/error messages for actions
- [ ] **Onboarding tour** — guided walkthrough for first-time users
- [x] **Tooltips** — hover tooltips on all toolbar buttons
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
- [x] **Duct** — rectangular or circular duct between two points
- [ ] **Duct fitting** — elbow, tee, reducer connectors
- [ ] **Air terminal** — diffuser/grille placed on ceiling

### Plumbing
- [x] **Pipe** — cylindrical pipe between two points with diameter param
- [ ] **Pipe fitting** — elbow, tee, valve connectors
- [x] **Fixtures** — sink, toilet, urinal presets

### Electrical
- [ ] **Cable tray** — rectangular tray between two points
- [ ] **Conduit** — small-diameter pipe for wiring
- [ ] **Electrical panel** — wall-mounted box
- [x] **Light fixture** — ceiling-mounted preset
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

## PR 14 — Site Analysis & Environmental Simulation

### Site Setup
- [ ] **Geographic location** — search by address or drop pin on a map (lat/lng)
- [ ] **True north calibration** — set true north direction relative to model
- [ ] **North arrow indicator** — persistent compass overlay on 3D view
- [ ] **Site boundary** — draw property lines on ground plane with area calculation
- [ ] **Terrain/topography** — import elevation data or sculpt terrain mesh
- [ ] **Context buildings** — place massing boxes for neighboring buildings

### Sun Path & Shadow Study
- [ ] **Sun path diagram** — accurate analemma overlay based on lat/lng
- [ ] **Real-time shadows** — directional light matched to actual sun position
- [ ] **Date/time slider** — scrub through any date and time of year
- [ ] **Shadow animation** — animate shadows from sunrise to sunset
- [ ] **Shadow study export** — capture shadow diagrams at solstice/equinox
- [ ] **Solar access analysis** — heatmap showing hours of direct sun per surface
- [ ] **Golden hour indicator** — highlight best natural light windows

### Wind & Climate
- [ ] **Wind rose** — fetch prevailing wind data for location, display as diagram
- [ ] **Natural ventilation analysis** — identify cross-ventilation opportunities
- [ ] **Climate data dashboard** — temperature, humidity, rainfall averages by month
- [ ] **Microclimate zones** — tag outdoor areas as shaded, windy, sheltered

---

## PR 15 — Energy & Sustainability Analysis

### Daylighting
- [ ] **Daylight factor calculation** — estimate natural light levels per room
- [ ] **Window-to-wall ratio** — auto-calculate per facade with target thresholds
- [ ] **Glare analysis** — flag windows with excessive direct sun exposure
- [ ] **Light shelf / overhang simulation** — model shading devices and their effect

### Energy Performance
- [ ] **Envelope U-value calculator** — assign insulation to walls/roofs, compute R-values
- [ ] **Energy use intensity (EUI)** — estimate kBtu/sqft/yr based on envelope + climate
- [ ] **Solar panel optimizer** — calculate roof area eligible for PV, estimate kWh/yr
- [ ] **Passive design advisor** — AI recommends orientation, overhangs, thermal mass
- [ ] **HVAC load estimate** — rough heating/cooling loads from envelope and climate

### Sustainability Tracking
- [ ] **LEED checklist** — interactive checklist with auto-scored items
- [ ] **BREEAM checklist** — UK green building standard tracker
- [ ] **Embodied carbon estimate** — kg CO2 per element based on material type
- [ ] **Carbon dashboard** — total project embodied + operational carbon summary

---

## PR 16 — Construction Documents & Auto-Drawing Generation

### Auto-Generated 2D Drawings from 3D Model
- [ ] **Floor plan generation** — orthographic cut at each level with proper line weights
- [ ] **Reflected ceiling plan** — ceiling layout view (lights, diffusers, soffits)
- [ ] **Building sections** — cut section at any user-defined plane
- [ ] **Elevations** — auto-generate exterior views from N/S/E/W
- [ ] **Detail views** — enlarged views of specific areas at larger scale
- [ ] **Wall sections** — detailed vertical cut showing assembly layers

### Drawing Annotation
- [ ] **Auto-dimensions** — intelligently place dimension strings on walls and openings
- [ ] **Room labels** — auto-detect enclosed rooms, label with name + area
- [ ] **Door/window tags** — auto-tag with type mark and instance number
- [ ] **Section callout markers** — place section cut indicators on plans
- [ ] **Level indicators** — show level markers on sections/elevations
- [ ] **Grid lines** — structural grid with alphanumeric labels (A, B, C / 1, 2, 3)

### Sheet Management
- [ ] **Title block templates** — customizable title blocks with project info
- [ ] **Sheet set organizer** — organize drawings into numbered sheets (A101, A201, S101...)
- [ ] **Viewport placement** — place multiple views on a single sheet at different scales
- [ ] **Revision clouds** — mark changed areas on sheets with revision tracking
- [ ] **Revision schedule** — auto-generated revision table in title block
- [ ] **Print-to-PDF** — export entire sheet set as multi-page PDF

### Schedules & Tables
- [ ] **Door schedule** — auto-generated table of all doors with type, size, hardware
- [ ] **Window schedule** — table of all windows with dimensions, glass type
- [ ] **Room schedule** — table of all rooms with area, floor finish, ceiling height
- [ ] **Finish schedule** — floor, wall, ceiling finishes per room
- [ ] **Custom schedule builder** — pick element type + properties to generate any schedule

---

## PR 17 — Rendering & Visualization

### Materials & Textures
- [ ] **PBR material library** — realistic materials (wood, concrete, glass, steel, brick)
- [ ] **Material browser** — searchable library with preview thumbnails
- [ ] **Custom material upload** — upload texture maps (albedo, normal, roughness)
- [ ] **Manufacturer catalog** — link to real product materials (stretch goal)
- [ ] **Material assignment UI** — click element, pick material from library

### Real-Time Rendering
- [ ] **HDR environment maps** — realistic sky lighting and reflections
- [ ] **Shadow mapping** — soft shadows from sun + artificial lights
- [ ] **Screen-space reflections** — reflective floors and glass
- [ ] **Ambient occlusion (SSAO)** — depth perception in corners and crevices
- [ ] **Depth of field** — focal blur for presentation views
- [ ] **Tone mapping** — filmic or ACES tone mapping for realistic exposure

### Scene Composition
- [ ] **Artificial lighting** — place point, spot, and area lights with intensity/color
- [ ] **People & vegetation** — place 2D billboard or 3D entourage objects
- [ ] **Vehicles** — parked cars for context in site renders
- [ ] **Sky presets** — clear, cloudy, sunset, overcast, night
- [ ] **Time-of-day presets** — morning, noon, golden hour, dusk, night
- [ ] **Seasonal presets** — summer (green trees), autumn (orange), winter (bare/snow)

### Render Output
- [ ] **Screenshot capture** — high-res screenshot at any resolution
- [ ] **Walkthrough animation** — define camera path, export as video (WebM/MP4)
- [ ] **Panorama export** — 360° equirectangular image for VR viewing
- [ ] **Turntable animation** — auto-orbit around model and export
- [ ] **Batch rendering** — queue multiple named views for overnight rendering

---

## PR 18 — AI-Powered Design Tools

### AI Floor Plan Generation
- [ ] **Room program input** — specify rooms (3BR/2BA, 1500sqft, open kitchen)
- [ ] **AI layout generator** — generate multiple floor plan options from program
- [ ] **Layout scoring** — rate options by circulation efficiency, daylight, views
- [ ] **Iterative refinement** — "make the kitchen bigger", "swap bedrooms"
- [ ] **Zoning-aware generation** — respect setbacks, FAR, height limits

### Sketch-to-BIM
- [ ] **Photo-to-plan** — upload photo of hand-drawn sketch, AI converts to walls/doors
- [x] **Image-to-massing** — upload building photo, AI generates approximate 3D model
- [ ] **PDF-to-BIM** — import existing floor plan PDF, AI traces walls into 3D elements
- [ ] **Napkin sketch mode** — draw rough shapes in 2D, AI snaps to clean geometry

### AI Design Assistance
- [ ] **Auto-room detection** — trace enclosed wall loops, identify rooms, calculate areas
- [ ] **Furniture auto-layout** — AI places furniture in rooms based on room type + size
- [ ] **Facade generator** — AI generates facade patterns/options for a given elevation
- [ ] **Structural sizing** — AI suggests beam/column sizes based on spans and loads
- [ ] **Code compliance checker** — AI flags violations against selected building code
- [ ] **Cost optimization** — AI suggests cheaper material alternatives that meet spec
- [ ] **Accessibility checker** — AI verifies ADA compliance (door widths, ramp slopes, turning radii)

### AI Rendering & Visualization
- [ ] **Text-to-render** — describe scene in words, AI generates photorealistic image
- [ ] **Style transfer** — "render in the style of Tadao Ando / Zaha Hadid / Scandinavian minimal"
- [ ] **AI people placement** — auto-populate renders with contextually appropriate people
- [ ] **AI landscaping** — auto-place trees, shrubs, grass based on climate and style
- [ ] **AI sky generation** — generate HDR sky for specific location, date, time, weather
- [ ] **AI upscaling** — render at low-res, AI upscale to 4K with detail enhancement
- [ ] **AI material suggestion** — recommend materials based on climate, budget, aesthetic

### AI Documentation
- [ ] **AI markup summarizer** — summarize all open issues into a narrative report
- [ ] **Auto-spec writer** — generate specification text from element properties
- [ ] **Meeting notes generator** — summarize review session markups into action items
- [ ] **Change narrative** — AI describes what changed between two project versions

---

## PR 19 — Cost Estimation & Construction Scheduling (4D/5D BIM)

### Quantity Takeoff
- [ ] **Auto-quantities** — calculate material quantities from all placed elements
- [ ] **Wall area** — net wall area (subtract openings) per wall type
- [ ] **Floor area** — total slab area per level
- [ ] **Volume calculations** — concrete volume for slabs, walls, columns
- [ ] **Element count** — doors, windows, columns, fixtures per type
- [ ] **Quantity export** — export quantities to CSV/Excel

### Cost Estimation (5D)
- [ ] **Unit cost library** — assign $/sqft, $/linear ft, $/each to element types
- [ ] **Cost rollup** — total project cost auto-calculated from quantities x unit costs
- [ ] **Cost breakdown by category** — structural, architectural, MEP, sitework
- [ ] **Cost comparison** — compare costs between design options
- [ ] **Budget tracking** — set budget target, show over/under
- [ ] **Regional cost data** — adjust unit costs by geographic region

### Construction Phasing (4D)
- [ ] **Phase definition** — define construction phases (foundation, structure, envelope, MEP, finishes)
- [ ] **Element-to-phase assignment** — assign each element to a construction phase
- [ ] **Phase timeline** — Gantt chart showing phase durations
- [ ] **4D animation** — animate model building up phase-by-phase
- [ ] **Critical path** — highlight dependencies between phases
- [ ] **Phase color-coding** — color elements by assigned phase in 3D view

---

## PR 20 — VR / AR & Immersive Experience

### WebXR
- [ ] **VR walkthrough** — enter model in VR headset via WebXR API
- [ ] **AR placement** — place model in real world via phone camera (WebXR AR)
- [ ] **Teleport navigation** — click to teleport in VR
- [ ] **Scale toggle** — switch between 1:1 walkthrough and tabletop model view
- [ ] **VR annotations** — place markups while in VR

### Immersive Presentation
- [ ] **Cinematic mode** — letterbox view with depth-of-field for presentations
- [ ] **Before/after slider** — compare two design options with a slider overlay
- [ ] **Interactive client walkthrough** — shareable link for clients to explore in browser
- [ ] **Presentation mode** — fullscreen with minimal UI, keyboard-driven named views

---

## PR 21 — GIS & Geospatial Integration

### Location Services
- [ ] **Address search** — geocode address to lat/lng via API
- [ ] **Map view** — embed interactive map for site selection
- [ ] **Parcel data** — import property boundary from public GIS data
- [ ] **Zoning overlay** — show zoning designation and setback requirements
- [ ] **Flood zone overlay** — show FEMA flood zone data for site

### Terrain & Context
- [ ] **Elevation data import** — pull DEM/LIDAR terrain data for site
- [ ] **Street view embed** — show Google/Mapillary street view at site location
- [ ] **Satellite imagery** — drape aerial photo on terrain mesh
- [ ] **3D city context** — load OpenStreetMap 3D buildings around site
- [ ] **Tree survey** — import/place existing trees with canopy radius

---

## Revit Parity — Core Modeling & Editing

### Wall System
- [x] **Wall joins & auto-cleanup** — auto-join intersecting walls (T-joints, L-joints, corner cleanup)
- [x] **Trim / Extend walls** — trim wall to another wall or extend to meet
- [x] **Split wall** — split a wall at a clicked point into two segments

### Precision Editing
- [x] **Free-form move with numeric input** — drag elements or type exact distance
- [x] **Rotate with angle input** — free rotation or type exact angle (not just ±45°)
- [x] **Array tool (linear & radial)** — repeat elements in a line or around a center
- [x] **Align tool** — snap-align edges of selected elements
- [x] **Distribute tool** — evenly space selected elements
- [x] **Offset tool** — create parallel copy at a specified distance
- [x] **Pin / Unpin elements** — lock elements in place to prevent accidental edits
- [x] **Copy to clipboard / Paste** — cross-view clipboard with paste at picked point

### Parametric Constraints
- [x] **Dimensional constraints** — lock distances between elements
- [x] **Equality constraints** — "make these equal" for spacing
- [x] **Alignment constraints** — snap-lock to grid/level/other elements
- [ ] **Host relationships** — railings hosted on stairs, fixtures hosted on walls

---

## Revit Parity — Annotation & Documentation

### Dimensioning
- [x] **Linear / Aligned dimension strings** — click-to-place dimension strings in views
- [ ] **Angular dimensions** — measure and display angles between elements
- [x] **Spot elevations** — click a point, show its elevation value

### Tags & Labels
- [x] **Door tags** — auto-labels reading door type mark and instance number
- [x] **Window tags** — auto-labels reading window type and size
- [x] **Room tags** — auto-labels reading room name and computed area
- [ ] **Generic tags** — configurable auto-labels for any element category
- [x] **Keynotes & legends** — standardized annotation with legend tables

### Detail & Drafting
- [x] **Detail lines & filled regions** — 2D-only drafting geometry in views
- [ ] **Detail components** — reusable 2D detail symbols

### Sheet Composition
- [x] **Title block templates** — customizable title blocks with project info fields
- [x] **Place views on sheets** — drag views onto sheets at selectable scales
- [ ] **Revision clouds with revision tracking** — tracked rev history on sheets
- [x] **Sheet numbering & organization** — A101, A201, S101 sheet set management

---

## Revit Parity — Views & Graphics

### View Controls
- [x] **Section box / crop region** — clip the 3D view to a defined region
- [x] **View filters** — color/hide elements by parameter-based rules
- [x] **Detail level (coarse/medium/fine)** — different geometry detail per zoom
- [x] **View templates** — save & apply graphic settings across views
- [ ] **Dependent views** — linked sub-views of a parent view

### Visualization
- [x] **Sun / shadow study** — time-of-day shadow simulation with date slider
- [ ] **Walkthroughs** — animated camera paths through the model
- [ ] **Rendering / ray-traced output** — photorealistic image export

### Phasing
- [x] **Phase filters** — existing vs. new vs. demolished element display
- [x] **Phase assignment** — assign elements to construction phases
- [x] **Phase graphic overrides** — different line styles per phase status

---

## Revit Parity — MEP Connectivity

- [x] **MEP connectivity / routing** — ducts & pipes connect end-to-end
- [x] **Fittings (elbows, tees, reducers)** — auto-placed at duct/pipe connections
- [ ] **Systems (supply/return/exhaust)** — logical grouping of connected MEP elements
- [ ] **Electrical circuits & panel schedules** — circuit assignment, load calculations
- [ ] **Auto-routing** — automatic duct/pipe path finding between equipment

---

## Revit Parity — Scheduling & Data

- [x] **Editable schedules** — edit element parameters directly in the schedule grid
- [ ] **Calculated fields** — custom formulas in schedule columns
- [x] **Schedule filtering & sorting** — group by level, sort by type, filter by param
- [ ] **Material takeoff** — quantities broken down by material, not just element
- [ ] **Multi-category schedules** — schedules spanning multiple element types
- [ ] **Key schedules** — lookup tables for type parameter assignments

---

## Revit Parity — Collaboration & Worksharing

- [ ] **Central model + local copies** — multi-user editing with sync
- [x] **Worksets** — partition model into ownership groups
- [ ] **Synchronize with central** — push/pull changes to shared model
- [x] **Design options** — A/B design alternatives within one project
- [ ] **Linked models** — reference external project files in the scene
- [x] **Clash detection** — flag colliding elements across disciplines

---

## Revit Parity — Project Management

- [x] **Room/area auto-computation** — detect enclosed wall loops, compute room areas
- [x] **Topography / site tools** — terrain mesh modeling
- [ ] **Stair by sketch** — draw stair path, auto-generate geometry from sketch

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
