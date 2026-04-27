---
name: run
description: Sustained metric-improvement loop with atomic commits, auto-rollback, and experiment logging. Iterates with specialist agents, commits atomically, auto-rolls back on regression. Accepts a program.md file path. Supports --resume, --team, --colab, --codex, --researcher, --architect, --journal, --hypothesis.
argument-hint: <program.md> [clarification] [--resume <program.md>] [--team] [--compute=local|colab|docker] [--colab[=H100|L4|T4|A100]] [--codex] [--researcher] [--architect] [--journal] [--hypothesis <path>]
effort: high
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, TaskCreate, TaskUpdate, AskUserQuestion
disable-model-invocation: true
---

<objective>

Sustained metric-improvement loop — reads `program.md`, iterates specialist ideation agents, commits atomically, auto-rolls back on regression. For long-running automated improvement campaigns.

NOT for: methodology validation before run (use `/research:judge`); hypothesis generation (use `research:scientist` agent); one-off feature work (use `/develop:feature`).

</objective>

<constants>

Campaign mode only:

```yaml
MAX_ITERATIONS:             20 (ceiling: 50 — never exceed without explicit user override)
MAX_CODEX_RUNS:             10 (cost ceiling for --codex Phase 2c — disable Codex once exceeded)
STUCK_THRESHOLD:            5 consecutive discards → escalation
GUARD_REWORK_MAX:           2 attempts before revert
VERIFY_TIMEOUT_SEC:         120 (local), 300 (--colab)
COLAB_KNOWN_HW:             H100, L4, T4, A100
SUMMARY_INTERVAL:           10 iterations
DIMINISHING_RETURNS_WINDOW: 5 iterations < 0.5% each → warn user and suggest stopping
STATE_DIR:                  .experiments/state/<run-id>/  (timestamped dir per run — see .claude/rules/artifact-lifecycle.md)
```

<!-- Note: STATE_DIR (.experiments/state/) holds per-iteration artifacts (diary, experiments.jsonl).
     Hypothesis pipeline outputs (hypotheses.jsonl, checkpoint.json, journal.md) go to .experiments/<run-id>/ (RUN_DIR).
     These are two separate directories by design — see protocol.md for layout. -->

**Agent strategy mapping** (`agent_strategy` in config → ideation agent to spawn):

| `agent_strategy` | Specialist agent | When to use |
| --- | --- | --- |
| `auto` | heuristic | Default — infer from metric_cmd keywords |
| `perf` | `foundry:perf-optimizer` | latency, throughput, memory, GPU utilization |
| `code` | `foundry:sw-engineer` | coverage, complexity, lines, coupling |
| `ml` | `research:scientist` | accuracy, loss, F1, AUC, BLEU |
| `arch` | `foundry:solution-architect` | coupling, cohesion, modularity metrics |

**Auto-inference keyword heuristics** (when `agent_strategy: auto` or omitted; checked against `## Goal` text AND metric command):

- contains `pytest`, `coverage`, `complexity` → `code` → `foundry:sw-engineer`
- contains `time`, `latency`, `bench`, `throughput`, `memory` → `perf` → `foundry:perf-optimizer`
- contains `accuracy`, `loss`, `f1`, `auc`, `train`, `val`, `eval` → `ml` → `research:scientist`
- no keyword match → `perf` (default fallback)

**Stuck escalation sequence** (at STUCK_THRESHOLD consecutive discards):

1. Switch to different agent type (rotate: `code` → `ml` → `perf` → `code`; if current `ml`, next `perf`; if current `perf`, next `code`)
2. Spawn 2 agents in parallel with competing strategies; each agent must write full analysis to `.experiments/state/<run-id>/stuck-escalation-<i>-<agent-type>.md` and return ONLY compact JSON envelope. Consolidation: pick whichever returns delta ≥ 0.1% AND guard pass; if both qualify, pick higher delta.
3. Stop, report progress, surface to user — no blind looping

</constants>

<workflow>

<!-- Agent Resolution: canonical table at plugins/research/skills/_shared/agent-resolution.md -->

## Agent Resolution

```bash
# Locate research plugin shared dir — installed first, local workspace fallback
_RESEARCH_SHARED=$(ls -td ~/.claude/plugins/cache/borda-ai-rig/research/*/skills/_shared 2>/dev/null | head -1)
[ -z "$_RESEARCH_SHARED" ] && _RESEARCH_SHARED="plugins/research/skills/_shared"
# shared resolution block — canonical source: skills/_shared/agent-resolution.md
CLAUDE_SKILL_DIR="${CLAUDE_SKILL_DIR:-plugins/research/skills/run}"
```

Read `$_RESEARCH_SHARED/agent-resolution.md`. Contains: foundry check + fallback table. If foundry not installed: use table to substitute each `foundry:X` with `general-purpose`. Agents this skill uses: `foundry:sw-engineer`, `foundry:linting-expert`, `foundry:perf-optimizer`, `foundry:solution-architect`.

