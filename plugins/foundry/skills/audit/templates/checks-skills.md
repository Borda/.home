# Skill Checks — 21, 22, 23, 24

______________________________________________________________________

## Check 21 — Skill frontmatter conflicts

`context:fork + disable-model-invocation:true` is a broken combination.

```bash
RED='\033[1;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
CYN='\033[0;36m'
NC='\033[0m'
for f in .claude/skills/*/SKILL.md; do # timeout: 5000
    name=$(basename "$(dirname "$f")")
    if awk '/^---$/{c++} c<2' "$f" 2>/dev/null | grep -q 'context: fork' &&
    awk '/^---$/{c++} c<2' "$f" 2>/dev/null | grep -q 'disable-model-invocation: true'; then
        printf "${RED}! BREAKING${NC} skills/%s: context:fork + disable-model-invocation:true\n" "$name"
        printf "  ${RED}→${NC} forked skill has no model to coordinate agents or synthesize results\n"
        printf "  ${CYN}fix${NC}: remove disable-model-invocation:true (or remove context:fork if purely tool-only)\n"
    fi
done
```

______________________________________________________________________

## Check 22 — Calibration coverage gap

**Step 1 — Read the calibrate domain table**: Read `.claude/skills/calibrate/modes/skills.md` and extract the registered target list under `### Domain table`. Build the set of registered targets.

**Step 2 — Scan all skill modes on disk**: Use Glob (`skills/*/SKILL.md`, path `.claude/`) and Glob (`skills/*/modes/*.md`, path `.claude/`) to enumerate every skill and mode file. Extract mode names from `argument-hint:` frontmatter and `## Mode:` / `### Mode:` headings.

**Step 3 — Validate registered targets exist on disk**: For each registered target, verify the corresponding skill/mode file exists. A registered target with no matching file → **medium** (calibrate will fail at runtime).

**Step 4 — Identify unregistered calibratable candidates** (model reasoning):

A mode is calibratable when ALL three signals are present:

1. **Deterministic structured output**: findings list, completeness checklist, structured table, or machine-readable verdict
2. **Synthetic input feasible**: can be tested without external services
3. **Ground truth constructable**: known issues can be injected and scored

→ Unregistered mode matching all three signals: **low** (add to `calibrate/modes/skills.md` domain table)

**Step 5 — Read the agents domain table**: Read `.claude/skills/calibrate/modes/agents.md` and extract all agent names from the `### Domain table` section. Build the set of registered agent names.

**Step 6 — Scan all agent files on disk**: Use Glob (`plugins/*/agents/*.md`, path project root) to enumerate plugin agent files; also Glob (`agents/*.md`, path `.claude/`) for any directly installed agents. Derive a qualified name for each: `plugins/<plugin>/agents/<name>.md` → `<plugin>:<name>`; `.claude/agents/<name>.md` → `<name>`. Build the full discovered-agent set.

**Step 7 — Validate registered agents exist on disk**: For each registered agent in the domain table, verify it resolves to a discovered file. A bare name in the domain table (e.g. `sw-engineer`) matches `foundry:sw-engineer` when no `.claude/agents/sw-engineer.md` exists — apply model reasoning to resolve bare names against plugin-qualified discoveries. Registered agent with no matching file → **medium** (stale entry will cause calibrate to fail at runtime; remove from domain table or correct the prefix).

**Step 8 — Identify unregistered agents**: For each discovered agent not represented in the domain table, apply the same three-signal calibratability test from Step 4. → Unregistered calibratable agent: **low** (add to `calibrate/modes/agents.md` domain table with an appropriate domain string).

______________________________________________________________________

## Check 23 — Bash command misuse / native tool substitution

