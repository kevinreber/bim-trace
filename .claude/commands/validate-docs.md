Validate that all project documentation is accurate and up-to-date with the current codebase. This should be run before every commit.

## Validation Checklist

Perform ALL of the following checks. For each issue found, fix it directly.

### 1. CHANGELOG.md
- Run `git diff` and `git diff --cached` to see all pending changes
- Ensure every change is documented under `## [Unreleased]` with the correct subsection (`### Added`, `### Changed`, `### Fixed`, `### Removed`)
- Follow the format: `- **Feature name** — brief description`
- Stage CHANGELOG.md after updating

### 2. README.md — Tech Stack Accuracy
- Read `package.json` to get the actual dependencies
- Read `README.md` and verify the Technical Stack table matches reality
- Key things to check:
  - Framework should be Vite + React (NOT Next.js) if that's what package.json shows
  - Database/Auth references should match what's actually used (or be removed if not implemented yet)
  - All technology references should match actual installed packages
- Fix any inaccuracies. Mark unimplemented features clearly as "Planned" or remove them.

### 3. CLAUDE.md — Development Guide Accuracy
Read each section of CLAUDE.md and validate against the actual code:

#### Tech Stack section
- Cross-reference with `package.json` dependencies

#### Core Files section
- Verify every file path listed actually exists using glob
- Check that descriptions match what the files actually contain
- Look for important files that exist but aren't documented

#### UI Components section
- Glob `src/components/*.tsx` and `src/components/*.ts`
- Ensure all significant components are listed
- Remove references to files that no longer exist
- Add entries for new components not yet documented

#### 3D Engine section
- If geometry builders were extracted to `geometryBuilders.ts`, make sure the docs reflect that
- Verify function names mentioned actually exist in the code

#### Keyboard Shortcuts table
- Read `src/routes/index.tsx` and find the keyboard event handler
- Verify every shortcut listed in the table actually exists in code
- Add any shortcuts that exist in code but are missing from the table

#### Adding New BIM Elements checklist
- Verify each step references files/functions that actually exist
- If code was refactored (e.g., builders moved to geometryBuilders.ts), update the steps

### 4. ROADMAP.md — Completion Status
- Read the CHANGELOG.md `[Unreleased]` section to see what's been shipped
- Cross-reference with ROADMAP.md checkboxes
- Check items that have been implemented (present in CHANGELOG or visible in codebase) but are still unchecked in ROADMAP
- Do NOT uncheck items or remove future plans

### 5. Cross-Document Consistency
- Ensure the tech stack description is consistent across README.md, CLAUDE.md
- Ensure feature descriptions don't contradict between CHANGELOG.md and ROADMAP.md
- Ensure keyboard shortcuts match between CLAUDE.md and actual code

## After Fixing
- Stage all modified documentation files: `git add README.md ROADMAP.md CLAUDE.md CHANGELOG.md`
- Report a summary of what was updated and why
