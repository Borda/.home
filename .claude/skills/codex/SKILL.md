---
name: codex
description: Delegate narrow, mechanical coding tasks to OpenAI Codex CLI via MCP — Claude orchestrates and judges, Codex executes. Pre-flight checks ensure graceful degradation on machines without Codex.
argument-hint: "<task description>" ["target file or directory"]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, mcp__codex__codex, mcp__codex__codex-reply
---

<objective>

Delegate mechanical, well-scoped coding tasks to Codex via MCP while Claude retains orchestration, judgment, and validation. Use this skill when a task is repetitive or formulaic enough that Codex can execute it faster and cheaper — but the task still needs Claude to scope it precisely, verify the output, and decide whether to keep or revert the changes.

Good candidates for delegation: adding docstrings to undocumented functions, renaming symbols consistently, extracting constants, adding type annotations to a well-typed module, reformatting code to match a style, or applying a mechanical refactor across many files.

Poor candidates: architectural decisions, novel logic, anything requiring deep codebase understanding, or tasks where the correct answer is ambiguous.

</objective>

<inputs>

- **$ARGUMENTS**: required
  - First token(s): task description in plain text (e.g., `"add docstrings to all public functions"`)
  - Optional second quoted token: target file or directory to scope the task (e.g., `"src/mypackage/transforms.py"`)
  - If no target given: Step 2 scope analysis identifies the right location

</inputs>

<workflow>

## Step 1: Pre-flight check

Run all three checks before doing any other work. Stop at the first failure.

**1 — Git is initialised** (required for stash-based handover):

```bash
git rev-parse --git-dir
```

If this fails: `Pre-flight failed: not a git repository. Initialise git first — stash handover requires it.`

**2 — Codex binary on PATH:**

```bash
which codex
```

If this fails: `Pre-flight failed: codex not found on PATH. Install and retry. macOS: brew install codex`

**3 — MCP server reachable:** check `/mcp` — the `codex` server must appear with tools `codex` and `codex-reply`. If listed with an error, stop and suggest a Claude Code restart.

## Step 2: Scope and formulate the prompt

Read the target file or directory to understand what Codex will operate on:

```bash
# Count lines and check file structure
wc -l <target>

# For a directory: list relevant files
find <target> -name "*.py" | head -20
```

Assess task complexity:

- **Simple** — mechanical, clearly bounded, affects ≤ 5 files: proceed to Step 3
- **Medium** — well-defined but touches more files or requires consistent judgment calls: proceed with a more explicit prompt
- **Too broad** — architectural, ambiguous, or touches > 20 files: do not delegate. Implement directly using the appropriate skill (`/feature`, `/refactor`, etc.) and report why delegation was skipped

Select the Codex agent based on task type. The "internal chain" column shows which agents Codex may spawn internally (per AGENTS.md spawn rules) — Claude receives the final working-tree result of the whole chain, not just the first agent:

| Task type                                               | Entry agent      | Internal chain                                 |
| ------------------------------------------------------- | ---------------- | ---------------------------------------------- |
| Docstrings, README, CHANGELOG                           | `doc-scribe`     | single agent                                   |
| Implementation, refactoring, renaming, type annotations | `sw-engineer`    | `sw-engineer` → `qa-specialist` + `doc-scribe` |
| Lint / type-check fixes                                 | `linting-expert` | single agent                                   |
| Test writing or improvements                            | `qa-specialist`  | single agent                                   |
| Performance, profiling                                  | `squeezer` ¹     | single agent                                   |
| CI config, GitHub Actions                               | `ci-guardian`    | single agent                                   |
| Data pipeline changes                                   | `data-steward`   | single agent                                   |
| Release prep, deprecation notices                       | `oss-maintainer` | single agent                                   |

¹ `squeezer` is a Codex-only agent (no `.claude/` peer) — for deep performance analysis use the `perf-optimizer` agent directly instead.

For chained tasks (e.g. `sw-engineer`), Codex may take longer and touch more files — factor this into the complexity assessment above.

Formulate a lean, unambiguous prompt: `use the <agent> to <exact task> in <target>`. Do NOT repeat Borda conventions, style rules, or language version — the agent already has all of this in its `developer_instructions`. Only add constraints specific to this invocation (e.g., "do not modify function signatures", "stop after the first file only").

Confirm the selected agent is registered before dispatching:

```bash
ls .codex/agents/
```

If the agent file (e.g., `.codex/agents/doc-scribe.toml`) is absent, stop with a message listing what is available and let the user select a different agent.

## Step 3: Dispatch to Codex

Call `mcp__codex__codex` with the formulated prompt. Always address the agent by name — Codex routes the task to the right specialist based on the opening phrase:

