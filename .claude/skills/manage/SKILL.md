---
name: manage
description: Create, update, or delete agents and skills with full cross-reference propagation across all .claude/ files and memory/MEMORY.md inventory.
argument-hint: <create|update|delete> <agent|skill> <name> [new-name|"description"]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

<objective>
Manage the lifecycle of agents and skills in the `.claude/` directory. Handles creation with rich domain content, atomic updates (renames) with cross-reference propagation, and clean deletion with broken-reference cleanup. Keeps the MEMORY.md inventory in sync with what actually exists on disk.
</objective>

<inputs>
- **$ARGUMENTS**: required, one of:
  - `create agent <name> "description"` — create a new agent with generated domain content
  - `create skill <name> "description"` — create a new skill with workflow scaffold
  - `update agent <old-name> <new-name>` — rename agent file + update all cross-refs
  - `update skill <old-name> <new-name>` — rename skill directory + update all cross-refs
  - `delete agent <name>` — delete agent file + clean broken refs
  - `delete skill <name>` — delete skill directory + clean broken refs
- Names must be **kebab-case** (lowercase, hyphens only)
- Descriptions must be quoted when they contain spaces

**Agent examples:**
- `/manage create agent security-auditor "Security specialist for vulnerability scanning and OWASP compliance"`
- `/manage update agent ci-guardian ci-specialist`
- `/manage delete agent web-explorer`

**Skill examples:**
- `/manage create skill benchmark "Benchmark orchestrator for measuring and comparing performance across commits"`
- `/manage update skill optimize perf-audit`
- `/manage delete skill observe`
</inputs>

<constants>
- AGENTS_DIR: `/Users/jirka/Workspace/Borda.local/.claude/agents`
- SKILLS_DIR: `/Users/jirka/Workspace/Borda.local/.claude/skills`
- MEMORY_FILE: `/Users/jirka/.claude/projects/-Users-jirka-Workspace-Borda-local/memory/MEMORY.md`
- USED_COLORS: blue, green, purple, lime, orange, yellow, cyan, red, teal, indigo, magenta
- AVAILABLE_COLORS: pink, coral, gold, olive, navy, salmon, violet, maroon, aqua, brown
</constants>

<workflow>

## Step 1: Parse and validate

Extract operation, type, name, and optional arguments from `$ARGUMENTS`.

**Validation rules:**
- Name must match `^[a-z][a-z0-9-]*$` (kebab-case)
- For `create`: name must NOT already exist on disk
- For `update`/`delete`: name MUST already exist on disk
- For `update`: new-name must NOT already exist on disk
- For `create`: description is required

```bash
# Check existence
ls /Users/jirka/Workspace/Borda.local/.claude/agents/<name>.md 2>/dev/null
ls /Users/jirka/Workspace/Borda.local/.claude/skills/<name>/SKILL.md 2>/dev/null
```

If validation fails, report the error and stop.

## Step 2: Overlap review (create only)

Before creating anything, check if existing agents/skills already cover the requested functionality:

1. Read descriptions of all existing agents (`head -3` of each `.md` in agents/) and skills (`head -3` of each `SKILL.md`)
2. Compare the new description against each existing one — look for domain overlap, similar workflows, or redundant scope
3. Present findings to the user:
   - **No overlap**: proceed to Step 3
   - **Partial overlap**: name the overlapping agent/skill, explain what it covers vs what the new one would add, and ask the user whether to proceed, extend the existing one instead, or abort
   - **Strong overlap**: recommend against creation — suggest using or extending the existing agent/skill instead

Skip this step for `update` and `delete` operations.

## Step 3: Inventory current state

Snapshot the current roster for later comparison:

```bash
# Current agents
ls /Users/jirka/Workspace/Borda.local/.claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//' | sort

# Current skills
ls -d /Users/jirka/Workspace/Borda.local/.claude/skills/*/ | xargs -n1 basename | sort

# Colors in use
grep '^color:' /Users/jirka/Workspace/Borda.local/.claude/agents/*.md
```

## Step 4: Execute operation

Branch into one of six modes:

### Mode: Create Agent

1. Pick the first unused color from the AVAILABLE_COLORS pool (compare against colors found in Step 3)
2. Choose model: `claude-opus-4-6` for complex reasoning roles (architecture, maintenance, research, engineering), `claude-sonnet-4-6` for focused execution roles (linting, testing, data, CI)
3. Write the agent file with real domain content derived from the description:

**Agent template** — write to `AGENTS_DIR/<name>.md`:

```
---
name / description / tools / model / color (frontmatter)
---
<role> — 2-3 sentences establishing expertise from description
\<core_knowledge> — 2 subsections, 3-5 bullets each (domain-specific, not generic)
\</core_knowledge>
<workflow> — 5 numbered steps appropriate to the domain
</workflow>
\<notes> — 1-2 operational notes + cross-refs to related agents
\</notes>
```

**Content rules:** `<role>` and `<workflow>` use normal tags; all other sections use `\<escaped>` tags. Generate real domain content (80-120 lines total).

### Mode: Create Skill

1. Create the skill directory
2. Write the skill file with workflow scaffold:

```bash
mkdir -p /Users/jirka/Workspace/Borda.local/.claude/skills/<name>
```

**Skill template** — write to `SKILLS_DIR/<name>/SKILL.md`:

```
---
name / description / argument-hint / disable-model-invocation: true / allowed-tools (frontmatter)
---
<objective> — 2-3 sentences from description
<inputs> — $ARGUMENTS documentation
<workflow> — 3+ numbered steps with bash examples
<notes> — operational caveats
```

