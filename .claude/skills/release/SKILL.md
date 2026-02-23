---
name: release
description: Prepare release communication from git history, PRs, or a diff. Adapts output to context — user-facing release notes, CHANGELOG entry, internal release summary, or migration guide. Groups changes by type, filters noise, writes in plain language for the audience.
argument-hint: [tag, branch, or commit range — e.g. v1.2.0..v1.3.0]
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob
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

## Step 1: Gather changes

```bash
# Commits in range
git log $ARGUMENTS --oneline --no-merges

# Fallback: last tag to HEAD
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# PR titles and labels if available
gh pr list --state merged --base main --limit 50 --json number,title,labels 2>/dev/null
```

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

### Conda-forge Release (if applicable)

```bash
# Check if package is on conda-forge
conda search -c conda-forge <package>

# After PyPI release: conda-forge bot auto-creates a PR to update the feedstock
# Monitor: https://github.com/conda-forge/<package>-feedstock/pulls
# Manual: fork feedstock → update meta.yaml version + sha256 → PR
```

## Writing guidelines

Write for the reader, not the commit author.

- Bad: "refactor: extract UserService from monolith"
- Good: "User management is now ~40% faster"

For fixes, say what was broken, not just that it was fixed.

- Bad: "Fix auth bug"
- Good: "Fix: users with special characters in their email could not log in"

## Version Bumping (before writing notes)

```bash
# Option A: bump-my-version (simple, config in pyproject.toml)
bump-my-version bump patch   # or minor / major
# Adds commit + tag automatically

# Option B: commitizen (conventional commits → automatic changelog)
cz bump     # reads commit history, bumps version, updates CHANGELOG
cz changelog

# Option C: manual
# Edit pyproject.toml version + git tag vX.Y.Z
```

## PyPI + GitHub Release (after writing notes)

See `oss-maintainer` agent for the full build → publish → verify checklist.
Quick reference:

```bash
uv build && twine check dist/*                        # build + verify
uv publish dist/*                                      # publish (needs UV_PUBLISH_TOKEN)
gh release create v<version> --title "v<version>" \
  --notes "$(cat CHANGELOG_FRAGMENT.md)" dist/*        # GitHub release
```

</workflow>