```
mcp__codex__codex(
  prompt="use the <agent> to <exact task> in <target>",
  sandbox="workspace-write"
)
```

Example prompts:

- `"use the doc-scribe to add Google-style docstrings to all undocumented public functions in src/mypackage/transforms.py"`
- `"use the sw-engineer to rename BatchLoader to DataBatcher throughout src/mypackage/"`
- `"use the linting-expert to fix all ruff errors in src/mypackage/utils.py — do not change logic"`

The `sandbox: workspace-write` setting allows Codex to read and write files in the workspace but not execute arbitrary shell commands outside it.

**Boundary contract**: within the MCP session, Codex agents chain internally via stash (per AGENTS.md Work Handover). The final agent in any chain must leave all changes in the working tree — not stashed — so Claude can pick them up with `git diff HEAD` in Step 5. The `pre-codex` stash created above is Claude's own and must not be touched by Codex agents.

## Step 4: Monitor and handle responses

Evaluate the Codex response:

- **Success with changes**: Codex reports edits made → proceed to Step 5
- **Success, no changes needed**: Codex reports task was already done → report and stop
- **Partial completion**: Codex stopped partway (token limit, ambiguity) → use `mcp__codex__codex-reply` to continue with a clarifying follow-up (max 3 total turns including the initial call)
- **Error / timeout**: report the error, do not retry the same prompt; suggest running Codex interactively (`codex "<task>"`) for diagnostics
- **Rate limit**: report the limit hit, suggest waiting and retrying

For follow-up turns via `mcp__codex__codex-reply`, keep the message focused:

```
mcp__codex__codex-reply(
  message="<specific clarification or continuation instruction>"
)
```

**Hard stop after 3 turns total**. If the task is not complete by then, revert all Codex changes and implement directly.

## Step 5: Validate and capture

Validate first while Codex's changes are still in the working tree:

```bash
git diff HEAD --stat        # what Codex changed
ruff check <changed_files>
mypy <changed_files> --no-error-summary 2>&1 | head -20
python -m pytest <test_dir> -v --tb=short -q 2>&1 | tail -20
```

**If validation fails:**

1. Attempt one fix pass via `mcp__codex__codex-reply` with a targeted correction — counts toward the 3-turn limit
2. Re-run validation
3. If still failing: discard and report — do not capture a patch:
   ```bash
   git restore .
   git clean -fd
   ```
   Report that delegation failed and proceed with direct implementation.

**If validation passes:** capture the diff as a named patch file, then restore the working tree:

```bash
mkdir -p .codex/handover
git diff HEAD > .codex/handover/codex-<task-slug>-$(date +%s).patch
git restore .
git clean -fd
```

The patch is now the reviewed, validated artifact. Apply it to make the changes live:

```bash
git apply .codex/handover/codex-<task-slug>-<timestamp>.patch
rm .codex/handover/codex-<task-slug>-<timestamp>.patch
```

When running as a parallel subagent spawned by a parent Claude: stop after saving the patch — do not apply it. The parent Claude collects all subagent patches and applies them sequentially.

## Step 6: Report

Output a structured summary:

```
## Codex Report: <task summary>

### Delegation
- Tool: Codex via MCP
- Agent: <agent-name>
- Turns used: N / 3
- Patch: .codex/handover/<filename>.patch (applied / awaiting parent)

### Changes Made
| File | Change | Lines |
|------|--------|-------|
| path/to/file.py | description | -N/+M |

### Validation
- Lint: clean / N issues (fixed by retry)
- Types: clean / N issues
- Tests: PASS (N tests) / FAIL — reverted

### Cost Efficiency
- Delegation outcome: success / partial / reverted
- [If reverted: reason and fallback used]

### Follow-up
- [any deferred items or suggested next steps]
```

</workflow>

<notes>

- **Delegation criteria**: only delegate when the task is mechanical and clearly bounded — ambiguous tasks produce inconsistent Codex output that costs more to fix than to write
- **3-turn hard limit**: prevents runaway MCP sessions; after 3 turns without a passing patch, discard and implement directly
- **Validate before capturing**: lint + tests run against the live working tree; only a passing result gets saved as a patch
- **Patch files are parallel-safe**: each subagent writes a uniquely named file — no shared git state, no stash index races
- **Parent applies patches**: when running as a subagent, stop after saving the patch; never apply it yourself — the parent serialises application
- **sandbox: workspace-write**: Codex can read and write files in the workspace but cannot execute arbitrary shell commands outside it
- Related agents: `sw-engineer` (fallback for direct implementation), `linting-expert` (validation), `qa-specialist` (test validation)
- Follow-up chains:
  - Codex changes pass but need architectural review → `/review` for full multi-agent quality validation
  - Task was too broad for delegation → `/feature` or `/refactor` for full orchestrated workflow

</notes>
