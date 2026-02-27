---
name: survey
description: Survey SOTA literature for an AI/ML topic, method, or architecture. Finds relevant papers, builds a comparison table, and recommends the best implementation strategy for the current codebase. Delegates deep analysis to the ai-researcher agent.
argument-hint: <topic, method, or problem>
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task, WebSearch, WebFetch
---

<objective>

Survey the literature on an AI/ML topic and return actionable findings: what SOTA methods exist, which fits best for the current use case, and a concrete implementation plan. This skill is an orchestrator — it gathers codebase context, delegates literature search and analysis to the ai-researcher agent, and packages results into a structured report.

This skill is NOT for doing research or designing experiments — use the `ai-researcher` agent directly for hypothesis generation, ablation design, and experiment validation.

</objective>

<inputs>

- **$ARGUMENTS**: topic, method name, or problem description (e.g. "object detection for small objects", "efficient transformers", "self-supervised pretraining for medical images").

</inputs>

<workflow>

## Step 1: Understand the codebase context

Before searching, read the current project to extract constraints:

- Framework in use (PyTorch, JAX, TensorFlow, scikit-learn)?
- Task being solved (classification, detection, generation, regression)?
- Constraints (latency, memory, dataset size, compute budget)?

## Step 2: Research & codebase check (run in parallel)

Launch both tasks simultaneously — they are independent.

### 2a: Spawn ai-researcher agent (background subagent)

Task the ai-researcher with a single objective: find the top 5 papers for `$ARGUMENTS`, produce a comparison table (method, key idea, benchmark results, compute, code availability), and recommend the single best method given the codebase constraints in Step 1 — with a brief implementation plan. The agent's own workflow handles the research and experiment design details.

### 2b: Check for existing implementations (main context)

```bash
# Search the codebase for any existing related code
grep -r "$ARGUMENTS" . --include="*.py" -l 2>/dev/null | head -10
```

## Step 3: Report

```
## Survey: $ARGUMENTS

### SOTA Overview
[2-3 sentence summary of the current state of the field]

### Method Comparison
| Method | Key Idea | SOTA Result | Compute | Code Available |
|--------|----------|-------------|---------|----------------|
| ...    | ...      | ...         | ...     | Yes/No + link  |

### Recommendation
**Use [method]** because [specific reason matching the current codebase constraints].

### Implementation Plan
1. [step with file/component to change]
2. [step]
3. [step]

### Key Hyperparameters
- [param]: [typical range] — [what it controls]

### Gotchas
- [common failure mode and how to avoid it]

### Integration with Current Codebase
- Files to modify: [list with file:line references]
- New dependencies needed: [package versions]
- Estimated effort: [hours/days]
- Risk assessment: [what could go wrong during integration]

### References
- [Paper title] ([year]) — [link]
```

</workflow>

<notes>

- This skill orchestrates — it gathers context and delegates research to `ai-researcher`. For direct hypothesis/experiment work, use the agent directly.
- **Link integrity**: All URLs cited in the survey report must be fetched and verified before inclusion. Use WebFetch to confirm each URL exists and says what you claim.
- Follow-up chains:
  - Survey recommends a method for implementation → `/feature` for TDD-first implementation of the chosen approach
  - Survey integrates into existing code → `/refactor` first to prepare the module, then `/feature`
  - Survey reveals security concerns with a dependency → `/security` for deep audit

</notes>
