# 🏗️ BIM Trace

**BIM Trace** is a web-native, open-source BIM authoring and review platform. It combines the parametric intelligence of 3D modeling (Revit-style) with high-fidelity 2D PDF annotation (Bluebeam-style) to create a unified coordination environment.

## 🎯 The Vision
Most BIM tools are too heavy for quick reviews, and most PDF tools lack 3D context. **BIM Trace** solves this by "tracing" 2D markups directly to 3D GlobalIDs (GUIDs), ensuring that every comment is pinned to a physical building asset.

---

## 🛠️ Technical Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | **Vite + React 18 + TypeScript 5** | Framework & Build |
| **Routing** | **TanStack Router** | File-based routing |
| **3D Engine** | **@thatopen/components (IFC.js) + Three.js** | Client-side IFC parsing & 3D rendering |
| **2D Engine** | **PDF.js** | High-performance PDF rendering |
| **Markup Layer** | **Fabric.js** | Vector canvas for "Bluebeam-style" tools |
| **AI** | **Anthropic Claude API** | Image-to-BIM generation |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework |
| **Linting** | **Biome** | Lint & format |
| **Testing** | **Vitest + Playwright** | Unit suite and end-to-end suite |
| **Persistence** | **IndexedDB** | Local auto-save of the workspace |

---

## 📋 Requirements & Features

### 1. 3D BIM Viewer (The "Revit" Side)
* **IFC Loading:** Support for `.ifc` files processed entirely in the browser.
* **Spatial Tree:** Navigate by Site > Building > Storey > Element.
* **Property Inspector:** View all Revit-exported parameters (e.g., Dimensions, Materials, Thermal Ratings).
* **Highlighting:** Visual feedback when an element is selected in 3D or triggered via a 2D link.

### 2. 2D Review Suite (The "Bluebeam" Side)
* **Vector Annotations:** Clouding, Arrows, Callouts, and Text Boxes.
* **Measurements:** Calibrate sheet scale to measure Length and Area.
* **Issue Management:** Assign statuses (Open, Resolved, Pending) to specific markups.
* **Version Overlay:** Basic support for comparing two versions of a PDF.

### 3. The "Trace" Engine (Integration)
* **Bi-directional Linking:** * Click a 2D markup → Rotate/Zoom 3D camera to the linked object.
    * Click a 3D object → Show all associated 2D markups across all sheets.
* **GUID Mapping:** Every markup is stored with the `linked_bim_guid` to ensure data integrity even if filenames change.

---

## 🏗️ Build Plan

See `ROADMAP.md` for the full feature tracker. This is the high-level arc.

### Phase 1: Environment Setup & 3D Core — done
- [x] Initialize Vite with React 18, Tailwind CSS, and TypeScript.
- [x] Integrate `@thatopen/components` (IFC.js) to render a basic 3D scene.
- [x] Create a "Drag & Drop" zone for `.ifc` files.

### Phase 2: 2D Markup Engine — done
- [x] Implement `PDF.js` viewer component.
- [x] Layer `Fabric.js` on top of the PDF canvas.
- [x] Create tools for drawing "Clouds" and "Callouts" with persistent coordinate data.

### Phase 3: Persistence & Backend — partly done
- [x] Save/Load the current workspace state (auto-saved to IndexedDB in the browser).
- [ ] Setup Supabase project and apply the `markups` and `projects` schema.
- [ ] Add User Authentication for private project management.

### Phase 4: Export & Polish
- [ ] **Export to PDF:** Generate a summary report of all issues.
- [ ] **Export to BCF:** Support BIM Collaboration Format for round-tripping back to Revit.
- [x] UI/UX polish for "Split-Pane" navigation (1/2/3/4-up viewport layouts).

---

## 🚀 Getting Started

```bash
npm install
cp .env.example .env     # optional: ANTHROPIC_API_KEY fallback for Image-to-BIM
npm run dev
```

The AI Image-to-BIM feature is bring-your-own-key: paste an Anthropic key into
the modal and it is kept in browser storage and sent per request to a
server-side proxy, so it never appears in the bundle. `ANTHROPIC_API_KEY` is
only a fallback for when no user key is supplied, and it is **ignored in
production** — the generation endpoint has no authentication, so a shared key
on a public deployment would let anyone who finds the URL spend your credits at
roughly $0.85 per request. Set `ALLOW_SHARED_API_KEY=true` to override that, and
only behind access control.

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (type-check + bundle) |
| `npm run lint` | Biome lint & format check |
| `npm test` | Vitest unit suite |
| `npm run test:e2e` | Playwright end-to-end suite (starts the dev server itself) |
| `npm run eval:score` | Score captured AI-generation eval runs (reads from disk, free) |
| `npm run eval:run` | Capture new eval responses — **spends Anthropic credits** |

---

## 🗄️ Database Schema (Supabase/PostgreSQL — planned)

```sql
-- Tables for BIM Trace
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE markups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  drawing_id TEXT, -- Reference to the specific PDF sheet
  coords JSONB NOT NULL, -- {x: float, y: float, type: string}
  linked_bim_guid TEXT, -- The Revit GUID
  comment TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
