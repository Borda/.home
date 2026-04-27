---
name: calibrate
description: Minimal codex-native calibration loop. Use to detect leaks or major gaps across mirrored skills and agents with fixed checks.
---

# Calibrate

Run a linear calibration loop for codex workflow integrity.

## Input Schema

```json
{
  "scope": "skills|agents|routing|all",
  "pace": "fast|full",
  "mode": "ab-test|apply",
  "skip_gate": false,
  "done_when": "recall and bias scores emitted; proposals written if mode=apply; gate skipped if skip_gate=true"
}
```

## Workflow

1. Load calibration task set from `.codex/calibration/tasks.json`.
2. Run `.codex/calibration/run.sh`.
3. Inspect `checks_failed` and `leaks_found`.
4. Classify gaps as blocking or non-blocking.
5. Recommend minimal fixes for blocking gaps.
6. Write artifact to `.reports/codex/calibrate/<timestamp>/result.json`.

## Usage Notes

- Use after any meaningful agent or skill instruction change to confirm routing and output shape still match the configured stack.
- Treat `leaks_found` as the primary drift signal and `checks_failed` as the mechanical gate signal.
- If the run surfaces missing registration or pattern mismatches, prefer a minimal config fix and rerun before widening the change.

## Output Contract

Use shared gate schema from `../_shared/quality-gates.md`.

Minimum artifact payload:

```json
{
  "status": "pass|fail",
  "checks_run": [
    "calibration"
  ],
  "checks_failed": [],
  "findings": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "confidence": 0.0,
  "artifact_path": ".reports/codex/calibrate/<timestamp>/result.json"
}
```