```bash
YEL='\033[1;33m'
GRN='\033[0;32m'
CYN='\033[0;36m'
NC='\033[0m'
printf "=== Check 23: Bash misuse candidates ===\n"
grep -rn '\bcat \|`cat ' .claude/agents/ .claude/skills/ .claude/rules/ 2>/dev/null |
grep -v '^Binary' | grep -v '# ' &&
printf "  ${CYN}hint${NC}: replace cat with Read tool\n" || true
grep -rn '\bgrep \|\brg \b' .claude/agents/ .claude/skills/ .claude/rules/ 2>/dev/null |
grep -v '^Binary' | grep -v '# .*grep\|Grep tool\|Use Grep' &&
printf "  ${CYN}hint${NC}: replace grep/rg with Grep tool\n" || true
grep -rn '\bfind \b.*-name\|\bls \b.*\*' .claude/agents/ .claude/skills/ .claude/rules/ 2>/dev/null |
grep -v '^Binary' | grep -v '# .*Glob\|Use Glob\|Glob tool' &&
printf "  ${CYN}hint${NC}: replace find/ls with Glob tool\n" || true
grep -rn 'echo .* >\|tee ' .claude/agents/ .claude/skills/ .claude/rules/ 2>/dev/null |
grep -v '^Binary' | grep -v '# .*Write tool\|Use Write' &&
printf "  ${CYN}hint${NC}: replace echo-redirect/tee with Write tool\n" || true
grep -rn '\bsed \b\|\bawk \b' .claude/agents/ .claude/skills/ .claude/rules/ 2>/dev/null |
grep -v '^Binary' | grep -v '# .*Edit tool\|Use Edit\|awk.*{print\|awk.*BEGIN' &&
printf "  ${CYN}hint${NC}: replace sed/awk text-substitution with Edit tool\n" || true
printf "${GRN}✓${NC}: Check 23 scan complete\n"
```

After the scan, apply model reasoning to each match — exclude cases where the shell command is genuinely necessary. Flag only where the native tool is a direct drop-in replacement.

| Shell command                      | Preferred native tool | Severity |
| ---------------------------------- | --------------------- | -------- |
| `cat <file>`                       | Read tool             | medium   |
| `grep`/`rg` for content search     | Grep tool             | medium   |
| `find`/`ls` for file listing       | Glob tool             | medium   |
| `echo … >` / `tee` to write a file | Write tool            | medium   |
| `sed`/`awk` for text substitution  | Edit tool             | medium   |

**Report only** — never auto-fix; some Bash invocations in example/illustration code blocks are intentional.

______________________________________________________________________

## Check 24 — Skill sequence compatibility

Skill `<notes>` and `<workflow>` sections frequently document multi-skill chains (e.g., `→ /audit fix`, `suggested next: /brainstorm breakdown <file>`). This check verifies that documented sequences are internally consistent:

- **24a (target existence)**: every skill referenced in a documented chain exists on disk — root skills under `.claude/skills/<name>/`, plugin skills under `plugins/<plugin>/skills/<skill>/`
- **24b (argument plausibility)**: when a suggestion includes an explicit argument (e.g., `→ /audit fix`), that argument must appear as a substring in the target skill's `argument-hint:` frontmatter (case-insensitive)

**Step 1 — Extract sequence references**:

Scan three sources for documented chains:

1. **Skill files**: Grep (pattern `→.*` + backtick + `/[a-z]|suggest.*` + backtick + `/[a-z]|run.*after.*` + backtick + `/[a-z]`, glob `skills/*/SKILL.md`, path `.claude/`, output mode `content`)
2. **Agent files**: same Grep on `agents/*.md` (path `.claude/`)
3. **README files**: Grep the same pattern in `README.md` (project root), `plugins/*/README.md`, and `.claude/README.md` — README sequence tables are canonical documentation of the intended workflow chains and must be consistent with what is actually installed

Filter out:

- Lines starting with `#` (comments)
- Lines containing `e.g.` or `for example` (illustrative, not directive)
- Lines whose surrounding context is a description of what the skill does rather than a "run next" directive

Collect all unique (source-file, skill-reference, trailing-argument) triples. README-sourced sequences are held to the same validity standard as skill-sourced ones: a broken sequence in a README is a **high** finding because it is the user-facing documentation of the workflow.

**Step 2 — Resolve each reference (Check 24a)**:

| Reference form | Resolution                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/name`        | Glob `.claude/skills/name/SKILL.md` — must exist                                                                                           |
| `/plugin:name` | Glob `plugins/plugin/skills/name/SKILL.md` — must exist; if no `plugins/` dir, note "installed plugin — cannot verify statically" and skip |

Missing target → **[high]**: `Sequence reference /<name> in <file> resolves to no installed skill`

**Step 3 — Argument plausibility (Check 24b)**:

For references with a trailing argument token (e.g., `fix` in `/audit fix`, `breakdown` in `/brainstorm breakdown`):

1. Read the target skill's frontmatter `argument-hint:` (Glob-resolved path, first 5 lines)
2. If the argument token does NOT appear as a case-insensitive substring of `argument-hint` → **[medium]**: `Sequence argument '<arg>' absent from /<name> argument-hint: '<hint>'`

**Report only** — do not auto-fix; sequence intent requires human judgment.

| Sub-check                                | Severity | Auto-fix |
| ---------------------------------------- | -------- | -------- |
| 24a — target skill not on disk           | high     | no       |
| 24b — argument absent from argument-hint | medium   | no       |
