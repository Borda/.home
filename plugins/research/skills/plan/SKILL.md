---
name: plan
description: Interactive wizard that scans the codebase, proposes a metric/guard/agent config, and writes a program.md run spec. Also runs cProfile on a file path to surface bottlenecks before prompting for optimization goal.
argument-hint: <goal> | <file.py> [out.md]
effort: medium
allowed-tools: Read, Write, Bash, Grep, Glob, Agent, TaskCreate, TaskUpdate, AskUserQuestion
disable-model-invocation: true
---

<objective>

Interactive wizard that scans the codebase, proposes a metric/guard/agent config, and writes a `program.md` run spec. Also runs cProfile on a file path to surface bottlenecks before prompting for the optimization goal.

NOT for: running experiments (use `/research:run`); methodology validation (use `/research:judge`); full pipeline from goal to result (use `/research:sweep`).

</objective>

## Agent Resolution

> **Foundry plugin check**: run `ls ~/.claude/plugins/cache/ 2>/dev/null | grep -q foundry` (exit 0 = installed). If the check fails, proceed as if foundry is available — it is the common case; only fall back if an agent dispatch explicitly fails.

When foundry is **not** installed, substitute foundry agents with `general-purpose` and prepend the role description:

| foundry agent                | Fallback          | Model      | Role description prefix                                                                                                                                   |
| ---------------------------- | ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundry:solution-architect` | `general-purpose` | `opusplan` | `You are a system design specialist. Evaluate scope coverage and architectural dependencies. Return structured JSON only.`                                |
| `foundry:perf-optimizer`     | `general-purpose` | `opus`     | `You are a performance engineer. Validate that metric_cmd measures the right characteristic and guard_cmd is comprehensive. Return structured JSON only.` |

`research:scientist` is in the same plugin — no fallback needed.

<workflow>

## Plan Mode (Steps P-P0–P-P3)

<!-- P-P prefix = Plan-mode steps; R-prefix = Run-mode steps; these labels appear in task-tracking instructions -->

Triggered by `plan <goal|file>`. Interactive wizard to configure a run.

**Task tracking**: create tasks for P-P0, P-P1, P-P2, P-P2b, P-P3 at start.

### Step P-P0: Detect input type

Parse `<input>` from arguments. Determine whether it is a **file path** or a **goal string**:

1. If the argument contains no spaces AND `test -f <argument>` succeeds → **file path**. Enter profiling flow below.
2. Otherwise → **goal string**. Skip to Step P-P1.

**Profiling flow** (file path detected):

Run baseline profiling:

```bash
python3 -m cProfile -s cumtime "$ARGUMENTS" 2>&1 | head -40
time python3 "$ARGUMENTS"
```

Present the top 5 bottleneck functions. Then ask:

```
Top bottleneck functions:
1. <function> — <cumtime>s (<percentage>%)
2. <function> — <cumtime>s (<percentage>%)
...

What would you like to optimize?
  (a) Overall execution time
  (b) Memory usage
  (c) Specific function: <top function name>
  (d) Custom goal: <describe>
