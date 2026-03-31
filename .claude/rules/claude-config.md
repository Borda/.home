---
description: Rules for editing files under .claude/ — plan mode, cross-references, sync
paths:
  - .claude/**
---

## Before Editing

- **Enter plan mode first** — triggers Opus via `opusplan` for best reasoning on configuration changes.
  **No exceptions**: typo fixes, single-step edits, and "quick" changes all require plan mode.
  The global "non-trivial task (3+ steps)" threshold does NOT apply here — any edit to `.claude/` is treated as non-trivial.

## After Any Change

1. **Cross-references** — if a name or capability changes, update every file that mentions it
2. **`memory/MEMORY.md`** — keep the agents/skills roster in sync with disk
3. **`README.md`** — verify agent/skill tables, Status Line, and Config Sync sections
4. **`settings.json` permissions** — IF this change introduces any new `gh`, `bash`, or `WebFetch`
   call (directly or in a step/workflow you are adding), you MUST add a matching allow rule before
   marking the task complete. Check: scan the diff for any new CLI invocations before ticking this off.
5. **`</workflow>` tags** — mode sections must sit inside the block; closing tag after the last mode, before `<notes>`
6. **Step numbering** — renumber sequentially after adding/removing steps

## Path Rules

- No hardcoded absolute user paths (`/Users/<name>/` or `/home/<name>/`) — use `.claude/`, `~/`, or `git rev-parse --show-toplevel`
- statusLine and hook paths in home `settings.json` use `$HOME`: `node $HOME/.claude/hooks/statusline.js`
- **Artifact dirs** belong at the project root, not inside `.claude/` — canonical pattern: `_<skill>/$(date -u +%Y-%m-%dT%H-%M-%SZ)/`; see `.claude/rules/artifact-lifecycle.md`

## Bash Timeouts

Every Bash call in a skill or agent workflow must include an explicit `timeout` parameter — **3× the expected P90 duration** of that operation. Never rely on the default 120 s cap for fast operations; fail fast and let the caller retry rather than freezing.

| Operation class                                          | Expected P90 | 3× timeout        |
| -------------------------------------------------------- | ------------ | ----------------- |
| `gh pr view`, `gh pr diff`, `gh issue view`              | 2 s          | `timeout: 6000`   |
| `gh pr checks`, `gh pr list`                             | 5 s          | `timeout: 15000`  |
| `gh api --paginate`, `gh release list`                   | 10 s         | `timeout: 30000`  |
| Local git commands (`git log`, `git diff`, `git status`) | 1 s          | `timeout: 3000`   |
| `pip install`, `npm install`, `brew install`             | 30 s         | `timeout: 90000`  |
| Test suite (`pytest`, `uv run pytest`)                   | 3 min        | `timeout: 600000` |
| Build / compile step                                     | 2 min        | `timeout: 360000` |
| Simple shell utilities (`wc`, `find`, `grep`, `ls`)      | 0.5 s        | `timeout: 5000`   |

Rules:

- When in doubt, use 3× the fastest plausible completion time — not the worst case
- A timed-out fast operation is a signal to investigate; a frozen session is not
- `timeout: 120000` (2 min) is only acceptable for test suites or builds, never for network calls

## Worktree Commands

When running commands inside a git worktree, use **two separate Bash calls** rather than `cd /path && command`:

```bash
cd /path/to/worktree
uv run pytest tests/
```

Required because Claude Code's permission matcher checks only the **first token** of a Bash command. Applies to `uv run`, `python`, `pytest`, `git`, etc. Alternative: spawn an agent with `isolation: "worktree"` — its CWD is the worktree root.

Worktrees land under `.claude/worktrees/<id>/`. Permissions in `settings.local.json` are snapshotted at worktree-creation time — not updated retroactively.

## Sync

- Source of truth: project `.claude/`
- Propagate to home `~/.claude/` with `/sync apply`
- `settings.local.json` is never synced; `CLAUDE.md` IS synced
