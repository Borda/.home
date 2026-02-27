---
name: audit
description: Comprehensive config audit for the entire .claude/ directory. Orchestrates self-mentor across all agents, skills, settings, and hooks to detect correctness issues, broken cross-references, interoperability problems, infinite loops, redundancy, and inefficiency. Reports findings by severity and auto-fixes everything except low (nit) findings.
argument-hint: '[agents|skills] [fix]'
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

<objective>

Run a full-sweep quality audit of the `.claude/` configuration: every agent file, every skill file, settings.json, and hooks. Spawns `self-mentor` for per-file analysis, then aggregates findings system-wide to catch issues that only surface across files — infinite loops, inventory drift, missing permissions, and cross-file interoperability breaks. Reports all findings and auto-fixes critical, high, and medium issues (low/nit findings are reported only).

</objective>

<inputs>

- **$ARGUMENTS**: optional
  - No argument: full sweep, report only — lists all findings, no changes made (default)
  - `fix` — full sweep + auto-fix `critical`, `high`, and `medium` findings; `low` findings reported only
  - `agents` — restrict sweep to agent files only, report only
  - `skills` — restrict sweep to skill files only, report only
  - `agents fix` / `skills fix` — restricted scope + auto-fix (scope always precedes `fix`)

</inputs>

<workflow>

## Step 1: Run pre-commit (if configured)

```bash
# Check whether pre-commit is installed and a config exists
if command -v pre-commit &>/dev/null && [ -f .pre-commit-config.yaml ]; then
  pre-commit run --all-files
fi
```

Any files auto-corrected by pre-commit hooks (formatters, linters, whitespace fixers) are now clean before the structural audit begins. Note which files were modified — include them in the audit scope even if they were not originally targeted.

If pre-commit is not configured, skip this step silently.

## Step 2: Collect all config files

Enumerate everything in scope:

```bash
# Agents
ls .claude/agents/*.md

# Skills
ls .claude/skills/*/SKILL.md

# Settings and hooks
ls .claude/settings.json
ls .claude/hooks/
```

Record the full file list — this becomes the audit scope for Steps 3–4.

## Step 3: Per-file audit via self-mentor

Spawn one **self-mentor** agent per file (or batch into groups of 4–5 for efficiency). Each invocation should ask self-mentor to check:

- **Purpose and logical coherence**: is the agent's/skill's role clearly defined? Does its scope make sense — not too broad, not too narrow? Would a new user understand when to reach for it vs a similar one?
- **Structural completeness**: required sections present, tags balanced, step numbering sequential
- **Cross-reference validity**: every agent/skill name mentioned must exist on disk
- **Verbosity and duplication**: bloated steps, repeated instructions, copy-paste between files
- **Content freshness**: outdated model names, stale version pins, deprecated API references
- **Hardcoded user paths**: any `/Users/<name>/` or `/home/<name>/` absolute path — must be `.claude/`, `~/`, or derived from `git rev-parse --show-toplevel`
- **Infinite loops**: does file A's follow-up chain reference file B which references A creating a cycle? (flag, don't auto-fix)

Collect all findings from each self-mentor response into a structured list keyed by file path.

## Step 4: System-wide checks

Beyond per-file analysis, run cross-file checks that self-mentor cannot do alone:

```bash
# 1. Inventory drift — MEMORY.md vs disk
# Agents on disk
ls .claude/agents/*.md | xargs -n1 basename | sed 's/\.md$//' | sort > /tmp/agents_disk.txt
# Agents in MEMORY.md
grep '^\- Agents:' ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | head -1

# Skills on disk
ls .claude/skills/ | sort > /tmp/skills_disk.txt
# Skills in MEMORY.md
grep '^\- Skills:' ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | head -1

# 2. README vs disk — skill/agent table rows should match disk
grep '^\| \*\*' README.md | head -30

# 3. settings.json permissions — collect all bash commands used in skills
grep -rh 'gh \|python -m\|ruff\|mypy\|pytest' .claude/skills/*/SKILL.md | sort -u

# 4. Orphaned follow-up references — skill names mentioned in notes but not on disk
grep -roh '`/[a-z-]*`' .claude/skills/*/SKILL.md | sort -u

# 5. Hardcoded user paths — flag any /Users/<name>/ or /home/<name>/ in config files
grep -rn '/Users/\|/home/' .claude/agents/*.md .claude/skills/*/SKILL.md 2>/dev/null
```

Flag any drift between MEMORY.md, README.md, settings.json, and actual disk state. Flag any hardcoded `/Users/` or `/home/` paths — these should be `.claude/`, `~/`, or `$(git rev-parse --show-toplevel)/` style.