**Content rules:** No backslash escaping in skills (all normal XML tags). Generate real steps (40-60 lines total). Default `allowed-tools` to `Read, Bash, Grep, Glob, Task` unless writing files is needed.

### Mode: Update Agent

Atomic update — write new file before deleting old:

```bash
# 1. Read the old file
cat /Users/jirka/Workspace/Borda.local/.claude/agents/<old-name>.md

# 2. Write new file with updated name in frontmatter
# (Edit the `name:` line in frontmatter to use new-name)

# 3. Verify new file exists and is valid
head -5 /Users/jirka/Workspace/Borda.local/.claude/agents/<new-name>.md

# 4. Delete old file only after new file is confirmed
rm /Users/jirka/Workspace/Borda.local/.claude/agents/<old-name>.md
```

### Mode: Update Skill

Atomic update — create new directory before removing old:

```bash
# 1. Create new directory
mkdir -p /Users/jirka/Workspace/Borda.local/.claude/skills/<new-name>

# 2. Copy SKILL.md with updated name in frontmatter
# (Read old, edit name: line, write to new location)

# 3. Verify new file exists
head -5 /Users/jirka/Workspace/Borda.local/.claude/skills/<new-name>/SKILL.md

# 4. Remove old directory only after new is confirmed
rm -r /Users/jirka/Workspace/Borda.local/.claude/skills/<old-name>
```

### Mode: Delete Agent

```bash
# Confirm existence before deleting
ls /Users/jirka/Workspace/Borda.local/.claude/agents/<name>.md
rm /Users/jirka/Workspace/Borda.local/.claude/agents/<name>.md
```

### Mode: Delete Skill

```bash
# Confirm existence before deleting
ls /Users/jirka/Workspace/Borda.local/.claude/skills/<name>/SKILL.md
rm -r /Users/jirka/Workspace/Borda.local/.claude/skills/<name>
```

## Step 5: Propagate cross-references

Search all `.claude/` markdown files for the changed name and update references:

```bash
# Find all references to the name across agents and skills
grep -rn "<name>" /Users/jirka/Workspace/Borda.local/.claude/agents/*.md
grep -rn "<name>" /Users/jirka/Workspace/Borda.local/.claude/skills/*/SKILL.md
```

**For update:** Use the Edit tool to replace every occurrence of `<old-name>` with `<new-name>` in each file that references it.

**For delete:** Review each reference. If the deleted name appears in:
- A cross-reference suggestion (e.g., "use X agent") — remove or replace with the closest alternative
- An inventory list — remove the entry
- A workflow spawn directive — flag for manual review

**For create:** No cross-ref propagation needed (new names have no existing references).

## Step 6: Update memory/MEMORY.md

Regenerate the inventory lines from what actually exists on disk:

```bash
# Get current agent list
ls /Users/jirka/Workspace/Borda.local/.claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//' | paste -sd', ' -

# Get current skill list
ls -d /Users/jirka/Workspace/Borda.local/.claude/skills/*/ | xargs -n1 basename | paste -sd', ' -
```

Use the Edit tool to update these two lines in MEMORY.md:
- `- Agents: oss-maintainer, sw-engineer, ...` (the roster line, not the path line)
- `- Skills: review, security, ...`

## Step 7: Verify integrity

Confirm no broken references remain:

```bash
# Extract all agent/skill names referenced in .claude/ files
grep -rohE '[a-z]+-[a-z]+(-[a-z]+)*' /Users/jirka/Workspace/Borda.local/.claude/agents/*.md \
  /Users/jirka/Workspace/Borda.local/.claude/skills/*/SKILL.md | sort -u

# Compare against actual files on disk
ls /Users/jirka/Workspace/Borda.local/.claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//'
ls -d /Users/jirka/Workspace/Borda.local/.claude/skills/*/ | xargs -n1 basename
```

Use Grep to search for the specific changed name and confirm:
- **Update**: zero hits for old name, appropriate hits for new name
- **Delete**: zero hits for deleted name (or flagged references noted)
- **Create**: new file exists with valid structure

## Step 8: Audit

Spawn the `self-mentor` agent to audit the created/modified file(s):
- For `create`: audit the new file for structural completeness, cross-ref validity, and content quality
- For `update`: audit the renamed file and verify no stale references remain
- For `delete`: audit remaining files for broken references to the deleted name

Include the audit findings in the final report.

## Step 9: Summary report

Output a structured report containing:
- **Operation**: what was done (create/update/delete + type + name)
- **Files Changed**: table of file paths and actions (created/renamed/deleted/cross-ref updated)
- **Cross-References**: count of files updated, broken refs cleaned
- **Current Roster**: agents (N) and skills (N) with comma-separated names
- **Audit Result**: self-mentor findings (pass / issues found)
- **Follow-up**: run `/sync` to propagate to `~/.claude/`; for `create` review generated content; note if `settings.json` permissions might be needed

</workflow>

<notes>
- **Atomic updates**: always write-before-delete to prevent data loss on interruption
- **No settings.json auto-edit**: this skill only mentions when new permissions might be needed — it does not mutate JSON files to avoid risky structural edits
- **No README.md handling**: if a README.md with agent/skill tables exists in the future, add it to the propagation steps
- **Color pool**: the AVAILABLE_COLORS list provides unused colors for new agents; if exhausted, reuse colors with a note
- **Cross-ref grep is broad**: searches bare kebab-case names across all markdown files — catches backtick references, prose mentions, spawn directives, and inventory lists
- **MEMORY.md inventory**: always regenerated from disk (`ls`), never manually calculated — this prevents drift
</notes>
