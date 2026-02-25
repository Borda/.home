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
| **doc-scribe**         | Documentation                    | NumPy/Google docstrings, Sphinx/mkdocs, changelog automation                    |
| **web-explorer**       | Web and docs research            | API version comparison, migration guides, PyPI tracking, ecosystem compat       |
| **self-mentor**        | Config quality reviewer (Opus)   | Agent/skill auditing, duplication detection, cross-ref validation, line budgets |

### Skills

Skills are orchestrations of agents — invoked via slash commands (`/review`, `/security`, etc.). A single skill typically composes multiple agents in parallel and consolidates their output. Think of agents as specialists you can talk to, and skills as predefined workflows that coordinate them.

| Skill        | Command                | What It Does                                                                                   |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **review**   | `/review [file\|PR#]`  | Parallel code review across 7 dimensions (arch, tests, perf, docs, lint, security, API design) |
| **security** | `/security [target]`   | OWASP Top 10 + Python-specific + ML supply chain audit                                         |
| **optimize** | `/optimize [target]`   | Measure-change-measure performance loop                                                        |
| **release**  | `/release [range]`     | Release notes, CHANGELOG, or migration guide from git history                                  |
| **survey**   | `/survey [topic]`      | SOTA literature survey with implementation plan                                                |
| **analyse**  | `/analyse [#\|health]` | Issue/PR analysis, repo health, duplicate detection, contributor activity                      |
| **observe**  | `/observe`             | Meta-skill: analyze work patterns and suggest new agents or skills                             |
| **sync**     | `/sync [apply]`        | Drift-detect project `.claude/` vs home `~/.claude/`; `apply` performs the sync                |
| **manage**   | `/manage <op> <type>`  | Create, update, or delete agents/skills with cross-ref propagation                             |
| **refactor** | `/refactor <target>`   | Test-first refactoring: ensure coverage exists, add characterization tests, then refactor       |
| **fix**      | `/fix <bug>`           | Reproduce-first bug fixing: regression test, targeted fix, lint and quality checks              |

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

</details>

### Status Line

A lightweight hook (`hooks/statusline.js`) adds a persistent status bar to every Claude Code session:

```
claude-sonnet-4-6 │ Borda.local │ ████░░░░░░ 38%
```

Shows the active model name, current project directory, and a 10-segment context usage bar (green → yellow → red). Configured via `statusLine` in `settings.json`. Zero external dependencies — stdlib `path` only.

### Config Sync

This repo is the **source of truth** for all `.claude/` configuration. Home (`~/.claude/`) is a downstream copy kept in sync via the `/sync` skill.

```
Borda.local/.claude/   →   ~/.claude/
  agents/                    agents/
  skills/                    skills/
  hooks/statusline.js        hooks/statusline.js
  settings.json              settings.json  (statusLine path rewritten to absolute)
```

Two files are intentionally **not synced**: `CLAUDE.md` (project-specific rules) and `settings.local.json` (machine-local overrides).

**Workflow:**

```bash
/sync          # dry-run: show drift report (MISSING / DIFFERS / IDENTICAL per file)
/sync apply    # apply: copy all differing files and verify outcome
```

Run `/sync` after editing any agent, skill, hook, or `settings.json` in this repo to propagate the change to the home config.

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
