---
description: Public GitHub is read-only — forbids all writes (issues, PRs, releases, gists, repos) via gh CLI or curl mutations
paths:
  - '**/*'
---

## Public GitHub — Read-Only

Claude and every agent (including subagents, skills, and teammates) are **read-only** on public GitHub. This is a hard system-level constraint, not a suggestion.

### Permitted (read)

- `gh issue list`, `gh issue view`
- `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr checks`
- `gh repo view`, `gh release list`, `gh release view`
- `gh run list`, `gh run view`
- `gh api graphql` (read queries only)
- `gh api search/*`
- `WebFetch` on `github.com`, `raw.githubusercontent.com`

### Forbidden (write) — enforced via deny list

Any command that creates, edits, posts, closes, deletes, or otherwise mutates state on any public or external GitHub repository is **permanently forbidden**, including but not limited to:

- `gh issue create`, `gh issue comment`, `gh issue edit`, `gh issue close`, `gh issue delete`
- `gh pr create`, `gh pr comment`, `gh pr edit`, `gh pr merge`, `gh pr close`, `gh pr review`
- `gh release create`, `gh release edit`, `gh release delete`, `gh release upload`
- `gh repo fork`, `gh repo create`
- `gh gist create`, `gh gist edit`, `gh gist delete`
- `gh api repos/*` with `--method POST/PATCH/PUT/DELETE` (removed from allow list — prompts for approval)
- `curl -X POST`, `curl --request POST`, `curl -X PATCH`, `curl --request PATCH`, `curl -X PUT`, `curl --request PUT` — all curl write methods denied globally; curl is read-only (GET only)

### When the user says "write/file/post/submit X to GitHub"

Interpret as: **draft X for the user's review**. Show the draft output (issue body, PR description, comment text) in the terminal. Ask for explicit confirmation via `AskUserQuestion` before any external action. Never delegate to an agent and assume it will ask.
