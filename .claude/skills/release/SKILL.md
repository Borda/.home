---
name: release
description: Prepare release communication from git history, PRs, or a diff. Adapts output to context — user-facing release notes, CHANGELOG entry, internal release summary, or migration guide. Groups changes by type, filters noise, writes in plain language for the audience.
argument-hint: [range] [release-notes|changelog|summary|migration] | prep <version>
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>

Prepare release communication based on what changed. The output format adapts to the audience and context — user-facing release notes, a CHANGELOG entry, an internal release summary, or a migration guide for breaking changes.

</objective>

<inputs>

- **$ARGUMENTS**: git tag, branch, or commit range (e.g. `v1.2.0..HEAD`, `main..release/1.3`).
  If omitted, uses the range from the last tag to HEAD.
- Optionally append the desired format: `release-notes`, `changelog`, `summary`, or `migration`.
  If not specified, infer from context (public library → release notes, internal tool → summary).

</inputs>

<workflow>

## Mode Detection

If `$ARGUMENTS` starts with `prep`, skip to **Mode: prep** below.
Otherwise, run Steps 1–3 as normal.

## Step 1: Gather changes

```bash
# Determine range: use $ARGUMENTS or fall back to last-tag..HEAD
RANGE="${ARGUMENTS:-$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD}"

# One-liner overview (navigation index)
git log $RANGE --oneline --no-merges

# Full commit messages — read these to catch BREAKING CHANGE footers,
# co-authors, and details omitted from the subject line
git log $RANGE --no-merges --format="--- %H%n%B"

# File-level diff stat — confirms what areas actually changed
git diff --stat $(echo "$RANGE" | sed 's/\.\./\ /')

# PR titles, bodies, and labels for merged PRs (richer context than commits)
gh pr list --state merged --base main --limit 100 \
  --json number,title,body,labels,mergedAt 2>/dev/null
```

Cross-reference commit bodies against PR descriptions — the canonical source of
truth for *why* a change was made. If a commit footer contains `BREAKING CHANGE:`,
it is a breaking change regardless of how it was labelled in the PR.

## Step 2: Classify each change

| Category             | What goes here                                       |
| -------------------- | ---------------------------------------------------- |
| **Breaking Changes** | Requires callers to change code, config, or behavior |
| **New Features**     | User-visible additions                               |
| **Improvements**     | Enhancements to existing behavior                    |
| **Bug Fixes**        | Correctness fixes                                    |
| **Performance**      | Speed or memory improvements                         |
| **Deprecations**     | Still works, scheduled for removal                   |
| **Internal**         | Refactors, CI, deps — omit unless user-impacting     |

Filter out: merge commits, minor dep bumps, CI config, comment typos.
Always include: any breaking change, any behavior change, any new API surface.

## Step 3: Choose output format

### Release Notes (user-facing, public)

```markdown
## [version] — [date]

### ⚠️ Breaking Changes
- **[Area]**: [what changed and what users need to do]

### ✨ New Features
- [Feature]: [what it does and why it matters]

### 🔧 Improvements
- [brief description]

### 🐛 Bug Fixes
- [what was broken → what is fixed]

### ⚡ Performance
- [improvement, before/after if known]

### 🗑️ Deprecations
- `[thing]` is deprecated. Use `[replacement]`. Removed in [version].
```

### CHANGELOG Entry (Keep a Changelog format)

```markdown
## [version] — [date]
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
```

### Internal Release Summary (team / stakeholders)

```markdown
## Release [version]
**What shipped**: [2-3 sentence summary of the most important changes]
**Impact**: [who is affected and how]
**Action required**: [anything ops/support/consumers need to do]
**Rollback**: [safe to roll back? any caveats?]
```

### Migration Guide (breaking changes only)

```markdown
## Migrating from [old] to [new]
### [Breaking change name]
**Before**: [code or config snippet]
**After**: [code or config snippet]
**Why**: [reason for the change]
```

See `oss-maintainer` agent for conda-forge feedstock updates and PyPI publish workflow.

## Writing guidelines

Write for the reader, not the commit author.

- Bad: "refactor: extract UserService from monolith"
- Good: "User management is now ~40% faster"

For fixes, say what was broken, not just that it was fixed.

- Bad: "Fix auth bug"
- Good: "Fix: users with special characters in their email could not log in"

For version bumping (`bump-my-version`, `commitizen`, manual tagging), see the `oss-maintainer` agent's release checklist.

## PyPI + GitHub Release (after writing notes)

See `oss-maintainer` agent for the full build → publish → verify checklist.
Quick reference:

```bash
uv build && twine check dist/*                        # build + verify
uv publish dist/*                                      # publish (needs UV_PUBLISH_TOKEN)
gh release create v<version> --title "v<version>" \
  --notes "$(cat CHANGELOG_FRAGMENT.md)" dist/*        # GitHub release
```

## Mode: prep

**Trigger**: `/release prep <version>` (e.g., `prep v1.3.0` or `prep 1.3.0`)

**Purpose**: Write release artifacts to disk, ready for the manual bump → commit → push → PR workflow.

```bash
VERSION=$(echo "$ARGUMENTS" | awk '{print $2}')
[[ "$VERSION" != v* ]] && VERSION="v$VERSION"
DATE=$(date +%Y-%m-%d)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
RANGE="$LAST_TAG..HEAD"
```

Run **Steps 1–2** to gather and classify all changes in `$RANGE`. Then write two artifacts:

### 1. Prepend to `CHANGELOG.md`

Generate the entry in Keep a Changelog format, omitting empty sections. Then:

- If `CHANGELOG.md` exists: insert the new entry after the first `# Changelog` heading line
- If it does not exist: create it with a `# Changelog` header followed by the new entry

### 2. Write `RELEASE_NOTES.md`

Write the user-facing release notes (Step 3 "Release Notes" format) to `RELEASE_NOTES.md` at the repo root. Ready to paste directly into the GitHub release body.

### Output

```
## Release prep: $VERSION

### Written
- `CHANGELOG.md` — $VERSION entry prepended (N changes across M categories)
- `RELEASE_NOTES.md` — user-facing notes ready to paste into GitHub release

### Next steps
1. Review both files
2. Bump version in `pyproject.toml` → `version = "$VERSION"`
3. git add CHANGELOG.md RELEASE_NOTES.md pyproject.toml
4. git commit -m "chore: release $VERSION"
5. git push && gh pr create --title "Release $VERSION" --body "$(cat RELEASE_NOTES.md)"
```

</workflow>

<notes>

- Filter noise (CI config, dep bumps, typos) unless they are user-impacting
- Follow-up chains:
  - Notes look good → `/release prep <version>` to write artifacts to disk
  - Release includes breaking changes → `/analyse` for downstream ecosystem impact assessment
  - Pre-release audit → `/security` for dependency vulnerability scan before publishing

</notes>
