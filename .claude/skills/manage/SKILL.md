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
- `/manage delete agent old-agent-name`

**Skill examples:**

- `/manage create skill benchmark "Benchmark orchestrator for measuring and comparing performance across commits"`
- `/manage update skill optimize perf-audit`
- `/manage delete skill old-skill`

</inputs>

<constants>

- AGENTS_DIR: `.claude/agents`
- SKILLS_DIR: `.claude/skills`
- MEMORY_FILE: `~/.claude/projects/*/memory/MEMORY.md`
- USED_COLORS: blue, green, purple, lime, orange, yellow, cyan, red, teal, indigo, magenta, pink
- AVAILABLE_COLORS: coral, gold, olive, navy, salmon, violet, maroon, aqua, brown

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
ls .claude/agents/<name>.md 2>/dev/null
ls .claude/skills/<name>/SKILL.md 2>/dev/null
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
ls .claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//' | sort

# Current skills
ls -d .claude/skills/*/ | xargs -n1 basename | sort

# Colors in use
grep '^color:' .claude/agents/*.md
```

## Step 4: Execute operation

Branch into one of six modes:

### Mode: Create Agent

1. Pick the first unused color from the AVAILABLE_COLORS pool (compare against colors found in Step 3)
2. Choose model based on role complexity:
   - `opusplan` — plan-gated roles (solution-architect, oss-maintainer, self-mentor): long-horizon reasoning + plan mode
   - `opus` — complex implementation roles (sw-engineer, qa-specialist, ai-researcher, perf-optimizer): deep reasoning without plan mode
   - `sonnet` — focused execution roles (linting-expert, data-steward, ci-guardian, web-explorer, doc-scribe): pattern-matching, structured output
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
mkdir -p .claude/skills/<name>
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
cat .claude/agents/<old-name>.md

# 2. Write new file with updated name in frontmatter
# (Edit the `name:` line in frontmatter to use new-name)

# 3. Verify new file exists and is valid
head -5 .claude/agents/<new-name>.md

# 4. Delete old file only after new file is confirmed
rm .claude/agents/<old-name>.md
```

### Mode: Update Skill

Atomic update — create new directory before removing old:

```bash
# 1. Create new directory
mkdir -p .claude/skills/<new-name>

# 2. Copy SKILL.md with updated name in frontmatter
# (Read old, edit name: line, write to new location)

# 3. Verify new file exists
head -5 .claude/skills/<new-name>/SKILL.md

# 4. Remove old directory only after new is confirmed
rm -r .claude/skills/<old-name>
```

### Mode: Delete Agent

```bash
# Confirm existence before deleting
ls .claude/agents/<name>.md
rm .claude/agents/<name>.md
```

### Mode: Delete Skill

```bash
# Confirm existence before deleting
ls .claude/skills/<name>/SKILL.md
rm -r .claude/skills/<name>
```

## Step 5: Propagate cross-references

Search all `.claude/` markdown files for the changed name and update references:

```bash
# Find all references to the name across agents and skills
grep -rn "<name>" .claude/agents/*.md
grep -rn "<name>" .claude/skills/*/SKILL.md
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
ls .claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//' | paste -sd', ' -

# Get current skill list
ls -d .claude/skills/*/ | xargs -n1 basename | paste -sd', ' -
```

Use the Edit tool to update these two lines in MEMORY.md:

- `- Agents: oss-maintainer, sw-engineer, ...` (the roster line, not the path line)
- `- Skills: review, security, ...`

## Step 7: Update README.md

Update the agent or skill table in `README.md`:

- **create agent**: add a new row to the `### Agents` table — columns: `| **name** | Short tagline | Key capabilities |`
- **create skill**: add a new row to the `### Skills` table — columns: `| **name** | \`/name\` | Description |\`
- **update (rename)**: find and replace the old name in the table row with the new name
- **delete**: remove the row for the deleted name

The README tables are self-documenting — keep descriptions concise (one line) and consistent in tone with the surrounding rows. Do not add/remove table columns.

## Step 8: Verify integrity

Confirm no broken references remain:

```bash
# Extract all agent/skill names referenced in .claude/ files
grep -rohE '[a-z]+-[a-z]+(-[a-z]+)*' .claude/agents/*.md \
  .claude/skills/*/SKILL.md | sort -u

# Compare against actual files on disk
ls .claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//'
ls -d .claude/skills/*/ | xargs -n1 basename
```

Use Grep to search for the specific changed name and confirm:

- **Update**: zero hits for old name, appropriate hits for new name
- **Delete**: zero hits for deleted name (or flagged references noted)
- **Create**: new file exists with valid structure

## Step 9: Audit

Run `/audit` to validate the created/modified file(s) and catch any issues introduced by this operation:

```
/audit
```

For a targeted check of only the affected file, spawn **self-mentor** directly:

- For `create`: audit the new file for structural completeness, cross-ref validity, and content quality
- For `update`: audit the renamed file and verify no stale references remain
- For `delete`: audit remaining files for broken references to the deleted name

Include the audit findings in the final report. Do not proceed to sync if any `critical` findings remain.

## Step 10: Summary report

Output a structured report containing:

- **Operation**: what was done (create/update/delete + type + name)
- **Files Changed**: table of file paths and actions (created/renamed/deleted/cross-ref updated)
- **Cross-References**: count of files updated, broken refs cleaned
- **Current Roster**: agents (N) and skills (N) with comma-separated names
- **Audit Result**: audit findings (pass / issues found)
- **Follow-up**: run `/sync` to propagate to `~/.claude/`; for `create` review generated content; note if `settings.json` permissions might be needed

</workflow>

<notes>

- **Atomic updates**: always write-before-delete to prevent data loss on interruption
- **No settings.json auto-edit**: this skill only mentions when new permissions might be needed — it does not mutate JSON files to avoid risky structural edits
- **README.md tables**: Step 7 updates the agent/skill tables in the project README.md — keep the row format consistent with existing rows
- **Color pool**: the AVAILABLE_COLORS list provides unused colors for new agents; if exhausted, reuse colors with a note
- **Cross-ref grep is broad**: searches bare kebab-case names across all markdown files — catches backtick references, prose mentions, spawn directives, and inventory lists
- **MEMORY.md inventory**: always regenerated from disk (`ls`), never manually calculated — this prevents drift
- Follow-up chains:
  - After any create/update/delete → `/audit` to verify config integrity, then `/sync apply` to propagate
  - After creating a new agent/skill → `/review` to validate generated content quality
  - Recommended sequence: `/manage <op>` → `/audit` → `/sync apply`

</notes>
