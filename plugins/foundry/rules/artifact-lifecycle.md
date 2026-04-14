---
description: Canonical artifact directory layout, run-dir naming convention, and TTL policy for all skill outputs
paths:
  - '**'
---

## Canonical artifact layout

All runtime artifacts live at the **project root**, not inside `.claude/`. Skill output directories use a dot-prefix (`.reports/`, `.temp/`, `.plans/`, etc.) to signal they are ephemeral.

```
.plans/
  blueprint/             ← /brainstorm spec and tree files  (was .brainstorming/)
  active/                ← todo_*.md, plan_*.md
  closed/                ← completed plans
.notes/                  ← lessons.md, diary, guides  (was _tasks/_working/)
.reports/
  calibrate/             ← /calibrate skill runs
  resolve/               ← /resolve lint+QA gate runs
  audit/                 ← /audit skill runs
  review/                ← /review skill runs
  analyse/               ← /analyse skill (thread, ecosystem, health subdirs)
.experiments/            ← /optimize skill runs (run mode)
.developments/           ← /develop review-cycle runs
.cache/
  gh/                    ← shared GitHub API response cache (cross-skill)
.temp/                   ← quality-gates prose output (cross-cutting)
```

All dot-prefixed artifact dirs are gitignored — they are ephemeral and TTL-managed.

## Run directory naming

Every skill creates a timestamped subdirectory using its canonical base dir:

```bash
RUN_DIR=".reports/<skill>/$(date -u +%Y-%m-%dT%H-%M-%SZ)" # for .reports/<skill>/ skills
# or: RUN_DIR=".<skill>/$(date -u +%Y-%m-%dT%H-%M-%SZ)"   # for dedicated dirs (.experiments/, .developments/)
mkdir -p "$RUN_DIR"
```

Format: `YYYY-MM-DDTHH-MM-SSZ` (UTC, dashes throughout, filesystem-safe). Example: `.reports/calibrate/2026-03-27T20-06-22Z/`.

A completed run always contains `result.jsonl`. Incomplete runs (crashed, timed out) lack it — the TTL hook skips them (intentional: keeps them for debugging).

## TTL policy

| Location                                                                   | TTL     | Condition                                           |
| -------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| `.reports/<skill>/YYYY-MM-DDTHH-MM-SSZ/`, `.<skill>/YYYY-MM-DDTHH-MM-SSZ/` | 30 days | only dirs containing `result.jsonl`                 |
| `.plans/blueprint/`                                                        | 30 days | keyed on file mtime (flat spec/tree files)          |
| `.cache/gh/`                                                               | 30 days | keyed on file mtime (GitHub API response cache)     |
| `.temp/`                                                                   | 30 days | keyed on file mtime                                 |
| `.plans/active/`, `.plans/closed/`                                         | manual  | move to `closed/` when done; never auto-delete      |
| `.notes/`                                                                  | manual  | human-maintained                                    |
| `releases/<version>/`                                                      | manual  | release artefacts; archive or delete after shipping |

Log file TTL and the SessionEnd cleanup hook script are in `.claude/rules/foundry-config.md` (foundry-infrastructure only).
