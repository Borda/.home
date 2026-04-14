---
description: Universal operational rules — no hardcoded paths, Bash timeouts, and directory navigation pattern
paths:
  - '**'
---

## Path Rules

- No hardcoded absolute user paths (`/Users/<name>/` or `/home/<name>/`) — use `.claude/`, `~/`, or `git rev-parse --show-toplevel`
- **Artifact dirs** belong at the project root, not inside `.claude/` — see `.claude/rules/artifact-lifecycle.md`

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

## Directory Navigation Commands

Never combine directory navigation with a command in a single Bash call — always use **two separate Bash calls**:

```bash
# ✓ correct — two calls; working directory persists between calls
cd /path/to/dir
uv run pytest tests/

# ✗ wrong — all three forms below cause the same failure
cd /path && uv run pytest tests/
cd /path
uv run pytest tests/
cd /path || uv run pytest tests/
```

**Why**: Claude Code's permission matcher checks only the **first token** of a Bash command. Any compound using `&&`, `;`, or `||` presents `cd` as the first token — which matches no allow entry — even when `Bash(uv run pytest:*)`, `Bash(python3:*)`, or similar rules are in the allow list. This applies to every command, not just worktrees.

The working directory persists between Bash calls, so two sequential calls are always equivalent to the compound form.