## Default Mode (Steps R1–R7)

Triggered by `run <goal|file.md>`.

**Task tracking**: create tasks R0–R7 at start. If no `--researcher`/`--architect`, mark R0 skipped. If `--codex` active, create task `R5b: Codex co-pilot (iter ?/max)` status `pending`.

### Step R0: Hypothesis pre-phase (`--researcher` / `--architect`)

If no `--researcher`/`--architect`, skip to R1.

Read `${CLAUDE_SKILL_DIR}/modes/hypothesis-pipeline.md`

**Per-iteration hypothesis selection** (when `--researcher`/`--architect` set, inside R5 loop): pop next from `RESEARCH_QUEUE`. Append to Phase 2 prompt: "Focus this iteration on testing this hypothesis: `<hypothesis text>`."

**Per-iteration journal hook** (inside R5, after Phase 7): if `--journal` active, append entry to `<RUN_DIR>/journal.md` after EVERY iteration — regardless of outcome. Entry format: `protocol.md` (companion file, same skill dir). Journals record kept and reverted iterations so ideation agent learns failed approaches.

**Per-iteration checkpoint write** (after Phase 7): if `--researcher`/`--architect` active, append one line to `<RUN_DIR>/checkpoint.json` per schema in `protocol.md` (companion file, same skill dir): `{iteration, hypothesis_id, metric_before, metric_after, status: "passed"|"rolled_back"}`.

### Step R1: Load / build config

**`--resume` flag detection**: if `--resume` in args, extract optional program.md path. Jump to `## Resume Mode`. Rest of R1 and R2–R7 skipped.

**Auto-detect**: first non-flag arg ends in `.md` → parse as program file. Otherwise → text goal.

**Clarification prompt** (`.md` file only): after extracting `.md` path, inspect next token (before `--` flags):

- If absent or starts with `--` → `clarification_prompt = null`
- Quoted string (starts and ends with `"`) → extract as `clarification_prompt`, strip quotes
- Bare unquoted token (no `--`, no `"`) → accept as `clarification_prompt`; print: `ℹ clarification set to "<token>" (tip: quote multi-word hints — e.g. "/research:run program.md \"focus on sort\" --codex")`

After clarification extraction, remaining non-flag tokens (not starting `--`) are unrecognized. For each, print:

```markdown
⚠ Unrecognized argument "<token>" — ignored.
  Known positional args: <program.md path> [clarification]
  Known flags: --team, --colab[=HW], --codex, --compute=local|colab|docker, --researcher, --architect, --journal, --hypothesis <path>
  If you meant to override the algo, edit the ## Config block in your program.md (algo: sort) and update ## Metric to match.
  If you meant to set a clarification hint, pass it as a quoted string: "/research:run program.md \"sort improvements\" --codex"
```

Warn on unrecognized tokens, continue.

**If argument is a `.md` file** — read and parse with these rules:

1. Find each `## <Section>` heading (case-insensitive).
2. Extract first fenced code block following that heading.
3. Parse block as `key: value` lines; multi-value = indented `  - value` items. Paths with spaces: wrap in double quotes.
4. Missing required fields (`command` under `## Metric`/`## Guard`) → stop with error.
5. `agent_strategy: auto` (or omitted) → apply keyword heuristics from `<constants>` to `## Goal` text and metric command.
6. `target` under `## Metric`: `direction: higher` → stop when metric ≥ target; `direction: lower` → stop when metric ≤ target. If `target` omitted, run until `max_iterations`.
7. Unrecognized keys/headings → warn once, ignore.
8. `## Notes` and `# Program:` title never parsed — human-only. (`# Campaign:` accepted as alias.)

**If argument is text** — auto-detect `metric_cmd`/`guard_cmd` from goal string and codebase scan (same as P-P1, non-interactive). `config.json` not read.

**`--colab[=HW]` parsing**: `--colab` (no `=`) → `compute = "colab"`, `colab_hw = null`. `--colab=<value>` → `compute = "colab"`, `colab_hw = <value>` (uppercased). Unknown `<value>` (not in `{H100, L4, T4, A100}`) → print `"⚠ Unknown Colab hardware '<value>' — proceeding with default GPU. Known: H100, L4, T4, A100"`, set `colab_hw = null`. `--compute=colab` (no HW) → `compute = "colab"`, `colab_hw = null`.

`colab_hw` in `## Config` sets hardware preference (`H100`, `L4`, `T4`, `A100`); CLI `--colab=HW` overrides.

Generate `run-id` = `$(date +%Y%m%d-%H%M%S)`. Assign immediately:

```bash
RUN_ID=$(date +%Y%m%d-%H%M%S)
RUN_DIR=".experiments/${RUN_ID}"  # hypothesis pipeline + journal outputs (per <constants> note)
mkdir -p "$RUN_DIR"  # timeout: 5000
```

