# Upgrade Mode — foundry:audit

Triggered by `/audit upgrade`. This file is read and executed by `/audit` when the `upgrade` argument is present.

______________________________________________________________________

## Mode: upgrade

**Trigger**: `/audit upgrade`

**Purpose**: Apply documented Claude Code improvements that passed the genuine-value filter. Config changes are applied and correctness-checked immediately. Capability changes are A/B tested via a mini calibrate pipeline — accepted only if Δrecall ≥ 0 and ΔF1 ≥ 0.

**Task tracking**: TaskCreate "Fetch upgrade proposals", "Apply config proposals", "A/B test capability proposals". Mark in_progress/completed throughout.

### Phase 1: Gate check

Before applying anything, verify the baseline is structurally sound:

```bash
# Check for the most likely breaking issue — frontmatter conflicts — without running the full audit
for f in .claude/agents/*.md .claude/skills/*/SKILL.md; do # timeout: 5000
    awk '/^---$/{c++} c<2' "$f" 2>/dev/null | grep -q 'context: fork' &&
    awk '/^---$/{c++} c<2' "$f" 2>/dev/null | grep -q 'disable-model-invocation: true' &&
    echo "BREAKING: $f — context:fork + disable-model-invocation:true"
done
```

If any critical or high issues are known from a recent `/audit` run, or the gate check above finds a BREAKING issue: stop and print "⚠ Resolve critical/high findings first (`/audit fix high`), then re-run `/audit upgrade`."

### Phase 2: Fetch and classify proposals

**Always spawn a fresh foundry:web-explorer** — do not use context from previous audit runs, cached docs, or memory. Every upgrade run must fetch live docs.

Run the **Claude Code docs freshness** check from Step 4 of the main audit workflow: spawn foundry:web-explorer, validate current config against latest docs, apply genuine-value filter, produce the Upgrade Proposals table. Cap at 5 total (max 3 capability, any number of config).

**RTK hook alignment** — also run Check 10 from the main audit workflow (inline, no subagent needed):

- If `rtk` is not installed or `.claude/hooks/rtk-rewrite.js` does not exist: skip silently.
- Otherwise: run `rtk --help`, extract `RTK_PREFIXES` from the hook, compare, and add any findings as **config proposals** in the table:
  - Invalid prefix (not a valid RTK subcommand) → config proposal: remove from `RTK_PREFIXES`; severity **high**
  - Filterable RTK command absent from hook → config proposal: add to `RTK_PREFIXES`; severity **medium**

Include these alongside docs-based proposals in the same Upgrade Proposals table.

If no proposals pass the filter: print "✓ No upgrade proposals — current setup is current." and stop.

### Phase 3: Apply config proposals

Mark "Apply config proposals" in_progress. For each **config** proposal, in sequence:

1. Apply the change (Edit/Write tool)
2. Correctness check:
   ```bash
   # settings.json — JSON validity
   jq empty .claude/settings.json && echo "✓ valid JSON" || echo "✗ invalid JSON" # timeout: 5000
   # JS hook files — syntax check
   node --check .claude/hooks/*.js 2>&1 | grep -v '^$' || true # timeout: 5000
   ```
3. Accept (✓) if check passes; revert and mark rejected (✗) with reason if it fails

Mark "Apply config proposals" completed.

### Phase 4: A/B test capability proposals

Mark "A/B test capability proposals" in_progress. For each **capability** proposal (max 3), in sequence:

**Step a — Baseline calibration**: Read `.claude/skills/calibrate/templates/pipeline-prompt.md`. Spawn a `general-purpose` subagent using that template with the target agent name, domain, N=3, MODE=fast, AB_MODE=false. Capture `recall_before` and `f1_before` from the returned JSON.

**Step b — Apply change**: Edit the target agent file per the proposal spec.

**Step c — Post calibration**: Spawn the same pipeline subagent again with identical parameters. Capture `recall_after` and `f1_after`.

**Step d — Decision**:

- `Δrecall = recall_after − recall_before`
- `ΔF1 = f1_after − f1_before`
- **Accept** (✓) if Δrecall ≥ 0 AND ΔF1 ≥ 0 → keep the change
- **Revert** (✗) if either delta is negative → restore the file, record the deltas

Mark "A/B test capability proposals" completed.

### Phase 5: Report and sync

```
## Upgrade Complete — <date>

### Gate
[clean / issues found and stopped]

### Config Changes
| # | Feature | Target | Result | Notes |
|---|---------|--------|--------|-------|
| 1 | ... | hooks/task-log.js | ✓ accepted | jq valid |

### Capability Changes
| # | Feature | Target | Δrecall | ΔF1 | Result |
|---|---------|--------|---------|-----|--------|
| 1 | ... | agents/self-mentor.md | +0.04 | +0.02 | ✓ accepted |
| 2 | ... | agents/sw-engineer.md | −0.02 | +0.01 | ✗ reverted |

### Next Steps
- `/foundry:init` — propagate accepted changes to ~/.claude/
- `/audit` — confirm clean baseline after upgrades
- Reverted items: run `/calibrate <agent> full` for deeper A/B signal (N=10 vs N=3 used here)
```

Propose `/foundry:init` to the user after upgrade completes — do not auto-execute. Print: `→ Run \`/foundry:init\` to propagate accepted changes to ~/.claude/\`
