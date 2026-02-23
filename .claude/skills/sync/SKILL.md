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
- PROJECT: `/Users/jirka/Workspace/Borda.local/.claude`
- HOME: `/Users/jirka/.claude`
- NEVER sync: `settings.local.json`, `CLAUDE.md` (intentionally differ per level)
- statusLine path transform: project uses relative `node .claude/hooks/statusline.js` → home needs absolute `node /Users/jirka/.claude/hooks/statusline.js`
</constants>

<workflow>

## Step 1: Discover files

Collect the set of syncable files from the project:

```bash
# Agents (11 files)
ls /Users/jirka/Workspace/Borda.local/.claude/agents/*.md

# Skills (7 SKILL.md files)
ls /Users/jirka/Workspace/Borda.local/.claude/skills/*/SKILL.md

# Hooks
ls /Users/jirka/Workspace/Borda.local/.claude/hooks/

# Settings (project settings.json only — never settings.local.json)
ls /Users/jirka/Workspace/Borda.local/.claude/settings.json
```

## Step 2: Diff each category

For each file, compare project vs home. Use `diff` to detect changes:

```bash
# Agents
for f in /Users/jirka/Workspace/Borda.local/.claude/agents/*.md; do
  name=$(basename "$f")
  target="/Users/jirka/.claude/agents/$name"
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
for f in /Users/jirka/Workspace/Borda.local/.claude/skills/*/SKILL.md; do
  skill=$(basename $(dirname "$f"))
  target="/Users/jirka/.claude/skills/$skill/SKILL.md"
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
for f in /Users/jirka/Workspace/Borda.local/.claude/hooks/*; do
  name=$(basename "$f")
  target="/Users/jirka/.claude/hooks/$name"
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
  <(cat /Users/jirka/Workspace/Borda.local/.claude/settings.json | sed 's|node .claude/hooks/statusline.js|node /Users/jirka/.claude/hooks/statusline.js|') \
  /Users/jirka/.claude/settings.json
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
cp /Users/jirka/Workspace/Borda.local/.claude/agents/*.md /Users/jirka/.claude/agents/
```

**4b. Skills**

```bash
for skill in /Users/jirka/Workspace/Borda.local/.claude/skills/*/; do
  name=$(basename "$skill")
  mkdir -p "/Users/jirka/.claude/skills/$name"
  cp "$skill/SKILL.md" "/Users/jirka/.claude/skills/$name/SKILL.md"
done
```

**4c. Hooks**

```bash
mkdir -p /Users/jirka/.claude/hooks
cp /Users/jirka/Workspace/Borda.local/.claude/hooks/* /Users/jirka/.claude/hooks/
```

**4d. Settings** — copy project settings.json but rewrite the statusLine path to absolute:

Read `/Users/jirka/Workspace/Borda.local/.claude/settings.json`, replace `"node .claude/hooks/statusline.js"` with `"node /Users/jirka/.claude/hooks/statusline.js"`, write to `/Users/jirka/.claude/settings.json`.

## Step 5: Verify and report outcome

```bash
# Counts
echo "Agents:" && ls /Users/jirka/.claude/agents/*.md | wc -l
echo "Skills:" && ls /Users/jirka/.claude/skills/*/SKILL.md | wc -l

# JSON validity
python3 -c "import json; json.load(open('/Users/jirka/.claude/settings.json')); print('settings.json: valid')"

# Re-run diff to confirm all files now match
# (same loop as Step 2 — should show all IDENTICAL)
```

Print a final outcome table:

```
## Sync Outcome — <date>

| Step            | Result  |
|-----------------|---------|
| agents (11)     | ✅ copied |
| skills (8)      | ✅ copied |
| hooks           | ✅ copied |
| settings.json   | ✅ merged |
| JSON validity   | ✅ valid  |

Post-sync drift: 0 files differ
```

</workflow>

<notes>
- NEVER copy `settings.local.json` or `CLAUDE.md` — these intentionally differ per level
- The statusLine path MUST be absolute in home settings (`/Users/jirka/.claude/hooks/statusline.js`) — relative paths only work from the project directory
- The project `.claude/` is always the source of truth; never sync home → project
- Run `/sync` (dry-run) first to review changes before running `/sync apply`
- After applying, the self-mentor agent can audit for any drift the skill missed
</notes>
