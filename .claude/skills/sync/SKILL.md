---
name: sync
description: Drift-detect and sync project .claude/ config to home ~/.claude/. Default mode shows a drift report; pass "apply" to perform the sync and report the outcome.
argument-hint: '[apply]'
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep
---

<objective>

Compare the project-level `.claude/` (source of truth) against home `~/.claude/` and report every file that is missing, differs, or is identical. When called with `apply`, perform the sync and report what changed.

File set is derived from `git ls-files .claude/` — only git-tracked files are synced; gitignored paths (`.claude/state/`, `.claude/logs/`, `settings.local.json`) are automatically excluded.

</objective>

<inputs>

- **$ARGUMENTS**: optional
  - Omitted → dry-run: show drift report only, no files written
  - `apply` → apply sync: copy files and report outcome

</inputs>

<constants>

- PROJECT root: `$(git rev-parse --show-toplevel)`
- HOME_CLAUDE: `~/.claude`
- File set: `git ls-files .claude/` — git-tracked files only; gitignored paths excluded automatically
- settings.json transform: replace every `node .claude/hooks/` with `node $HOME_EXPANDED/.claude/hooks/` (absolute). Covers all hooks — statusLine, task-log, and any future additions.

</constants>

<workflow>

## Step 1: Discover files

```bash
PROJECT="$(git rev-parse --show-toplevel)"
git -C "$PROJECT" ls-files .claude/
```

This emits paths relative to the project root (e.g. `.claude/agents/foo.md`, `.claude/settings.json`). All subsequent steps iterate over this list.

## Step 2: Diff all files

Single loop — strips `.claude/` prefix to derive the home target path. `settings.json` is compared after applying the hook-path transform so that the relative→absolute difference doesn't show as a false diff:

```bash
PROJECT="$(git rev-parse --show-toplevel)"
HOME_CLAUDE=~/.claude
HOME_EXPANDED="$(eval echo ~)"

while IFS= read -r rel; do
  suffix="${rel#.claude/}"          # e.g. agents/foo.md, settings.json
  src="$PROJECT/$rel"
  target="$HOME_CLAUDE/$suffix"

  if [ ! -f "$target" ]; then
    echo "MISSING   $suffix"
  elif [ "$suffix" = "settings.json" ]; then
    # Compare with hook paths already transformed to absolute
    if diff -q \
        <(sed "s|node .claude/hooks/|node $HOME_EXPANDED/.claude/hooks/|g" "$src") \
        "$target" > /dev/null 2>&1; then
      echo "IDENTICAL $suffix"
    else
      echo "DIFFERS   $suffix"
      diff <(sed "s|node .claude/hooks/|node $HOME_EXPANDED/.claude/hooks/|g" "$src") \
           "$target" | head -20
    fi
  else
    if diff -q "$src" "$target" > /dev/null 2>&1; then
      echo "IDENTICAL $suffix"
    else
      echo "DIFFERS   $suffix"
      diff "$src" "$target" | head -10
    fi
  fi
done < <(git -C "$PROJECT" ls-files .claude/)
```

## Step 3: Produce drift report

```
## .claude Drift Report — <date>

| File | Status | Action |
|------|--------|--------|
| agents/sw-engineer.md   | DIFFERS  | copy   |
| agents/qa-specialist.md | IDENTICAL| none   |
| hooks/task-log.js       | MISSING  | copy   |
| settings.json           | DIFFERS  | merge  |

Files in sync: N/M
Files to update: N
```

If `$ARGUMENTS` is empty: stop here, print the report, and offer `/sync apply` to apply all changes.

## Step 4: Apply sync (only when $ARGUMENTS == "apply")

Same loop — `mkdir -p` ensures any new subdirectory is created; `settings.json` gets the hook-path transform:

```bash
PROJECT="$(git rev-parse --show-toplevel)"
HOME_CLAUDE=~/.claude
HOME_EXPANDED="$(eval echo ~)"

while IFS= read -r rel; do
  suffix="${rel#.claude/}"
  src="$PROJECT/$rel"
  target="$HOME_CLAUDE/$suffix"

  mkdir -p "$(dirname "$target")"

  if [ "$suffix" = "settings.json" ]; then
    sed "s|node .claude/hooks/|node $HOME_EXPANDED/.claude/hooks/|g" \
      "$src" > "$target"
    echo "merged   $suffix"
  else
    cp "$src" "$target"
    echo "copied   $suffix"
  fi
done < <(git -C "$PROJECT" ls-files .claude/)
```

## Step 5: Verify and report outcome

```bash
PROJECT="$(git rev-parse --show-toplevel)"
HOME_CLAUDE=~/.claude
HOME_EXPANDED="$(eval echo ~)"

# Count totals
TOTAL=$(git -C "$PROJECT" ls-files .claude/ | wc -l | tr -d ' ')
echo "Total files synced: $TOTAL"

# JSON validity
python3 -c "import json, os; json.load(open(os.path.expanduser('~/.claude/settings.json'))); print('settings.json: valid')"

# Post-sync drift — re-run the diff loop and count non-IDENTICAL lines
DRIFT=0
while IFS= read -r rel; do
  suffix="${rel#.claude/}"
  src="$PROJECT/$rel"
  target="$HOME_CLAUDE/$suffix"
  if [ ! -f "$target" ]; then
    echo "STILL MISSING: $suffix"; DRIFT=$((DRIFT+1))
  elif [ "$suffix" = "settings.json" ]; then
    diff -q <(sed "s|node .claude/hooks/|node $HOME_EXPANDED/.claude/hooks/|g" "$src") \
            "$target" > /dev/null 2>&1 || { echo "STILL DIFFERS: $suffix"; DRIFT=$((DRIFT+1)); }
  else
    diff -q "$src" "$target" > /dev/null 2>&1 || { echo "STILL DIFFERS: $suffix"; DRIFT=$((DRIFT+1)); }
  fi
done < <(git -C "$PROJECT" ls-files .claude/)
echo "Post-sync drift: $DRIFT file(s)"
```

Print a final outcome table:

```
## Sync Outcome — <date>

| Metric          | Value    |
|-----------------|----------|
| Files synced    | N        |
| settings.json   | merged   |
| JSON validity   | valid    |
| Post-sync drift | 0        |
```

</workflow>

<notes>

- File set comes from `git ls-files .claude/` — adding a new agent, skill, or hook to git automatically includes it in future syncs; no skill edits needed
- NEVER copy `settings.local.json` — keep it gitignored so it's excluded automatically
- All `node .claude/hooks/` paths in settings.json are rewritten to absolute — relative paths fail when hooks fire in other projects
- The project `.claude/` is always the source of truth; never sync home → project
- Run `/sync` (dry-run) first to review changes before running `/sync apply`

</notes>
