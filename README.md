# Borda's .local

Personal AI coding assistant configuration for Python/ML OSS development. Version-controlled, opinionated, continuously improved.

## 📦 What's Here

```
borda.local/
├── .claude/                # Claude Code (Claude by Anthropic)
│   ├── CLAUDE.md           # workflow rules and core principles
│   ├── settings.json       # permissions and model preferences
│   ├── agents/             # specialist agents
│   ├── skills/             # workflow skills (slash commands)
│   └── hooks/              # UI extensions
├── .codex/                 # OpenAI Codex CLI
│   ├── AGENTS.md           # global instructions and subagent spawn rules
│   ├── config.toml         # multi-agent config (gpt-5.3-codex baseline)
│   └── agents/             # per-agent model and instruction overrides
├── .pre-commit-config.yaml
├── .gitignore
└── README.md
```

## 🤖 Claude Code

Agents and skills for [Claude Code](https://claude.ai/code) (Anthropic's AI coding CLI).

### Agents

Specialist roles with deep domain knowledge. You can request a specific agent by name in your prompt (e.g., *"use the qa-specialist to write tests for this module"*). Claude Code also selects agents automatically when spawning subagents via the Task tool.

| Agent                  | Purpose                          | Key Capabilities                                                                |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| **sw-engineer**        | Architecture and implementation  | SOLID principles, type safety, clean architecture, doctest-driven dev           |
| **solution-architect** | System design and API planning   | ADRs, interface specs, migration plans, coupling analysis, API surface audit    |
| **oss-maintainer**     | Project lifecycle management     | Issue triage, PR review, SemVer, pyDeprecate, trusted publishing                |
| **ai-researcher**      | ML research and implementation   | Paper analysis, experiment design, LLM evaluation, inference optimization       |
| **qa-specialist**      | Testing and validation           | pytest, hypothesis, mutation testing, snapshot tests, ML test patterns          |
| **linting-expert**     | Code quality and static analysis | ruff, mypy, pre-commit, rule selection strategy, CI quality gates               |
| **perf-optimizer**     | Performance engineering          | Profile-first workflow, CPU/GPU/memory/I/O, torch.compile, mixed precision      |
| **ci-guardian**        | CI/CD reliability                | GitHub Actions, reusable workflows, trusted publishing, flaky test detection    |
| **data-steward**       | ML data pipeline integrity       | Split validation, leakage detection, data contracts, class imbalance            |
| **doc-scribe**         | Documentation                    | Google/Napoleon docstrings (no type duplication), Sphinx/mkdocs, changelog      |
| **web-explorer**       | Web and docs research            | API version comparison, migration guides, PyPI tracking, ecosystem compat       |
| **self-mentor**        | Config quality reviewer (Opus)   | Agent/skill auditing, duplication detection, cross-ref validation, line budgets |

### Skills

Skills are orchestrations of agents — invoked via slash commands (`/review`, `/security`, etc.). A single skill typically composes multiple agents in parallel and consolidates their output. Think of agents as specialists you can talk to, and skills as predefined workflows that coordinate them.

| Skill         | Command                            | What It Does                                                                                   |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| **review**    | `/review [file\|PR#]`              | Parallel code review across 7 dimensions (arch, tests, perf, docs, lint, security, API design) |
| **security**  | `/security [target]`               | OWASP Top 10 + Python-specific + ML supply chain audit                                         |
| **optimize**  | `/optimize [target]`               | Measure-change-measure performance loop                                                        |
| **release**   | `/release [range]`                 | Release notes, CHANGELOG, or migration guide from git history                                  |
| **survey**    | `/survey [topic]`                  | SOTA literature survey with implementation plan                                                |
| **analyse**   | `/analyse [#\|health]`             | Issue/PR analysis, repo health, duplicate detection, contributor activity                      |
| **observe**   | `/observe`                         | Meta-skill: analyze work patterns and suggest new agents or skills                             |
| **audit**     | `/audit [fix]`                     | Full-sweep config audit: broken refs, dead loops, inventory drift, interoperability issues     |
| **sync**      | `/sync [apply]`                    | Drift-detect project `.claude/` vs home `~/.claude/`; `apply` performs the sync                |
| **manage**    | `/manage <op> <type>`              | Create, update, or delete agents/skills with cross-ref propagation                             |
| **feature**   | `/feature <desc>`                  | TDD-first feature dev: codebase analysis, demo doctest, TDD loop, docs + QA + review cycle     |
| **refactor**  | `/refactor <target>`               | Test-first refactoring: ensure coverage exists, add characterization tests, then refactor      |
| **fix**       | `/fix <bug>`                       | Reproduce-first bug fixing: regression test, targeted fix, lint and quality checks             |
| **calibrate** | `/calibrate [target] [fast\|full]` | Agent calibration: synthetic problems with known outcomes, measures recall vs confidence bias  |
| **codex**     | `/codex <task> [target]`           | Delegate mechanical coding tasks to Codex CLI — Claude orchestrates, Codex executes            |

<details>
<summary><strong>Skill usage examples</strong></summary>

- **`/optimize` — Performance deep-dive**

  ```bash
  # Profile a specific Python module
  /optimize src/mypackage/dataloader.py
  # Profile a whole package entry point
  /optimize src/mypackage/train.py
  # Target a slow test suite
  /optimize tests/test_heavy_integration.py
  ```

- **`/review` — Parallel code review**

  ```bash
  # Review a PR by number
  /review 42
  # Review specific files
  /review src/mypackage/transforms.py
  # Review latest commit (no argument)
  /review
  ```

- **`/security` — Security audit**

  ```bash
  # Audit a specific module
  /security src/mypackage/api/auth.py
  # Audit an entire directory
  /security src/mypackage/
  ```

- **`/analyse` — Issue and repo health**

  ```bash
  # Analyze an issue or PR by number
  /analyse 123
  # Repo health overview
  /analyse health
  # Find duplicate issues
  /analyse dupes memory leak
  ```

- **`/survey` — SOTA literature search**

  ```bash
  # Survey a topic
  /survey efficient transformers for long sequences
  # Survey a specific method
  /survey knowledge distillation for object detection
  ```

- **`/release` — Release notes from git history**

  ```bash
  # Notes since last tag
  /release
  # Notes for a specific range
  /release v1.2.0..HEAD
  ```

- **`/sync` — Config drift detection**

  ```bash
  # Dry-run: show what differs between project and home .claude/
  /sync
  # Apply: copy differing files to ~/.claude/
  /sync apply
  ```

- **`/manage` — Agent/skill lifecycle**

  ```bash
  # Create a new agent
  /manage create agent security-auditor "Security specialist for vulnerability scanning"
  # Rename a skill (updates all cross-references)
  /manage update skill optimize perf-audit
  # Delete an agent (cleans broken refs)
  /manage delete agent web-explorer
  ```

- **`/audit` — Config health sweep**

  ```bash
  # Full sweep — report only, no changes made (default)
  /audit
  # Full sweep + auto-fix critical and high findings
  /audit fix
  # Agents only, report only
  /audit agents
  # Skills only, with auto-fix
  /audit skills fix
  ```

- **`/refactor` — Test-first refactoring**

  ```bash
  # Refactor a module with a specific goal
  /refactor src/mypackage/transforms.py "replace manual loops with vectorized ops"
  # General quality pass on a directory
  /refactor src/mypackage/utils/
  ```

- **`/fix` — Bug fixing**

  ```bash
  # Fix a bug described in a GitHub issue
  /fix 42
  # Fix a specific error
  /fix "TypeError when passing None to transform()"
  # Fix a failing test
  /fix tests/test_transforms.py::test_none_input
  ```

- **`/feature` — TDD-first feature development**

  ```bash
  # Implement a feature from a GitHub issue
  /feature 87
  # Implement a feature described in plain text
  /feature "add batched predict() method to Classifier"
  # Scope analysis to a specific module
  /feature "add batched predict() method to Classifier" "src/classifier"
  ```

- **`/codex` — Delegate mechanical work to Codex**

  ```bash
  # Add docstrings to all undocumented public functions in a module
  /codex "add NumPy-style docstrings to all undocumented public functions" "src/mypackage/transforms.py"
  # Rename a symbol consistently across a directory
  /codex "rename BatchLoader to DataBatcher throughout the package" "src/mypackage/"
  # Add type annotations to a well-typed module
  /codex "add return type annotations to all functions missing them" "src/mypackage/utils.py"
  ```

</details>

### Common Workflow Sequences

Skills chain naturally — the output of one becomes the input for the next.

<details>
<summary><strong>Bug report → fix → validate</strong></summary>

```
/analyse 42            # understand the issue, extract root cause hypotheses
/fix 42                # reproduce with test, apply targeted fix
/review                # validate the fix meets quality standards
```

</details>

<details>
<summary><strong>Security audit → remediate → verify</strong></summary>

```
/security src/api/     # audit for vulnerabilities
/fix "SQL injection in user query endpoint"  # apply specific remediation
/security src/api/     # re-verify no new issues introduced
```

</details>

<details>
<summary><strong>Performance investigation → optimize → refactor</strong></summary>

```
/optimize src/mypackage/dataloader.py   # profile and fix top bottleneck
/refactor src/mypackage/dataloader.py "extract caching layer"  # structural improvement
/review                                 # full quality pass on changes
```

</details>

<details>
<summary><strong>Code review → fix blocking issues</strong></summary>

```
/review 55             # parallel review across 7 dimensions
/fix "race condition in cache invalidation"  # fix blocking issue from review
/review 55             # re-review after fix
```

</details>

<details>
<summary><strong>New feature → implement → release</strong></summary>

```
/analyse 87            # understand the issue, clarify acceptance criteria
/feature 87            # codebase analysis, demo test, TDD, docs, review
/release               # generate CHANGELOG entry and release notes
```

</details>

<details>
<summary><strong>New capability → survey → implement</strong></summary>

```
/survey "efficient attention for long sequences"  # find SOTA methods
/feature "implement FlashAttention in encoder"    # TDD-first implementation
/review                                           # validate implementation
```

</details>

<details>
<summary><strong>Observe → create → audit → sync</strong></summary>

```
/observe               # analyze work patterns, suggest new agents/skills
/manage create agent security-auditor "..."  # scaffold suggested agent
/audit                 # verify config integrity — catch broken refs, dead loops
/sync apply            # propagate clean config to ~/.claude/
```

</details>

<details>
<summary><strong>Delegate mechanical work to Codex</strong></summary>

```
/codex "add NumPy docstrings to all undocumented public functions" "src/mypackage/"
# Codex executes; Claude validates with lint + tests
/review                                   # full quality pass on Codex output
```

</details>

<details>
<summary><strong>Config maintenance — periodic health check</strong></summary>

```
/audit                 # inspect findings — report only, no changes made
/audit fix             # full sweep + auto-fix critical and high findings
/sync apply            # propagate verified config to ~/.claude/
```

</details>

<details>
<summary><strong>Release preparation</strong></summary>

```
/security src/         # pre-release vulnerability scan
/release v1.2.0..HEAD  # generate release notes from git history
```

</details>

### Status Line

A lightweight hook (`hooks/statusline.js`) adds a persistent status bar to every Claude Code session:

```
claude-sonnet-4-6 │ Borda.local │ Pro ~$1.20 │ ████░░░░░░ 38%
claude-sonnet-4-6 │ Borda.local │ API $0.42  │ ████░░░░░░ 38%
claude-sonnet-4-6 │ Borda.local │ Max ~$0.80 │ ██░░░░░░░░ 20% │ ⚡ 2 agents (Explore, sw-engineer)
```

Shows the active model name, current project directory, billing indicator, a 10-segment context usage bar (green → yellow → red), and an active subagent indicator when background agents are running.

<details>
<summary><strong>Billing indicator explained</strong></summary>

- **Subscription (Pro/Max)**: `Max/Pro/Sub ~$X.XX` in cyan — plan name is inferred from context window size (≥1M tokens → Max, ≥200k → Pro, else Sub); `~$X.XX` is the session's theoretical API-rate cost (tokens × list price), not an actual charge. Use `/status` for real monthly quota.
- **API key**: `API $X.XX` in yellow — actual spend at pay-per-token rates.

`cost.total_cost_usd` (the source of `$X.XX`) is tokens × published API rates. For subscription users this is an estimate only — Anthropic's subscription quota uses internal accounting that doesn't map 1:1 to API list prices.

</details>

The subagent indicator (`⚡ N agents (type, ...)`) appears while Task agents are running and clears the moment they finish. It is powered by a companion hook (`hooks/task-log.js`) that listens to `SubagentStart` and `SubagentStop` events — agents are added when they spawn and removed when they complete, for both foreground and background tasks. A 10-minute safety-net age-out handles crashed or hung agents.

Configured via `statusLine` in `settings.json`. Zero external dependencies — stdlib `path` and `fs` only.

### Config Sync

This repo is the **source of truth** for all `.claude/` configuration. Home (`~/.claude/`) is a downstream copy kept in sync via the `/sync` skill.

```
Borda.local/.claude/   →   ~/.claude/
  agents/                    agents/
  skills/                    skills/
  hooks/statusline.js        hooks/statusline.js
  settings.json              settings.json  (statusLine path rewritten to absolute)
```

One file is intentionally **not synced**: `settings.local.json` (machine-local overrides). `CLAUDE.md` is synced as part of the standard propagation.

**Workflow:**

```bash
/sync          # dry-run: show drift report (MISSING / DIFFERS / IDENTICAL per file)
/sync apply    # apply: copy all differing files and verify outcome
```

Run `/sync` after editing any agent, skill, hook, or `settings.json` in this repo to propagate the change to the home config.

## 🤖 Codex CLI

Multi-agent configuration for [OpenAI Codex CLI](https://github.com/openai/codex) (Rust implementation, v0.105+). Where Claude Code excels at long-horizon planning and research, Codex CLI is optimized for focused, in-repo agentic coding — running shell commands, editing files, and spawning parallel sub-agents directly in your terminal.

### Agents

Nine specialist roles wired into the multi-agent system. Codex can spawn them autonomously based on task type (see `AGENTS.md` for the full spawn-rule matrix) or you can address them by name in your prompt.

| Agent                | Model         | Effort | Purpose                                                                 |
| -------------------- | ------------- | ------ | ----------------------------------------------------------------------- |
| **sw-engineer**      | gpt-5.3-codex | high   | SOLID implementation, doctest-driven dev, ML pipeline architecture      |
| **qa-specialist**    | gpt-5.3-codex | xhigh  | Edge-case matrix, The Borda Standard, adversarial test review           |
| **squeezer**         | gpt-5.3-codex | high   | Profile-first optimization, GPU throughput, memory efficiency           |
| **doc-scribe**       | gpt-5.3-codex | medium | 6-point Google/Napoleon docstrings, README stewardship, CHANGELOG       |
| **security-auditor** | gpt-5.3-codex | xhigh  | OWASP Python, ML supply chain, secrets, CI/CD hygiene *(read-only)*     |
| **data-steward**     | gpt-5.3-codex | high   | Split leakage, DataLoader reproducibility, augmentation correctness     |
| **ci-guardian**      | gpt-5.3-codex | medium | GitHub Actions, trusted PyPI publishing, pre-commit, flaky tests        |
| **linting-expert**   | gpt-5.3-codex | medium | ruff, mypy, pre-commit config, rule progression, suppression discipline |
| **oss-maintainer**   | gpt-5.3-codex | high   | Issue triage, PR review, SemVer, pyDeprecate, release checklist         |

### Model Strategy

All agents use `gpt-5.3-codex` — the current Codex CLI default and the upgrade target for every prior model in the catalog. Differentiation is via reasoning effort:

- **xhigh** — adversarial roles (qa-specialist, security-auditor): exhaustive search for what could go wrong
- **high** — analytical roles (sw-engineer, squeezer, data-steward, oss-maintainer): depth without unbounded budget
- **medium** — writing/config roles (doc-scribe, ci-guardian, linting-expert): quality over deductive intensity

### Usage

```bash
# Interactive session — Codex selects agents automatically
codex

# Address a specific agent by name in your prompt
codex "use the security-auditor to review src/api/auth.py"
codex "spawn data-steward to validate the train/val split in data/splits/"

# Parallel fan-out (Codex orchestrates automatically per AGENTS.md rules)
# e.g. after sw-engineer finishes → qa-specialist + doc-scribe run concurrently
```

### Install / Port to Home

This repo is the authoring location. To activate globally, copy the entire `.codex/` directory to `~/.codex/`:

```bash
cp -r .codex/ ~/.codex/
```

Paths in `config.toml` are **relative** — no substitution needed. The `AGENTS.md` at `~/.codex/AGENTS.md` is read by Codex for every project; a project-local `AGENTS.md` at the repo root extends it.

### Files

| File            | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `config.toml`   | Global model, sandbox, features flags, and `[agents]` registry            |
| `AGENTS.md`     | Borda Standard, 6-point docstring structure, spawn rules for all 9 agents |
| `agents/*.toml` | Per-agent `model`, `model_reasoning_effort`, and `developer_instructions` |

## 💡 Design Principles

- **Agents are roles, skills are workflows** — agents carry domain expertise, skills orchestrate multi-step processes
- **No duplication** — agents reference each other instead of repeating content (e.g., sw-engineer references linting-expert for config)
- **Profile-first, measure-last** — performance skills always bracket changes with measurements
- **Link integrity** — never cite a URL without fetching it first (enforced in all research agents)
- **Python 3.10+ baseline** — all configs target py310 minimum (3.9 EOL was Oct 2025)
- **Modern toolchain** — uv, ruff, mypy, pytest, GitHub Actions with trusted publishing

## 🎯 Tailored For

This setup is optimized for maintaining Python/ML OSS projects in the PyTorch ecosystem:

- Libraries with public APIs requiring SemVer discipline and deprecation cycles
- ML training and inference codebases needing GPU profiling and data pipeline validation
- Multi-contributor projects with CI/CD, pre-commit hooks, and automated releases