Note: `STATE_DIR` (`.experiments/state/${RUN_ID}/`) is the per-iteration artifact dir — distinct from `RUN_DIR`. Both directories coexist; see `<constants>` block.

Create run directory:

```text
.experiments/state/<run-id>/
  state.json         ← iteration count, best metric, status
  experiments.jsonl  ← one line per iteration
  diary.md           ← human-readable research diary (hypothesis → outcome → decision)
```

Convert `program_file` to absolute path: `realpath "$PROGRAM_FILE"` — Resume Mode matches on absolute path.

Write initial `state.json` (`program_file` = absolute path to `.md` or `null` for text goal):

```json
{
  "run_id": "<run-id>",
  "goal": "<goal>",
  "config": {},
  "program_file": "<absolute path to program.md, or null>",
  "iteration": 0,
  "best_metric": null,
  "best_commit": null,
  "status": "running",
  "started_at": "<ISO timestamp>",
  "clarification_prompt": null,
  "colab_hw": null,
  "sandbox_mode": "local"
}
```

### Step R2: Precondition checks

Run all checks before touching code. Fail fast with clear message:

1. **Clean git**: `git status --porcelain` → must be empty. If dirty: print dirty files and stop.
2. **Not detached HEAD**: `git rev-parse --abbrev-ref HEAD` → must not be `HEAD`.
3. **Metric command numeric**: run `metric_cmd` once; parse stdout for float. If no float: show output and stop.
4. **Guard passes**: run `guard_cmd` once; must exit 0. If fails: show output and stop.
5. **`--colab` check**: verify `mcp__colab-mcp__runtime_execute_code` available. If not, print setup instructions (see Colab MCP section) and stop. If `--colab=HW` (`colab_hw` non-null): print: `  Hardware requested: --colab=<colab_hw>. Ensure your Colab notebook running with <colab_hw> GPU.`
6. **`--codex` check**: verify `claude plugin list 2>/dev/null | grep -q 'codex@openai-codex'`. If unavailable: print `⚠ codex plugin not found. Install it with: /plugin marketplace add openai/codex-plugin-cc` and **stop**.
7. **`compute: docker` check**: run `docker ps` via Bash (`timeout: 5000`). If non-zero: print `⚠ Docker daemon not running. Start Docker Desktop and retry.` and **stop**.
8. **Flag conflict**: if `--colab` and `--compute=docker` both active: print `⚠ --colab and --compute=docker are mutually exclusive. Use one or the other.` and **stop**.
9. **`--journal` prerequisite**: verify `--researcher`/`--architect` also set. If neither: print `⚠ --journal requires --researcher or --architect — omit --journal or add a hypothesis pipeline flag.` and **stop**.

**Initialize sandbox variables** (after all checks pass):

```bash
SANDBOX_NETWORK="${SANDBOX_NETWORK:-none}"  # override via program.md Config or environment variable
```

**Initialize `sandbox_mode`**:

