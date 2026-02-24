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

Specialist roles with deep domain knowledge. Invoked automatically by Claude Code when a task matches their expertise, or explicitly via the Task tool.

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

Workflow orchestrators invoked via slash commands (`/review`, `/security`, etc.). They coordinate agents and produce structured output.

| Skill        | Command                | What It Does                                                                                   |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **review**   | `/review [file\|PR#]`  | Parallel code review across 7 dimensions (arch, tests, perf, docs, lint, security, API design) |
| **security** | `/security [target]`   | OWASP Top 10 + Python-specific + ML supply chain audit                                         |
| **optimize** | `/optimize [target]`   | Measure-change-measure performance loop via perf-optimizer agent                               |
| **release**  | `/release [range]`     | Release notes, CHANGELOG, or migration guide from git history                                  |
| **survey**   | `/survey [topic]`      | SOTA literature survey with implementation plan via ai-researcher agent                        |
| **analyse**  | `/analyse [#\|health]` | Issue/PR analysis, repo health, duplicate detection, contributor activity                      |
| **observe**  | `/observe`             | Meta-skill: analyze work patterns and suggest new agents or skills                             |
| **sync**     | `/sync [apply]`        | Drift-detect project `.claude/` vs home `~/.claude/`; `apply` performs the sync                |

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
  agents/ (12)               agents/ (12+)
  skills/ (8)                skills/ (8+)
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