### Purpose overlap review

Read all agent/skill descriptions together and flag pairs where:

- Two agents have substantially overlapping domains (risk: users don't know which to pick)
- A skill's workflow duplicates logic already owned by an agent it could simply spawn
- An agent has grown so broad its scope is unclear (candidate for splitting)

### CLAUDE.md consistency

`.claude/CLAUDE.md` is the master governance file; agent and skill instructions must not contradict it.

Read `.claude/CLAUDE.md` and extract its governance directives (Workflow Orchestration, Task Management, Self-Setup Maintenance, Communication, Core Principles). For each agent and skill file, check whether any instruction contradicts or undermines a CLAUDE.md directive:

- **Direct contradiction**: file says the opposite of what CLAUDE.md mandates (e.g., "skip planning" vs "enter plan mode for non-trivial tasks")
- **Missing required behavior**: file performs an action governed by Self-Setup Maintenance rules but omits the required steps (e.g., modifies `.claude/` files without mentioning cross-reference updates)
- **Tone/style mismatch**: file's communication guidance conflicts with the Communication section (e.g., "apologize to the user" vs "flag early, not late")

Major contradictions → **high** severity, raised to user (CLAUDE.md takes precedence — the agent/skill needs updating, but the user decides how).
Minor drift (slightly different wording of the same idea, or missing but not contradicting) → **low**.

### Claude Code docs freshness

Spawn a **web-explorer** agent to fetch the current Claude Code documentation. Try the direct paths below; if they don't resolve, navigate from the Claude Code homepage (`code.claude.com`) to find the current schema pages:

- Hook event names, types, and schemas — `code.claude.com/docs/en/hooks`
- Agent frontmatter schema — `code.claude.com/docs/en/sub-agents`
- Skill frontmatter schema — `code.claude.com/docs/en/skills`

With the fetched docs, validate the local config:

**Hook validation** (`settings.json`):

- Every hook event name (e.g. `SubagentStart`) exists in the documented event list
- Every hook `type` is one of `command`, `http`, `prompt`, `agent`
- No deprecated top-level `decision:`/`reason:` fields in PreToolUse hooks
  (correct form is `hookSpecificOutput.permissionDecision`)

**Agent frontmatter validation** (`.claude/agents/*.md`):

- All frontmatter fields are in the documented schema
  (`name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`,
  `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `isolation`,
  `color` — note: `color` is a Claude Code UI extension not in the public schema)
- `model` values are recognized short-names (`sonnet`, `opus`, `haiku`, `inherit`,
  or project-level aliases like `opusplan`)

**Skill frontmatter validation** (`.claude/skills/*/SKILL.md`):

- All frontmatter fields are in the documented schema
  (`name`, `description`, `argument-hint`, `disable-model-invocation`,
  `user-invocable`, `allowed-tools`, `model`, `context`, `agent`, `hooks`)

**Improvement opportunities** — collect documented features not yet in use:

- New hook events that could add value (e.g. `PreCompact`, `SessionEnd`, `Stop`)
- New agent frontmatter fields (e.g. `memory`, `isolation`, `maxTurns`, `background`)
- New skill frontmatter fields (e.g. `context: fork`, `model`, `hooks`)
- New settings keys (e.g. `sandbox`, `plansDirectory`, `alwaysThinkingEnabled`)

Findings classification:

- Deprecated/invalid hook event name or type in use → **high**
- Deprecated frontmatter field, deprecated settings key, unrecognized model ID → **medium**
- New documented feature not yet used → **low** (prefix with 💡)

## Step 5: Aggregate and classify findings

Group all findings from Steps 1–4 into a severity table:

| Severity     | Examples                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **critical** | Broken cross-reference (agent/skill does not exist on disk), MEMORY.md inventory wrong, relative path that silently falls back to wrong directory                                                                                                                                 |
| **high**     | Dead loop in follow-up chain, missing settings.json permission for a tool in use, broken code example (undefined variable, wrong command syntax), agent/skill instruction directly contradicts a `.claude/CLAUDE.md` directive, deprecated/invalid hook event name or type in use |
| **medium**   | Duplication across files, stale model name, README row missing for existing skill, hardcoded `/Users/<name>/` path, undocumented modes in inputs, deprecated frontmatter field or settings key                                                                                    |
| **low**      | Verbosity, minor formatting, incomplete follow-up chain, outdated version pin with "autoupdate" note, agent/skill omits a CLAUDE.md principle but doesn't contradict it, 💡 new documented CC feature not yet used                                                                |

## Step 6: Report findings

Output a structured audit report before fixing anything:

```
## Audit Report — .claude/ config

### Scope
- Agents audited: N
- Skills audited: N
- System-wide checks: inventory drift, README sync, permissions, infinite loops, hardcoded paths, CLAUDE.md consistency, docs freshness

### Findings by Severity

#### Critical (N)
| File | Line | Issue | Category |
|---|---|---|---|
| agents/foo.md | 42 | References `bar-agent` which does not exist on disk | broken cross-ref |

#### High (N)
...

#### Medium (N)
...

#### Low (N) — reported only, not auto-fixed
...

### Summary
- Total findings: N (C critical, H high, M medium, L low)
- Auto-fix eligible: N (critical + high + medium)
```

If `fix` was not passed, stop here and present the report.

## Step 7: Fix critical, high, and medium findings

For each `critical`, `high`, and `medium` finding, apply a targeted fix:

- **Broken cross-reference**: remove or replace with the correct name (check disk to find the right target)
- **Inventory drift in MEMORY.md**: regenerate the agents/skills lines from disk
- **README row missing**: add the row with description from the file's `description:` frontmatter
- **Dead loop**: break the cycle by removing or rephrasing one of the follow-up references (flag for user review before changing)
- **Missing settings.json permission**: note it in the report — do NOT auto-edit settings.json (structural JSON edits are risky)
- **Hardcoded `/Users/<name>/` path**: replace with `.claude/` (project-relative), `~/` (home-relative), or `$(git rev-parse --show-toplevel)/` as appropriate
- **Broken code example**: fix the code directly (undefined variables, wrong API, wrong shell syntax)
- **Undocumented modes**: add the mode to `<inputs>` block and `argument-hint` frontmatter
- **CLAUDE.md contradiction**: do NOT auto-fix — raise to user with the specific contradiction (quote both the CLAUDE.md directive and the conflicting line in the agent/skill). CLAUDE.md takes precedence; the user decides whether to update the agent/skill or revise CLAUDE.md.

After each fix, note the file and change in a running fix log.

**Low findings** (nits): collect them in the final report but do not auto-fix — present them for optional manual cleanup.

## Step 8: Re-audit modified files

For every file changed in Step 7, spawn **self-mentor** again to confirm:

- The fix resolved the finding
- No new issues were introduced by the edit

```bash
# Spot-check: confirm the previously broken reference no longer appears
grep -n "<broken-name>" <fixed-file>
```

If re-audit surfaces new issues, loop back to Step 7 for those findings only (max 2 re-audit cycles — escalate to user if still unresolved).

## Step 9: Final report

Output the complete audit summary:

```
## Audit Complete — .claude/ config

### Files Audited
- Agents: N | Skills: N | Settings: 1 | Hooks: N

### Findings
| Severity | Found | Fixed | Remaining |
|---|---|---|---|
| critical | N | N | 0 |
| high | N | N | 0 |
| medium | N | N | 0 |
| low | N | — | N |

### Fixes Applied
| File | Change |
|---|---|
| agents/foo.md | Replaced broken ref `bar-agent` → `baz-agent` |

### Remaining (low/nits — manual review optional)
- [low findings that were not auto-fixed]
- [any infinite loops flagged for user decision]

### Next Step
Run `/sync apply` to propagate clean config to ~/.claude/
```

</workflow>

<notes>

- **Report before fix**: never silently mutate files — always present the findings report first (Step 6), then fix
- **settings.json is hands-off**: missing permissions are always reported, never auto-edited — structural JSON edits risk breaking Claude Code's config loading
- **Dead loops need human judgment**: a cycle in follow-up chains might be intentional (e.g., refactor → review → fix → refactor) — flag and explain, don't auto-remove
- **Max 2 re-audit cycles**: if fixes don't converge after 2 loops, surface the remaining issues to the user rather than spinning
- **Relationship to self-mentor**: `self-mentor` is a single-file reactive audit; `/audit` is the system-wide sweep that runs self-mentor at scale and adds cross-file checks
- **Paths must be portable**: `.claude/` for project-relative paths, `~/` for home paths — never `/Users/<name>/` or `/home/<name>/`; this rule applies to ALL skill and agent files
- This skill is the correct pre-flight before `/sync` — run `/audit` to confirm config is clean, then `/sync apply` to propagate
- Follow-up chains:
  - Audit clean → `/sync apply` to propagate verified config to `~/.claude/`
  - Audit found structural issues → review flagged files manually before syncing
  - Audit found many low items → schedule a dedicated `/refactor`-style cleanup pass

</notes>