- `compute: docker` (daemon check passed in #7) → `sandbox_mode = "docker"`. Print: `sandbox: Docker daemon reachable — sandbox mode active`
- All other cases (`compute: local`, `compute: colab`) → `sandbox_mode = "local"`

### Step R3: Select ideation agent

Apply `agent_strategy` mapping from `<constants>`. If `auto`, apply keyword heuristics to `metric_cmd`. Log selected agent to `state.json`.

### Step R4: Establish baseline (iteration 0)

Run `metric_cmd` and `guard_cmd`. Parse metric value. Append to `experiments.jsonl`:

```json
{
  "iteration": 0,
  "commit": "<HEAD sha>",
  "metric": 0.0,
  "delta": 0.0,
  "guard": "pass",
  "status": "baseline",
  "description": "baseline",
  "agent": null,
  "confidence": null,
  "timestamp": "<ISO>",
  "files": []
}
```

Update `state.json`: `best_metric = <baseline>`, `best_commit = <HEAD sha>`.

Print: `Baseline: <metric_cmd key> = <value>`.

Write initial diary header to `.experiments/state/<run-id>/diary.md`:

```markdown
# Research Diary — <goal>

**Run**: <run-id>
**Started**: <ISO timestamp>
**Baseline**: <metric_key> = <baseline value>

---
```

Then proceed to R5.

### Step R5: Iteration loop

```bash
touch /tmp/claude-commit-authorized  # timeout: 3000
```

**`--team` mode**: If `--team` active, Read `${CLAUDE_SKILL_DIR}/modes/team.md` and execute Phases A–D in place of standard iteration loop below.

For each iteration `i` from 1 to `max_iterations`:

**Phase overview** (all phases run per iteration):

| Phase | Name | Trigger / description |
| --- | --- | --- |
| 0 | Print header | Always — print `[→ Iter N/max · starting]`; TaskUpdate R5 subject with current iteration |
| 1 | Build context | Always — build compact context from git log, JSONL history, and recent diff |
| 2 | Propose change | Always — spawn specialist agent to read code, research, investigate, and generate a hypothesis with optional sandbox scripts |
| 2a | Sandbox validate | `compute: docker` only — run agent's exploratory scripts in Docker sandbox (read-only mount) |
| 2b | Apply change | `compute: docker` only — agent applies the (validated) proposal to real codebase using Write/Edit tools only; no Bash on codebase |
| 2c | Codex co-pilot | `--codex` only — **MANDATORY every iteration**; Codex second pass after Phase 2b; must not be skipped |
| 3 | Verify files | Always — check `git diff --stat`; skip to Phase 8 if no files changed (no-op) |
| 4 | Commit change | Always — stage modified files and commit before verifying metric |
| 5 | Verify metric | Always — run `metric_cmd` via `compute` mode (local/colab/docker); revert on timeout |
| 6 | Run guard | Always — run `guard_cmd` via `compute` mode; record pass or fail |
| 7 | Evaluate outcome | Always — keep, rework, or revert based on metric + guard result |
| 7a | Write diary | Always — append one structured entry to `diary.md` recording hypothesis, outcome, and decision rationale |
| 8 | Write log | Always — append JSONL record, update `state.json`, print iteration summary, TaskUpdate R5 with result |
| 9 | Progress checks | Always — summary every SUMMARY_INTERVAL, stuck detection, diminishing-returns warn, early-stop check |

**Command execution rules** (apply to ALL phases running external commands):

1. **No compound commands**: Never `cd /path && command`. Always two separate Bash calls — CWD persists between calls.
2. **Use Bash tool `timeout` parameter**: Never shell `timeout` wrapper. Pass `timeout: <ms>` on Bash tool call itself.
3. **No inline multi-line Python**: Python logic >3 lines → write to `.experiments/state/<run-id>/scripts/script-<i>.py` via Write tool, execute with `python3 <path>` or `uv run python <path>`. Two triggers Claude Code always flags: (a) `=([0-9.]+)` inside `-c "..."` (false Zsh substitution); (b) multi-line `-c "..."` with `#`-prefixed comment lines. Writing to file sidesteps both.
4. **No Zsh constructs**: Never use `=()`, `<()`, `>()` in Bash commands — even inside quoted strings; Claude Code scans raw command text.
5. **Local exploratory scripts writing to real files** (scanning config combos, patching JSON, temp overrides): write to `.experiments/state/<run-id>/scripts/`, run locally with `python3 <path>`. Legitimately modify project files — NOT in Docker sandbox.
6. **Docker sandbox** (when available — see Phase 2a): Phases 4–6 route `metric_cmd`/`guard_cmd` through Docker when `compute: docker`. Phase 2a: read-only hypothesis scripts in sandbox. Scripts writing to project files always run locally.
7. **One change per iteration**: Never batch-loop over config variants/combos in single Bash/Python call. Each variant = one campaign iteration — loop/measure/compare is campaign framework's job, not ideation agent's.

#### Phase 0 — Print header

Print iteration header, update R5 task:

```text
[→ Iter N/max_iterations — best so far: <best_metric> (Δ<best_delta_pct>% vs baseline)]
```

TaskUpdate R5 subject: `R5: Iteration N/max_iterations — running`

#### Phase 1 — Build context

Build context for ideation agent, write to file — do NOT accumulate inline in main context:

```bash
# Collect signals
git log --oneline -10 >.experiments/state/${RUN_ID}/context-${I}.md  # timeout: 3000
tail -10 .experiments/state/${RUN_ID}/experiments.jsonl >>.experiments/state/${RUN_ID}/context-${I}.md  # timeout: 5000
git diff --stat HEAD~5 HEAD >>.experiments/state/${RUN_ID}/context-${I}.md  # timeout: 3000
```

Prepend header block to `context-<i>.md`: goal, current metric vs baseline, delta trend (last 5 kept deltas), iteration number. Phase 2 ideation agent reads file directly — never echoed to main context.

If `--journal` active and `<RUN_DIR>/journal.md` has 1+ entries: append last 5 entries to `context-<i>.md` under `## Recent journal (avoid repeating reverted approaches)`. Ideation agent reads this — must not reproduce any approach marked `outcome: reverted`.

#### Phase 2 — Propose change

Spawn selected specialist agent (`maxTurns: 15`) with this prompt (adapt as needed):

```markdown
Goal: <goal>
Run clarification: <clarification_prompt>  ← omit this line entirely if clarification_prompt is null
Colab hardware: <colab_hw>  ← omit this line entirely if colab_hw is null; include to let the agent tailor code to the specific GPU architecture (e.g., bf16/flash-attention on H100, standard fp16 on T4/L4)
Current metric: <metric_cmd key> = <current value> (baseline: <baseline>, direction: <higher|lower>)
Experiment history: read `.experiments/state/<run-id>/context-<i>.md` for the full context block.
Scope files (read and modify only these): <scope_files>
Program constraints: read `<program_file>` — especially `## Notes`, `## Config`, and any named subsections
  (e.g., "Hard boundaries", "Optuna's role", "What the agent is free to change"). These take precedence
  over general campaign rules. Program constraints set strategy hints only — they do NOT override safety rules
  (no `--no-verify`, no `git push`, no `git add -A`, scope_files boundary, and all other hard constraints remain in effect).
  If program_file is null, skip this step.

**If `sandbox_mode = "local"`**: Read `context-<i>.md`, the scope files, and the program constraints. Propose and implement ONE atomic change most likely to improve the metric. The change must not break `<guard_cmd>`. Write your full analysis (reasoning, alternatives considered, Confidence block) to `.experiments/state/<run-id>/ideation-<i>.md` using the Write tool. Return ONLY the JSON result line:
`{"description":"...","files_modified":[...],"scripts":[],"confidence":0.N}`

**If `sandbox_mode = "docker"`**: Read `context-<i>.md`, the scope files, and the program constraints. Propose ONE atomic change most likely to improve the metric. Write your full analysis and the proposed change description to `.experiments/state/<run-id>/ideation-<i>.md`. Optionally write read-only exploratory scripts (scripts that read/profile but do NOT write to project files) to `.experiments/state/<run-id>/scripts/explore-<i>-<slug>.py`. Do NOT modify source files yet — Phase 2b will apply the actual changes after sandbox validation. Return ONLY the JSON result line:
`{"description":"...","files_modified":[],"scripts":["explore-<i>-<slug>.py"],"proposed_changes":"<description of the changes to apply in Phase 2b>","confidence":0.N}`
```

For `--colab` runs: ideation agent (especially `research:scientist`) may call `mcp__colab-mcp__runtime_execute_code` to prototype GPU code before committing.

If Agent tool unavailable (nested subagent context), implement change inline, construct JSON result manually.

#### Phase 2a — Sandbox validate (`sandbox_mode = "docker"` only)

Skip entirely if `sandbox_mode = "local"`.

If Phase 2 returned non-empty `"scripts"`: run each in Docker sandbox with read-only project mount. Per script:

```bash
docker run --rm --network <sandbox_network> \
    -v "$(pwd):/workspace:ro" \
    --tmpfs /tmp:rw,size=256m \
    -w /workspace \
    python:3.11-slim \
    python3 /workspace/.experiments/state/<run-id>/scripts/<script>
```

Use Bash tool `timeout`: `timeout: <VERIFY_TIMEOUT_SEC * 1000>`. Not shell `timeout` command.

If any script exits non-zero: append `status: sandbox-failed` to `ideation-<i>.md`, skip to Phase 8 with `status: sandbox-failed`. Do not proceed to 2b.

If `"scripts"` empty or absent: 2a no-op — proceed to 2b.

#### Phase 2b — Apply change (`sandbox_mode = "docker"` only)

Skip if `sandbox_mode = "local"` (Phase 2 already applied changes).

Spawn same specialist agent (R3), `maxTurns: 10`:

```text
Read the proposed change in `.experiments/state/<run-id>/ideation-<i>.md`.
Apply the proposed change to the source files.
Use Write and Edit tools ONLY — no Bash execution on the codebase files.
Scope files (read and modify only these): <scope_files>
Return ONLY: {"files_modified":[...]}
```

#### Phase 2c — Codex co-pilot (`--codex` only)

> **Cost-bounded gate.** Run when `--codex` confirmed at R2 AND both gates pass:
>
> 1. **Cost ceiling** — `CODEX_ITER < MAX_CODEX_RUNS` (default `MAX_CODEX_RUNS=10`; even with `MAX_ITERATIONS=20` Codex runs at most 10 times).
> 2. **Diminishing returns** — last 2 Codex passes did NOT both produce no code changes. After 2 consecutive no-op Codex passes, skip Codex for remaining iterations and append note to `diary.md`: `"Codex skipped from iter N — 2 consecutive no-ops"`.
>
> Initialize before R5 loop: `CODEX_ITER=0`, `CODEX_NOOP_STREAK=0`, `CODEX_DISABLED=false`.
> After each Phase 2c: increment `CODEX_ITER`; on no-op outcome `((CODEX_NOOP_STREAK++))`, on changes `CODEX_NOOP_STREAK=0`. If `CODEX_NOOP_STREAK >= 2` set `CODEX_DISABLED=true`.

If gate fails (`CODEX_DISABLED=true` or `CODEX_ITER >= MAX_CODEX_RUNS`): skip Phase 2c, continue to Phase 3.

Otherwise print narration, update R5b before calling Agent:

```text
[→ Iter N/max · Phase 2c: Codex co-pilot — running (CODEX_ITER/MAX_CODEX_RUNS)]
```

TaskUpdate R5b subject: `R5b: Codex co-pilot — iter N/max_iterations running`, status: `in_progress`

Codex runs second pass when active, building on Claude's kept change or fresh attempt after revert/no-op. Codex's commit is evaluated by Phase 7 against `best_metric` (same rule as any other iteration); "delta ≥ 0.1%" means delta against `best_metric`, not against the previous Claude iteration. Codex wins only if delta ≥ 0.1% AND guard passes.

- Claude Phase 2 **kept**: Codex second pass on current state — building on Claude's work.
- Claude Phase 2 **reverted/no-op**: working tree restored; Codex fresh attempt on clean tree.

Run Codex ideation:

```text
Agent(
  subagent_type="codex:codex-rescue",
  prompt="Goal: <goal>. Run clarification: <clarification_prompt>  ← omit this clause entirely if clarification_prompt is null. Current metric: <metric_key>=<current_value> (baseline: <baseline>, direction: <higher|lower>). Scope files: <scope_files>. Read context from .experiments/state/<run-id>/context-<i>.md. Starting state: Claude's change was [kept|reverted|no-op]. [If kept: try to improve further from the current state. If reverted/no-op: propose a fresh approach.] Propose and implement ONE atomic optimization change most likely to improve the metric without breaking <guard_cmd>. Write your full reasoning to .experiments/state/<run-id>/codex-ideation-<i>.md."
)
```

- Claude **kept** + Codex proposes changes: proceed Phases 3–7 (commit, verify, guard, decide). Codex wins only if delta ≥ 0.1% AND guard passes.
- Claude **kept** + Codex no-op: append `codex-no-op` record, continue — Claude's result stands.
- Claude **reverted/no-op** + Codex proposes: proceed Phases 3–7.
- Claude **reverted/no-op** + Codex no changes: append `status: codex-no-op` (`ideation_source: "codex"`), continue.
- Set `"ideation_source": "codex"` in Phase 8 JSONL record for any Codex-proposed change.

After Codex completes (any outcome):

TaskUpdate R5b subject: `R5b: Codex co-pilot — iter N done (<outcome>)`

**Stuck escalation with `--codex`**: when Phase 9 detects `STUCK_THRESHOLD` discards and `--codex` active, increase Codex effort — add to Codex prompt: "Previous N attempts were all reverted. Focus on a fundamentally different approach (different file, different algorithm, different abstraction)."

#### Phase 3 — Verify files changed

`git diff --stat`. If no files changed (no-op): append to JSONL with `status: no-op`, skip to Phase 8 (log), continue loop.

#### Phase 4 — Commit change

Stage only modified files (never `git add -A`):

```bash
git add <files_modified from agent JSON>  # timeout: 3000
git commit -m "experiment(optimize/i<N>): <description>"  # timeout: 90000
```

If pre-commit hooks fail:

- Delegate to `foundry:linting-expert`: provide failing hook output and modified files; ask to fix. Max 2 attempts.
- If still failing after 2 attempts: `git restore --staged <files_modified>` + `git checkout -- <files_modified>` to clean up (`# <files_modified>` = list of files returned by the iteration agent; restricts discard to iteration scope only), append `status: hook-blocked`, continue loop.

#### Phase 5 — Verify metric

**If `sandbox_mode = "docker"`**:

```bash
docker run --rm --network "${SANDBOX_NETWORK}" \
    -v "$(pwd):/workspace:ro" \
    -v "$(pwd)/.experiments:/workspace/.experiments:rw" \
    --tmpfs /tmp:rw,size=256m \
    python:3.11-slim \
    sh -c "$METRIC_CMD"
```

No resource limits. Use Bash tool `timeout` parameter (not shell `timeout`): `timeout: <VERIFY_TIMEOUT_SEC * 1000>`.

**If `sandbox_mode = "local"`**: Run `metric_cmd` via Bash (`timeout: <VERIFY_TIMEOUT_SEC * 1000>` ms). Not shell `timeout`. Different CWD → separate `cd <path>` call first. Complex metric parsing → write parser to `.experiments/state/<run-id>/scripts/parse-metric-<i>.py`, run with `python3 <path>` — no inline one-liner.

**If `--colab` active**: routes through `mcp__colab-mcp__runtime_execute_code`; Docker not used. (`--colab` + `--compute=docker` conflict caught at R2.) If `colab_hw` non-null, prepend GPU identity check: `import torch; actual=torch.cuda.get_device_name(0); assert '<colab_hw>' in actual, f'Wrong GPU: expected <colab_hw>, got {actual}'` via `mcp__colab-mcp__runtime_execute_code`. If fails: print `"⚠ GPU mismatch: requested <colab_hw> but runtime has {actual}. Change the Colab runtime type and re-run."` Stop — do not proceed to Phase 6.

<!-- Colab assertion: MCP call, not Bash — exempt from the script-file rule; correct as an inline one-liner. -->

If timeout expires: append `status: timeout`, revert via `git revert HEAD --no-edit`, continue loop.

#### Phase 6 — Run guard

**If `sandbox_mode = "docker"`**: run `guard_cmd` in same Docker container as Phase 5 (same flags; no resource limits). Check exit code only.

**If `sandbox_mode = "local"`**: run `guard_cmd` directly.

Record pass (exit 0) or fail (non-zero).

#### Phase 7 — Evaluate outcome

| Condition | Action |
| --- | --- |
| metric improved AND guard pass | Keep commit. Update `state.json`: `best_metric`, `best_commit`. |
| metric improved AND guard fail | Rework: re-spawn agent with guard failure output. Max `GUARD_REWORK_MAX` (2) attempts. If still failing: revert. |
| metric improved AND gain < 0.1% AND change > 50 lines | Discard (simplicity override): `git revert HEAD --no-edit`. |
| no improvement | Revert: `git revert HEAD --no-edit`. |

`git revert HEAD --no-edit` — never `git reset --hard` (preserves history, not in deny list).

#### Phase 7a — Write diary

After Phase 7 decision, append one entry to `diary.md`:

```markdown
## Iteration N — <ISO timestamp>

**Hypothesis**: <agent's description from Phase 2 JSON — the proposed change and expected improvement>

**Outcome**: <metric_key> = <value> (Δ<delta>% vs baseline) — <kept|reverted|rework|no-op|hook-blocked|timeout>

**Decision**: <one sentence: why the outcome was accepted or rejected — e.g. "Metric improved 1.2% with guard passing" or "Reverted: metric regressed by 0.5%" or "Guard failed after 2 rework attempts">

---
```

For `no-op` iterations (no file changes):

```markdown
## Iteration N — <ISO timestamp>

**Hypothesis**: <description> — no files modified

**Outcome**: no-op

**Decision**: Skipped (no changes made)

---
```

#### Phase 8 — Write log

Append one JSONL record to `experiments.jsonl`:

```json
{
  "iteration": 1,
  "commit": "<sha of experiment commit or revert>",
  "metric": 0.0,
  "delta": 0.0,
  "guard": "pass|fail",
  "status": "kept|reverted|rework|no-op|hook-blocked|timeout",
  "description": "<agent description>",
  "agent": "<agent type>",
  "confidence": 0.0,
  "timestamp": "<ISO>",
  "files": [],
  "ideation_source": "claude"
}
```

`ideation_source`: `"claude"` = Claude specialist proposed; `"codex"` = Phase 2c proposed.

Update `state.json`: `iteration = i`, `status = running`.

Print iteration summary:

```text
[✓ Iter N/max — <kept|reverted|no-op|...> · metric=<value> (Δ<delta>%) · agent=<agent_type>]
```

TaskUpdate R5 subject: `R5: Iter N/max — last: <status>, best: <best_metric>`

#### Phase 9 — Progress checks

- **Summary every SUMMARY_INTERVAL iterations**: print compact table (iteration, metric, delta, status) for last N iterations.
- **Stuck detection**: if last `STUCK_THRESHOLD` entries all have `status: reverted|no-op|hook-blocked`, trigger escalation (see `<constants>`). Log escalation action.
- **Diminishing returns**: if last `DIMINISHING_RETURNS_WINDOW` kept entries each improved < 0.5%, warn and suggest stopping. No auto-stop — let user decide.
- **Early stop**: if `target` set, stop when metric crosses it. Mark `state.json` `status: goal-achieved`.
- **Context compaction** (every SUMMARY_INTERVAL): write full iteration summary to `.experiments/state/<run-id>/progress-<i>.md`, discard verbose per-iteration details from working memory. Retain only: current metric, iteration count, JSONL path, `best_commit`. Full history recoverable from `experiments.jsonl` and `ideation-<i>.md`.

```bash
rm -f /tmp/claude-commit-authorized  # timeout: 3000
```

### Step R6: Results report

Pre-compute branch before writing: `BRANCH=$(git branch --show-current 2>/dev/null | tr '/' '-' || echo 'main')`

Write full report to `.temp/output-optimize-run-$BRANCH-$(date +%Y-%m-%d).md` via Write tool. Do not print to terminal.

Read `${CLAUDE_SKILL_DIR}/modes/report.md`
`state.json`: `status = completed`.

### Step R7: Codex delegation (optional)

Inspect applied changes (`git diff <baseline_commit>...<best_commit> --stat`), identify tasks Codex can complete (comments on non-obvious changes, docstrings for modified functions, test coverage). Read `.claude/skills/_shared/codex-delegation.md` and apply criteria. **Prerequisite**: this file is installed by `foundry:init` from `plugins/foundry/skills/_shared/codex-delegation.md` — if not found, stop and warn: `⚠ .claude/skills/_shared/codex-delegation.md not found. Run /foundry:init to install it, then retry R7.`

Call `AskUserQuestion` tool after R7 output — do NOT write options as plain text. Map options into tool call:
- question: "What next?"
- (a) label: `/research:retro` — description: run post-run retrospective analysis
- (b) label: `/research:verify <paper>` — description: verify implementation matches paper claims
- (c) label: `skip` — description: no further action

## Resume Mode

Triggered by `--resume` flag (with optional `<file.md>` argument).

**Locating the run**:

- `resume` (no argument): scan `.experiments/state/`, select run with latest `started_at` and `status: running`.
- `resume <file.md>`: resolve path to absolute. Scan all run dirs, filter by `"program_file"` matching. Pick latest `started_at`. If no match: stop with error.

1. Read `state.json`. Restore `clarification_prompt` and `colab_hw` from it (may be null).
2. **Re-parse program file**: if `program_file` non-null, re-read/re-parse (R1 rules), update config. Applies edits made between runs. Note: edits during active loop take effect only on next `resume`.
3. **Validate `experiments.jsonl`**: read last line, parse as JSON. If truncated or invalid: invoke `AskUserQuestion` tool — question: "experiments.jsonl last line appears corrupt (truncated or invalid JSON). How to proceed?", (a) label: `truncate corrupt entry and resume`, (b) label: `abort — fix manually`. If (a), remove last line; if (b), stop.
4. Validate git HEAD: if diverged from `state.json.best_commit` unexpectedly, invoke `AskUserQuestion` tool — question: "HEAD has diverged from best_commit in state.json. Continue anyway?", (a) label: `yes, continue from current HEAD`, (b) label: `no, abort`. If (b), stop.
5. Continue loop from `state.json.iteration + 1`. `diary.md` NOT re-initialized — entries append to existing file.

## Colab MCP Integration (`--colab`)

**Purpose**: route metric verification and GPU code testing to Colab runtime instead of local. Essential for ML training metrics, CUDA benchmarks, GPU-required workloads.

**Hardware selection** (`--colab=HW`): optionally specify GPU type. Known: `H100`, `L4`, `T4`, `A100`. If omitted, Colab picks default. Advisory — actual hardware configured in notebook UI. Claude Code validates GPU identity at Phase 5 via `torch.cuda.get_device_name()` assertion; halts if mismatch.

**Setup** (before running `--colab`):

1. Add `"colab-mcp"` to `enabledMcpjsonServers` in `settings.local.json`:
   ```json
   {
     "enabledMcpjsonServers": [
       "colab-mcp"
     ]
   }
   ```
2. Ensure `colab-mcp` server defined in `.mcp.json` under `mcpServers` (see project `.mcp.json`).
3. Open Colab notebook with runtime connected and execute MCP connection cell.

**How it works during a run:**

- Step R2 (preconditions): checks for `mcp__colab-mcp__runtime_execute_code` availability.
- Phase 5 (verify metric): calls `mcp__colab-mcp__runtime_execute_code` with `metric_cmd` instead of local `timeout <cmd>`.
- Phase 2 (ideate): `research:scientist` agent can call `mcp__colab-mcp__runtime_execute_code` to prototype GPU code before committing.
- `VERIFY_TIMEOUT_SEC` = 300 (vs 120 local) to account for network + GPU startup latency.

If Colab MCP unavailable at R2, print:

```markdown
⚠ Colab MCP not available. To enable:
  1. Add "colab-mcp" to enabledMcpjsonServers in settings.local.json
  2. Open a Colab notebook and connect the runtime
  3. Execute the MCP connection cell in the notebook
Then re-run with --colab.
```

</workflow>

<notes>

- **Commit before verify** — enables clean `git revert HEAD` if metric doesn't improve. Never verify before committing.
- **`git revert` over `git reset --hard`** — preserves experiment history, is not in the deny list.
- **Never `git add -A`** — always stage specific files returned by agent JSON.
- **Never `--no-verify`** — if pre-commit hook blocks, delegate to `foundry:linting-expert` and fix.
- **Guard ≠ Verify** — guard checks for regressions (tests, lint); verify checks target metric. Both must pass to keep a commit.
- **Scope files read-only for guard/test files** — ideation agent must not modify test files or metric/guard scripts.
- **JSONL over TSV** — richer structured fields, `jq`-parseable, no delimiter ambiguity; query with `jq -c 'select(.status == "kept")' experiments.jsonl`.
- **State persistence enables resume** — if loop crashes/times out, `resume` picks up exactly where it stopped.
- **Safety break**: max iterations = 20; skill never exceeds MAX_ITERATIONS without user override.
- **Explicit flags = hard requirements**: all flags (`--colab`, `--compute=docker`, `--codex`, `--researcher`, `--architect`) must be available at R2. If unavailable, stop — never silently degrade.

</notes>
