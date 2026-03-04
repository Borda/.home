---
name: resolve
description: 'Thin dispatch — pass a review comment straight to Codex and get a verdict back. Use whenever a comment is already well-formulated and you want it applied immediately without the full PR fetch workflow. Reports: resolved (code changed) or no change (Codex explains why — already done, irrelevant, or needs more context).'
argument-hint: <review comment, inline suggestion, or issue text>
disable-model-invocation: true
allowed-tools: Bash, TaskCreate, TaskUpdate
---

<objective>

Pure Codex proxy: pass the comment to Codex, check whether code changed, surface Codex's own explanation. No secondary model involved.

</objective>

<inputs>

- **$ARGUMENTS**: the review comment text — passed as-is to Codex

</inputs>

<workflow>

## Step 1: Pre-flight

```bash
which codex
```

If codex is not on PATH: stop with `Pre-flight failed: codex not found. Install: npm install -g @openai/codex`

## Step 2: Create task

Create a task for this comment so progress is visible across multiple `/resolve` calls:

```
TaskCreate(
  subject="Resolve: <60-char summary of $ARGUMENTS>",
  description="<full $ARGUMENTS>",
  activeForm="Resolving comment"
)
```

Mark it `in_progress` immediately.

## Step 3: Snapshot pre-Codex state

```bash
git diff HEAD --stat
```

Record whether the working tree was already dirty before Codex ran. This becomes the **Pre-existing** column: if Codex makes no changes and explains the change was already present, mark ✓; if Codex makes changes or explains it needs more context, mark ✗.

## Step 4: Dispatch

```bash
codex exec "Apply this review comment to the codebase. If the change is already present, or the comment has no actionable code change, make no changes and briefly explain why. Comment: $ARGUMENTS" --sandbox workspace-write
```

## Step 5: Assess outcome, update task, and report

```bash
git diff HEAD --stat
git diff HEAD
```

Mark the task `completed`, then print:

```
## Resolve Report

| # | Comment | Codex Action | Pre-existing |
|---|---------|--------------|--------------|
| 1 | <30-char summary of $ARGUMENTS> | <what Codex did, or its explanation if no change> | ✓ already done / ✗ not yet |

**Verdict**: ✓ resolved | ⊘ no change — <Codex's reason>

### Diff
<git diff output if resolved, otherwise omit>

**Next**: <one line — e.g. "review diff and commit" | "reply to reviewer: <Codex's reason>">
```

</workflow>

<notes>

- **Pure proxy**: Codex handles both the implementation and the explanation — no Claude reasoning, no secondary agent
- **Verdict from git state**: `git diff HEAD --stat` is the authoritative signal, not Codex's prose
- **`disable-model-invocation: true`**: invoke explicitly as `/resolve <comment>` — never auto-triggered
- Follow-up chains:
  - resolved → review `git diff HEAD`, commit when satisfied; optionally `/review` for a quality pass on non-trivial changes
  - no change (needs context) → reply to the reviewer with Codex's explanation; once clarified, run `/resolve` again

</notes>
