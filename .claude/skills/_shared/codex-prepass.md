Before cycle 1 of the review loop, run a Codex pre-pass if the diff is meaningful:

```bash
which codex || echo "codex not installed — skipping pre-pass"
git diff HEAD --stat
```

**Skip** this step if:

- codex is not installed
- `git diff HEAD --stat` shows only 1–3 lines changed, or changes are formatting, comments, whitespace, or variable renames only

**Run** when changes include new logic, functions, conditionals, error paths, or restructured code:

```bash
codex exec "Review the staged diff (git diff HEAD). Flag bugs, missed edge cases, incorrect logic, and inconsistencies with existing code patterns. Skip cosmetic nits." --sandbox workspace-write
```

Treat any Codex findings as pre-flagged issues entering cycle 1. If Codex found nothing or was skipped, start cycle 1 from scratch.
