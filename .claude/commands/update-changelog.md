Review the current git diff (staged and unstaged changes) and update CHANGELOG.md accordingly.

Instructions:
1. Run `git diff` and `git diff --cached` to see all current changes
2. Read the current CHANGELOG.md
3. Add appropriate entries under the `## [Unreleased]` section
4. Use the correct subsection: `### Added`, `### Changed`, `### Fixed`, or `### Removed`
5. Each entry should follow the format: `- **Feature name** — brief description`
6. Stage the updated CHANGELOG.md with `git add CHANGELOG.md`

Be concise but descriptive. Group related changes together.
