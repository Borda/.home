---
name: optimize
description: Performance deep-dive orchestrator. Establishes a baseline, spawns perf-optimizer agent to identify the real bottleneck, and produces a before/after report. Covers CPU, memory, I/O, concurrency, and ML/GPU workloads.
argument-hint: <file, module, or directory>
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>

Orchestrate a performance investigation using the perf-optimizer agent. This skill handles the measurement bookends (baseline → change → verify) while the agent handles the actual analysis and implementation.

</objective>

<inputs>

- **$ARGUMENTS**: file, module, or directory to optimize.

</inputs>

<workflow>

## Step 1: Establish baseline

Before touching any code, measure current performance:

```bash
# Python script / module
python -m cProfile -s cumtime $ARGUMENTS 2>&1 | head -30

# Quick wall-clock timing
time python $ARGUMENTS

# Memory snapshot
python -c "import tracemalloc; tracemalloc.start(); exec(open('$ARGUMENTS').read()); print(tracemalloc.get_traced_memory())"
```

Record the baseline numbers — they are the benchmark for all improvements.

## Step 2: Spawn perf-optimizer agent

Task the `perf-optimizer` agent with:

1. Read all relevant code files in and around `$ARGUMENTS`
2. Apply the optimization hierarchy (algorithm → data structure → I/O → memory → concurrency → vectorization → compute → caching)
3. Identify the **single biggest bottleneck** — not a laundry list
4. Implement a targeted fix for that bottleneck
5. Identify 2 additional bottlenecks to address next

## Step 3: Verify improvement

After each change from the perf-optimizer:

```bash
# Re-run the same baseline measurement
python -m cProfile -s cumtime $ARGUMENTS 2>&1 | head -30
time python $ARGUMENTS
```

**Accept** if improvement > 10%. **Revert** if not measurable or < noise floor.

## Step 4: Report

```
## Performance Optimization: [target]

### Baseline
- [metric]: [value]

### Changes Applied
1. **[bottleneck]**: [what changed] → [measured improvement]
2. **[bottleneck]**: [what changed] → [measured improvement]

### After
- [metric]: [new value] ([X]x improvement)

### Remaining Opportunities
- [next bottleneck to address]
```

</workflow>

<notes>

- The perf-optimizer agent has the full optimization knowledge base — this skill only orchestrates the measure-change-measure loop
- Never skip the baseline measurement — unmeasured optimization is guessing
- For ML-specific optimization (DataLoader, mixed precision, torch.compile), the perf-optimizer agent has dedicated sections
- Follow-up chains:
  - Bottleneck is architectural (not just a hot loop) → `/refactor` for structural changes with test safety net
  - Optimization changes non-trivial code paths → `/review` for quality validation

</notes>
