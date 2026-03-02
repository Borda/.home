## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- **Confidence scores**: when spawning analysis agents, request a confidence score (0–1) at the end of each response. If any agent < 0.7: flag with ⚠, state the gap, and consider a targeted second pass. Low confidence is not failure — it is signal; always surface it rather than dropping uncertain findings.
- **Confidence → improvement loop**: if the same low-confidence gap recurs across sessions (e.g., "cannot validate without runtime traces"), address it at the instruction level — add the blind spot to the agent's `\<antipatterns_to_flag>` or update `tasks/lessons.md` with the pattern so it is not silently repeated. Run `/calibrate <agent>` after instruction changes to confirm improved recall.

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 7. Agent Teamwork

- **Delegate to the right agent** — when a task has a designated owner (e.g. `linting-expert`, `qa-specialist`, `doc-scribe`), hand it off; don't attempt it yourself
- **No territorial behaviour** — never contradict or redo another agent's output to assert ownership; build on it or flag a concern constructively
- **One voice per domain** — if two agents could both handle something, the orchestrator picks one; the other stays silent rather than competing
- **Collective strength** — the system produces better results when each agent plays its role than when any single agent tries to do everything alone

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Self-Setup Maintenance

When modifying any file under `.claude/` (agents, skills, settings, hooks, this file):

1. **Update all cross-references** — agents reference each other by name (e.g. `sw-engineer` → `linting-expert`); if a name, scope, or capability changes, update every file that mentions it
2. **Update `memory/MEMORY.md`** — the agents/skills inventory line must stay in sync with what actually exists on disk
3. **Cross-check `README.md`** — after ANY change to a `.claude/` file, verify `README.md` reflects the change: agent/skill tables match files on disk, Status Line section matches `hooks/statusline.js` behavior, Config Sync section matches `skills/sync/SKILL.md`; keep descriptions and names accurate (no hardcoded counts — the tables are self-documenting)
4. **Update `settings.json` permissions** — if a skill or agent adds new `gh`, `bash`, or `WebFetch` calls, add the matching permission rule so it doesn't hit a prompt
5. **Keep `</workflow>` tags structural** — all mode sections in skill files must sit inside the `<workflow>` block; the closing tag goes after the last mode, before `<notes>`
6. **No orphaned step numbers** — if steps are added/removed in a skill workflow, renumber sequentially

## Communication

- **Flag early, not late**: surface risks, blockers, and concerns before starting work — not as apologies after
- **Objective and direct**: no flattery, no filler; state what works and what doesn't
- **Positive but critical**: lead with what is good, then call out issues clearly
- **No after-the-fact sorry**: if something is likely to go wrong, say so upfront and propose an alternative
- **File vs terminal for long output**: ask "will the user copy this into something else?" — if yes, write to a **new** file `tasks/output-<slug>-<YYYY-MM-DD>.md` (e.g. `tasks/output-release-2026-03-01.md`) AND print to terminal; notify `→ saved to tasks/output-<slug>-<date>.md`. If output is just a report the user reads and acts on (audit findings, calibrate results, analysis within the current workflow), keep it terminal-only. Never overwrite an existing output file — always create a new one to avoid diff noise from unrelated content. Prose paragraphs: no hard line breaks at column width.
- **`!` Breaking findings**: when something is completely non-functional (skill can't run, cross-ref is broken, hook crashes), mark it `!` or `! BREAKING` and state the impact + fix in the same breath — never bury it as a quiet table row. The user should not have to discover it themselves.
- **Terminal color conventions** (for skill bash output and status lines):
  - RED — breaking/critical: `! BREAKING`, errors that prevent execution
  - YELLOW — warnings: `⚠ MISSING`, `⚠ DIFFERS`, medium findings
  - GREEN — pass status: `✓ OK`, `✓ IDENTICAL`
  - CYAN — source agent name or inline fix hint

## Output Standards

Every agent completing an analysis task **must** end its response with a `## Confidence` block:

```
## Confidence
**Score**: 0.N — [high ≥0.9 | moderate 0.7–0.9 | low <0.7]
**Gaps**: what limited thoroughness (missing runtime data, partial file read, cross-agent context unavailable…)
```

- The score is a **coverage estimate** — how thoroughly the task was checked. It is not a quality guarantee.
- The **Gaps field** is the primary reliable signal: it makes implicit limitations explicit so the orchestrator and user can decide whether a second pass is needed.
- Score < 0.7 → orchestrator flags with ⚠ and may re-run the agent with the specific gap addressed.
- This standard applies to **all** agents regardless of who spawned them. Orchestrating skills (audit, review, security, calibrate) collect and aggregate these scores; `/calibrate` measures whether they track actual quality over time.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Tool-first mindset**: Use declared tools fully and creatively before indicating a limitation or requesting an alternative. If a tool can do the job — even indirectly — use it.