```

Construct a goal string from the user's selection:

- (a) → `"Reduce wall-clock execution time of <file>"`
- (b) → `"Reduce peak memory usage of <file>"`
- (c) → `"Optimize <function> in <file> (currently <time>s)"`
- (d) → user's text

Set the constructed string as `<goal>` and proceed to Step P-P1.

### Step P-P1: Parse and scan

**Scope guard (first action)**: Before scanning, check whether `<goal>` is an optimization goal. If the input is clearly not an optimization goal — e.g., a question about code semantics, a regex or algorithm explanation request, a debugging question, or any prompt that does not describe a measurable improvement target — print:

```
⚠ This input does not look like an optimization goal.
/research:plan expects: "Reduce X" / "Increase Y" / "Improve Z metric".
Use /research for explanatory questions.
```

Then stop. Do not proceed to P-P2 or P-P3.

Parse `<goal>` from arguments. Scan the codebase to detect:

- Language and framework (Python, PyTorch, pytest, etc.)
- Available test runners or benchmark scripts
- Candidate metric commands (pytest coverage, benchmark scripts, eval scripts)
- Candidate guard commands (test suite, lint, type check)
- Files relevant to the goal (scope files)

### Step P-P2: Present proposed config

Present the proposed config as a code block for user review. Include:

```
metric_cmd:      [command that prints a single numeric result]
metric_direction: higher | lower
guard_cmd:       [command that must pass (exit 0) on every kept commit]
max_iterations:  [default 20]
agent_strategy:  [auto | perf | code | ml | arch]
scope_files:     [files the ideation agent may modify]
compute:         local | colab | docker
```

Dry-run both commands before presenting. If either fails, flag the error and propose corrections. Do not proceed to P-P3 until the user confirms or edits the config.

### Step P-P2b: Agent validation (pre-write)

After user confirms the config, run expert agent review before writing `program.md`. Dispatches are conditional on goal type — run whichever apply in parallel:

**Always** — spawn architect to validate scope coverage:

```
Agent(subagent_type="foundry:solution-architect", prompt="Review a proposed research experiment scope.\n\nGoal: <goal>\nScope files: <scope_files>\nMetric command: <metric_cmd>\n\nCheck: (1) Do scope_files cover the components relevant to the goal? List architectural dependencies outside scope that the ideation agent would need to touch. (2) Are there shared abstractions (base classes, imports, shared state) outside scope required for changes within it?\n\nReturn ONLY: {\"ok\":true|false,\"gaps\":[\"...\"],\"suggestions\":[\"...\"],\"confidence\":0.N}")
```

**If `agent_strategy = ml` or goal contains ML keywords (accuracy, loss, model, training, inference, classification, regression)** — also spawn research:scientist:

```
Agent(subagent_type="research:scientist", prompt="Review a proposed ML experiment configuration.\n\nGoal: <goal>\nMetric command: <metric_cmd>\nAgent strategy: <agent_strategy>\n\nCheck: (1) Is the goal a well-formed ML hypothesis — falsifiable, with a concrete success criterion? (2) Could metric_cmd improve while the real goal is not achieved (Goodhart's Law)? (3) Is agent_strategy appropriate for this goal type?\n\nReturn ONLY: {\"ok\":true|false,\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"confidence\":0.N}")
```

**If `agent_strategy = perf` or goal contains performance keywords (latency, throughput, wall-clock, speed, memory, FPS)** — also spawn perf:

```
Agent(subagent_type="foundry:perf-optimizer", prompt="Review a proposed performance experiment configuration.\n\nGoal: <goal>\nMetric command: <metric_cmd>\nGuard command: <guard_cmd>\n\nCheck: (1) Does metric_cmd measure the right performance characteristic for this goal? (2) Is guard_cmd comprehensive enough to catch regressions an ideation agent might introduce?\n\nReturn ONLY: {\"ok\":true|false,\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"confidence\":0.N}")
```

Print advisory block below the config:

```
Advisory review:
  architect: <gaps or "scope looks complete">
  scientist:  <issues or "hypothesis is well-formed">   [only if dispatched]
  perf:       <issues or "metric/guard look valid">      [only if dispatched]
```

If any agent returns `ok: false`: surface suggestions inline and ask the user whether to revise the config (re-enter P-P2) or proceed anyway. Do not block — user decides.

### Step P-P3: Write program.md

Determine the output path: if the user provided a second argument after `<goal>`, use that path; otherwise use `program.md` at the project root.

**Overwrite check**: if the output path already exists, print a one-line warning and use `AskUserQuestion` to ask: (a) Overwrite — proceed; (b) Abort — stop. No silent overwrite.

Write the file using this canonical template, pre-populated from the wizard's findings:

````markdown
# Program: <title from goal>

## Goal
<one-paragraph description of what to improve and why>

## Metric
```
command: <metric_cmd from wizard>
direction: higher | lower
target: <optional numeric goal — campaign stops when crossed>
```

## Guard
```
command: <guard_cmd from wizard>
```

## Config
```
max_iterations: 20
agent_strategy: auto | perf | code | ml | arch
scope_files:
  - <path or glob>
compute: local | colab | docker
colab_hw:                         # optional: H100 | L4 | T4 | A100 (used when compute: colab)
sandbox_network: none | bridge
```

## Notes
<optional free-form text — strategy hints, context, known constraints — ignored by the skill>
````

Print:

```
✓ Program saved to program.md

Next steps:
  /research:judge program.md   ← validate plan before running (recommended)
  /research:run program.md     ← start iteration loop directly
```

## --team flag

If `--team` is present in arguments: after the program.md is written, also read `plugins/research/skills/run/team.md` to understand the team protocol. Inform the user that `--team` applies at the run step (not the plan step), and that they can use `/research:run <program.md> --team` to execute the plan with team mode active.

</workflow>
