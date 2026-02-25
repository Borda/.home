---
name: analyse
description: Analyze GitHub issues, PRs, and repo health for an OSS project. Summarizes long threads, assesses PR readiness, detects duplicates, extracts reproduction steps, and generates repo health stats. Uses gh CLI for GitHub API access. Complements oss-maintainer agent.
argument-hint: [number, health, or 'dupes keyword']
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>
Analyze GitHub issues and PRs to help maintainers triage, respond, and decide quickly. Produces actionable, structured output — not just summaries.
</objective>

<inputs>
- **$ARGUMENTS**: one of:
  - Number (e.g. `42`) — auto-detects issue vs PR
  - `health` — generate repo issue/PR health overview
  - `dupes [keyword]` — find potential duplicate issues
</inputs>

<workflow>

## Auto-Detection (for numeric arguments)

When `$ARGUMENTS` is a number, determine whether it is an issue or a PR before routing.
**Default assumption: issue** — this skill is primarily for issue analysis.

```bash
# GitHub's issues API covers both issues and PRs.
# A PR has a "pull_request" key; a plain issue does not.
TYPE=$(gh api "repos/{owner}/{repo}/issues/$ARGUMENTS" \
  --jq 'if .pull_request then "pr" else "issue" end' 2>/dev/null || echo "issue")

if [ "$TYPE" = "pr" ]; then
  # → Route to PR Analysis mode
else
  # → Route to Issue Analysis mode
fi
```

## Mode: Issue Analysis

```bash
# Fetch issue details
gh issue view $ARGUMENTS --json number,title,body,labels,comments,createdAt,author,state

# Fetch all comments
gh issue view $ARGUMENTS --comments
```

Produce:

````
## Issue #[number]: [title]

**State**: [open/closed] | **Author**: @[author] | **Age**: [X days]
**Labels**: [current labels]

### Summary
[2-3 sentence plain-language summary of the issue]

### Thread Verdict
[If thread contains a verified/confirmed solution: extract it here with attribution]
[If no verified solution: "No confirmed solution in thread." — skip thread detail]

### Root Cause Hypotheses

| # | Hypothesis | Probability | Reasoning |
|---|-----------|-------------|-----------|
| 1 | [most likely cause] | [high/medium/low] | [why — reference specific code paths] |
| 2 | [alternative cause] | [medium/low] | [why] |
| 3 | [less likely] | [low] | [why] |

### Code Evidence

For the top hypothesis, trace through relevant code:

```[language]
# [file:line] — [what this code does and why it relates to the hypothesis]
[relevant code snippet]
````

### Suggested Labels

[labels to add/remove based on analysis]

### Suggested Response

[draft reply — or "close as duplicate of #X"]

### Priority

[Critical / High / Medium / Low] — [rationale]

````

## Mode: PR Analysis

Run all three `gh` commands in parallel — they are independent API calls:

```bash
# --- run these three in parallel ---

# PR metadata
gh pr view $ARGUMENTS --json number,title,body,labels,reviews,checksuite,files,additions,deletions,commits,author

# CI status
gh pr checks $ARGUMENTS

# Files changed
gh pr diff $ARGUMENTS --name-only
````

Produce:

```
## PR #[number]: [title]

**Author**: @[author] | **Size**: +[additions]/-[deletions] lines, [N] files
**CI**: [passing/failing/pending]

### Recommendation
[🟢 Approve / 🟡 Minor Suggestions / 🟠 Request Changes / 🔴 Block] — [one-sentence justification]

### Completeness
- [✅/⚠️/❌/🔵] Clear description of what changed and why
- [✅/⚠️/❌/🔵] Linked to a related issue (`Fixes #NNN` or `Relates to #NNN`)
- [✅/⚠️/❌/🔵] Tests added/updated (happy path, failure path, edge cases)
- [✅/⚠️/❌/🔵] Google-style docstrings for all new/changed public APIs
- [✅/⚠️/❌/🔵] No secrets or credentials introduced
- [✅/⚠️/❌/🔵] Linting and CI checks pass

### Quality Scores
- Code: n/5 [emoji] — [reason]
- Testing: n/5 [emoji] — [reason]
- Documentation: n/5 [emoji] — [reason]

### Risk: n/5 [emoji] — [brief description]
- Breaking changes: [none / detail]
- Performance: [none / detail]
- Security: [none / detail]
- Compatibility: [none / detail]

### Must Fix
1. [blocking issue]

### Suggestions (non-blocking)
1. [improvement]

### Next Steps
1. [clear action for the author]
```

## Mode: Repo Health Overview

Run all three `gh` commands in parallel — they are independent API calls:

```bash
# --- run these three in parallel ---

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
- Follow-up chains:
  - Issue with confirmed bug → `/fix` to diagnose, reproduce with test, and apply targeted fix
  - Issue with code smell or structural problem → `/refactor` for test-first improvements
  - PR with quality concerns → `/review` for comprehensive multi-agent code review
</notes>
