---
name: analyse
description: Analyze GitHub issues, PRs, and repo health for an OSS project. Summarizes long threads, assesses PR readiness, detects duplicates, extracts reproduction steps, and generates repo health stats. Uses gh CLI for GitHub API access. Complements oss-maintainer agent.
argument-hint: [issue number, PR number, or 'health' for repo overview]
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>
Analyze GitHub issues and PRs to help maintainers triage, respond, and decide quickly. Produces actionable, structured output — not just summaries.
</objective>

<inputs>
- **$ARGUMENTS**: one of:
  - Issue number (e.g. `42`) — analyze a single issue
  - PR number with `pr` prefix (e.g. `pr 42`) — analyze a PR
  - `health` — generate repo issue/PR health overview
  - `dupes [keyword]` — find potential duplicate issues
</inputs>

<workflow>

## Mode: Single Issue Analysis

```bash
# Fetch issue details
gh issue view $ARGUMENTS --json number,title,body,labels,comments,createdAt,author,state

# Fetch all comments
gh issue view $ARGUMENTS --comments
```

Produce:

```
## Issue #[number]: [title]

**State**: [open/closed] | **Author**: @[author] | **Age**: [X days]
**Labels**: [current labels]

### Summary
[2-3 sentence summary of the issue in plain language]

### Type
[Bug / Feature Request / Question / Documentation / Duplicate]

### Reproduction Steps (if bug)
1. [extracted from issue body/comments]
2. ...
Minimal reproduction: [yes/no — if no, flag as needs-repro]

### Root Cause Hypothesis
[If enough info exists: likely location in codebase]

### Suggested Labels
[labels to add/remove based on analysis]

### Suggested Response
[draft response to post, or "close as duplicate of #X"]

### Priority
[Critical / High / Medium / Low] — [rationale]
```

## Mode: PR Analysis

```bash
# PR metadata
gh pr view $ARGUMENTS --json number,title,body,labels,reviews,checksuite,files,additions,deletions,commits

# CI status
gh pr checks $ARGUMENTS

# Files changed
gh pr diff $ARGUMENTS --name-only
```

Produce:

```
## PR #[number]: [title]

**Author**: @[author] | **Size**: +[additions]/-[deletions] lines, [N] files
**CI**: [passing/failing/pending]
**Reviews**: [approved by X / changes requested by Y]

### Summary
[What this PR does in 2-3 sentences]

### Readiness Checklist
[ ] CI passing
[ ] Tests added for new functionality
[ ] CHANGELOG updated
[ ] Docstrings on new public APIs
[ ] No breaking changes without deprecation (or breaking changes are intentional and versioned)
[ ] PR description explains WHY, not just WHAT

### Concerns
- [blocking]: [specific issue]
- [nit]: [suggestion]

### Recommendation
[Approve / Request changes / Close] — [one-sentence rationale]
```

## Mode: Repo Health Overview

```bash
# Open issues count and age distribution
gh issue list --state open --json number,createdAt,labels --limit 200

# Stale issues (no activity > 90 days)
gh issue list --state open --json number,title,updatedAt --limit 200 | \
  jq '[.[] | select(.updatedAt < (now - 7776000 | todate))]'

# Open PRs
gh pr list --state open --json number,title,createdAt,reviews,checksuite
```

Produce:

```
## Repo Health: [repo]

### Issue Summary
- Open issues: [N]
- Stale (>90 days): [N] — [list top 5]
- Needs triage (no labels): [N]
- Bugs: [N] | Enhancements: [N] | Questions: [N]

### PR Summary
- Open PRs: [N]
- Awaiting review: [N]
- CI failing: [N]
- Stale (>30 days): [N]

### Recommended Actions
1. [most urgent triage action]
2. [second]
3. [third]
```

## Mode: Duplicate Detection

```bash
# Search existing issues for keyword
gh issue list --state all --search "$ARGUMENTS" --json number,title,state --limit 50
```

Group by similarity and output:

```
## Potential Duplicates for: "[keyword]"

### Group 1: [theme]
- #[N]: [title] ([state])
- #[N]: [title] ([state])
Canonical: #[oldest open issue] — suggest closing others as duplicates

### Unique (not duplicates)
- #[N]: [title] — [why it's distinct]
```

## Mode: Contributor Activity

```bash
# Top contributors in last 90 days
gh api "repos/{owner}/{repo}/stats/contributors" \
  | jq '[.[] | {author: .author.login, commits: .total, last_week: .weeks[-1]}] | sort_by(-.commits) | .[:10]'

# Release cadence
gh release list --limit 20 --json tagName,publishedAt \
  | jq '[.[] | .publishedAt[:10]]'
```

Produce:

```
## Contributor Activity: [repo]

### Top Contributors (90 days)
| Author | Commits | Trend |
|--------|---------|-------|
| @... | N | ... |

### Release Cadence
- Average: [N days] between releases
- Last release: [date] ([tag])
- Overdue? [yes/no based on cadence]
```

## Mode: Ecosystem Impact (for library maintainers)

When assessing the impact of a change on downstream users:

```bash
# Find downstream dependents on GitHub
gh api "search/code?q=\"from+mypackage+import\"+in:file+language:python&per_page=20" \
  --jq '[.items[].repository.full_name] | unique | .[]'

# Check PyPI reverse dependencies (who depends on us?)
# pip install johnnydep
# johnnydep mypackage --fields=name --reverse

# Check conda-forge feedstock dependents
gh api "search/code?q=\"mypackage\"+in:file+repo:conda-forge/*-feedstock+filename:meta.yaml" \
  --jq '[.items[].repository.full_name] | .[]'
```

Produce:

```
## Ecosystem Impact: [change description]

### Downstream Consumers Found
- [repo]: uses [specific API being changed]

### Breaking Risk
- [High/Medium/Low] — [N] known consumers of changed API
- Migration path: [available / needs documentation]

### Recommended Communication
- [create migration guide / add deprecation warning / notify maintainers directly]
```

</workflow>

<notes>
- Always use `gh` CLI — never hardcode repo URLs
- Run `gh auth status` first if commands fail; user may need to authenticate
- For closed issues/PRs, note the resolution so history is useful
- Don't post responses without explicit user instruction — only draft them
</notes>
