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

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Tool-first mindset**: Use declared tools fully and creatively before indicating a limitation or requesting an alternative. If a tool can do the job — even indirectly — use it.
