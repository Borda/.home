---
name: sync
description: Drift-detect and sync project .claude/ config to home ~/.claude/. Default mode shows a drift report; pass "apply" to perform the sync and report the outcome.
argument-hint: [apply]
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep
---

<objective>

Compare the project-level `.claude/` (source of truth) against home `~/.claude/` and report every file that is missing, differs, or is identical. When called with `apply`, perform the sync and report what changed.

</objective>

<inputs>

- **$ARGUMENTS**: optional
  - Omitted → dry-run: show drift report only, no files written
  - `apply` → apply sync: copy files and report outcome

</inputs>

<constants>

- PROJECT: `$(git rev-parse --show-toplevel)/.claude`
- HOME_CLAUDE: `~/.claude`
- NEVER sync: `settings.local.json`, `CLAUDE.md` (intentionally differ per level)
- statusLine path transform: project uses relative `node .claude/hooks/statusline.js` → home needs absolute `node $HOME/.claude/hooks/statusline.js` (expanded at apply time)

</constants>

<workflow>

## Step 1: Discover files

Collect the set of syncable files from the project:

```bash
PROJECT="$(git rev-parse --show-toplevel)/.claude"
# Agents
ls "$PROJECT/agents/"*.md
# Skills
ls "$PROJECT/skills/"*/SKILL.md
# Hooks
ls "$PROJECT/hooks/"
# Settings
ls "$PROJECT/settings.json"
```

## Step 2: Diff each category

For each file, compare project vs home. Use `diff` to detect changes:

```bash
PROJECT="$(git rev-parse --show-toplevel)/.claude"
HOME_CLAUDE=~/.claude
# Agents
for f in "$PROJECT/agents/"*.md; do
  name=$(basename "$f")
  target="$HOME_CLAUDE/agents/$name"
  if [ ! -f "$target" ]; then
    echo "MISSING  agents/$name"
  elif diff -q "$f" "$target" > /dev/null 2>&1; then
    echo "IDENTICAL agents/$name"
  else
    echo "DIFFERS  agents/$name"
    diff "$f" "$target" | head -20
  fi
done

# Skills
for f in "$PROJECT/skills/"*/SKILL.md; do
  skill=$(basename $(dirname "$f"))
  target="$HOME_CLAUDE/skills/$skill/SKILL.md"
  if [ ! -f "$target" ]; then
    echo "MISSING  skills/$skill/SKILL.md"
  elif diff -q "$f" "$target" > /dev/null 2>&1; then
    echo "IDENTICAL skills/$skill/SKILL.md"
  else
    echo "DIFFERS  skills/$skill/SKILL.md"
    diff "$f" "$target" | head -20
  fi
done

# Hooks
for f in "$PROJECT/hooks/"*; do
  name=$(basename "$f")
  target="$HOME_CLAUDE/hooks/$name"
  if [ ! -f "$target" ]; then
    echo "MISSING  hooks/$name"
  elif diff -q "$f" "$target" > /dev/null 2>&1; then
    echo "IDENTICAL hooks/$name"
  else
    echo "DIFFERS  hooks/$name"
  fi
done

# Settings — compare ignoring the statusLine path difference
diff \
  <(sed 's|node .claude/hooks/statusline.js|node '"$HOME"'/.claude/hooks/statusline.js|' "$PROJECT/settings.json") \
  "$HOME_CLAUDE/settings.json"
```

## Step 3: Produce drift report

Format the findings as a table:

```
## .claude Drift Report — <date>

### Summary
Project → Home sync status

| File | Status | Action |
|------|--------|--------|
| agents/self-mentor.md   | MISSING  | copy   |
| agents/sw-engineer.md   | DIFFERS  | copy   |
| agents/qa-specialist.md | IDENTICAL| none   |
| skills/sync/SKILL.md    | MISSING  | copy   |
| hooks/statusline.js     | IDENTICAL| none   |
| settings.json           | DIFFERS  | merge  |

Files in sync: N/M
Files to update: N
```

If `$ARGUMENTS` is empty: stop here, print the report, and offer `"/sync apply" to apply all changes`.

## Step 4: Apply sync (only when $ARGUMENTS == "apply")

Apply changes in this order:

**4a. Agents**

```bash
PROJECT="$(git rev-parse --show-toplevel)/.claude"
cp "$PROJECT/agents/"*.md ~/.claude/agents/
```

**4b. Skills**

```bash
PROJECT="$(git rev-parse --show-toplevel)/.claude"
for skill in "$PROJECT/skills/"/*/; do
  name=$(basename "$skill")
  mkdir -p ~/.claude/skills/"$name"
  cp "$skill/SKILL.md" ~/.claude/skills/"$name/SKILL.md"
done
```

**4c. Hooks**

```bash
PROJECT="$(git rev-parse --show-toplevel)/.claude"
mkdir -p ~/.claude/hooks
cp "$PROJECT/hooks/"* ~/.claude/hooks/
```

**4d. Settings** — copy project settings.json but rewrite the statusLine path to absolute:

Read `.claude/settings.json`, replace `"node .claude/hooks/statusline.js"` with `"node $HOME/.claude/hooks/statusline.js"` (expand `$HOME` to the actual home directory path), write to `~/.claude/settings.json`.

## Step 5: Verify and report outcome

```bash
# Counts
echo "Agents:" && ls ~/.claude/agents/*.md | wc -l
echo "Skills:" && ls ~/.claude/skills/*/SKILL.md | wc -l

# JSON validity
python3 -c "import json; json.load(open('$HOME/.claude/settings.json')); print('settings.json: valid')"

# Re-run diff to confirm all files now match (same loop as Step 2)
```

Print a final outcome table:

```
## Sync Outcome — <date>

| Step            | Result  |
|-----------------|---------|
| agents          | ✅ copied |
| skills          | ✅ copied |
| hooks           | ✅ copied |
| settings.json   | ✅ merged |
| JSON validity   | ✅ valid  |

Post-sync drift: 0 files differ
```

</workflow>

<notes>

- NEVER copy `settings.local.json` or `CLAUDE.md` — these intentionally differ per level
- The statusLine path MUST be absolute in home settings (`$HOME/.claude/hooks/statusline.js`) — relative paths only work from the project directory; expand `$HOME` when writing the JSON value
- The project `.claude/` is always the source of truth; never sync home → project
- Run `/sync` (dry-run) first to review changes before running `/sync apply`
- After applying, the self-mentor agent can audit for any drift the skill missed

</notes>
